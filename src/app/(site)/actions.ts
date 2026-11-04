"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { RuleError, type GuestCount, type PaymentOption } from "@/domain";
import { createBooking, SlotTakenError } from "@/server/booking-service";
import { prisma } from "@/server/db";
import { notify } from "@/server/notify";
import { isLockedOut, recordFailedLogin } from "@/server/settings-service";
import { getLang } from "@/server/site-content";
import * as wf from "@/server/workflow-service";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function ip() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

/** Simple abuse guard (NFR-05): N actions per IP per 10 minutes, plus a hidden honeypot field. */
async function guard(form: FormData, bucket: string) {
  if (str(form, "website")) throw new RuleError("BOT", "Request blocked");
  const key = `${bucket}:${await ip()}`;
  if (await isLockedOut(key)) throw new RuleError("RATE", "Too many attempts. Please wait 10 minutes or call us.");
  await recordFailedLogin(key); // counts attempts; locks after 5 in 10 minutes
}

const back = (path: string, k: string, v: string) => `${path}${path.includes("?") ? "&" : "?"}${k}=${encodeURIComponent(v)}`;

interface Payload {
  tripDate: string;
  type: "SHARED" | "FULL_BOAT";
  cabinIds: string[];
  guestsPerCabin: Record<string, number>;
  guests: GuestCount[];
  foodGuests: GuestCount[];
}

export async function requestBookingAction(form: FormData) {
  let p: Payload;
  try {
    p = JSON.parse(str(form, "payload"));
  } catch {
    redirect("/book?error=" + encodeURIComponent("Please pick a date and try again."));
  }
  const here = `/book?month=${p.tripDate.slice(0, 7)}&date=${p.tripDate}&type=${p.type}`;
  let token: string;
  try {
    await guard(form, "book");
    if (str(form, "agree") !== "on") throw new RuleError("TERMS", "Please accept the terms");
    const b = await createBooking({
      type: p.type, tripDate: p.tripDate, channel: "ONLINE", source: "WEBSITE",
      lead: { name: str(form, "name"), mobile: str(form, "mobile").replace(/[^0-9+]/g, ""), email: str(form, "email") || undefined, nid: str(form, "nid").replace(/[\s-]/g, "") },
      guests: p.guests.filter((g) => g.count > 0),
      foodGuests: p.type === "FULL_BOAT" ? p.foodGuests.filter((g) => g.count > 0) : undefined,
      cabinIds: p.type === "SHARED" ? p.cabinIds : undefined,
      guestsPerCabin: p.type === "SHARED" ? p.guestsPerCabin : undefined,
      notes: str(form, "notes").slice(0, 500) || undefined,
      language: await getLang(),
    });
    token = b.accessToken;
  } catch (e) {
    if (e instanceof SlotTakenError) redirect(back(here, "taken", e.alternatives.join(",") || "none"));
    if (e instanceof RuleError) redirect(back(here, "error", e.message));
    console.error(e);
    redirect(back(here, "error", "Something went wrong. Please try again or call us."));
  }
  redirect(`/booking/${token}?new=1`);
}

async function bookingByToken(token: string) {
  const b = await prisma.booking.findUnique({ where: { accessToken: token } });
  if (!b) throw new RuleError("NOT_FOUND", "Booking not found");
  return b;
}

export async function choosePaymentAction(token: string, form: FormData) {
  const path = `/booking/${token}`;
  try {
    const b = await bookingByToken(token);
    await wf.choosePaymentOption(b.id, (str(form, "option") === "FULL" ? "FULL" : "ADVANCE") as PaymentOption, "guest");
  } catch (e) {
    redirect(back(path, "error", e instanceof RuleError ? e.message : "Could not change the payment option"));
  }
  redirect(`${path}#pay`);
}

const MAX = 5 * 1024 * 1024;
function sniff(buf: Buffer): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  return null;
}

export async function uploadProofAction(token: string, form: FormData) {
  const path = `/booking/${token}`;
  try {
    await guard(form, "proof");
    const b = await bookingByToken(token);
    const amount = Number(str(form, "amount").replace(/[^0-9]/g, ""));
    if (!amount) throw new RuleError("AMOUNT", "Enter the amount you sent");
    const file = form.get("file");
    let blob: { mime: string; data: Buffer } | null = null;
    if (file && typeof file === "object" && "arrayBuffer" in file && (file as File).size > 0) {
      const f = file as File;
      if (f.size > MAX) throw new RuleError("FILE_SIZE", "The screenshot must be 5 MB or smaller");
      const data = Buffer.from(await f.arrayBuffer());
      const mime = sniff(data);
      if (!mime) throw new RuleError("FILE_TYPE", "Use a JPG, PNG or PDF file");
      blob = { mime, data };
    }
    const at = str(form, "transferAt");
    const p = await wf.submitProof(b.id, {
      amountClaimed: amount, txnId: str(form, "txnId").slice(0, 64) || undefined,
      senderName: str(form, "sender").slice(0, 100) || undefined, senderBank: str(form, "bank").slice(0, 60) || undefined,
      transferAt: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at) ? new Date(Date.parse(`${at}:00Z`) - 6 * 3_600_000) : undefined,
    }, "guest");
    if (blob) {
      await prisma.proofFile.create({ data: { paymentId: p.id, mime: blob.mime, size: blob.data.length, data: new Uint8Array(blob.data) } });
      await prisma.payment.update({ where: { id: p.id }, data: { proofUrl: `/admin/proofs/${p.id}` } });
    }
  } catch (e) {
    redirect(back(path, "error", e instanceof RuleError ? e.message : "Could not send the proof. Please try again.") + "#proof");
  }
  redirect(`${path}?sent=1#payments`);
}

export async function cancelRequestAction(token: string, form: FormData) {
  const path = `/booking/${token}`;
  try {
    await guard(form, "cancel");
    const b = await bookingByToken(token);
    if (!b.cancelRequestedAt) {
      await prisma.booking.update({ where: { id: b.id }, data: { cancelRequestedAt: new Date(), cancelRequestReason: str(form, "reason").slice(0, 500) || null } });
      await prisma.auditLog.create({ data: { entity: "Booking", entityId: b.id, action: "CANCEL_REQUESTED", actor: "guest", reason: str(form, "reason").slice(0, 500) || null } });
    }
  } catch (e) {
    redirect(back(path, "error", e instanceof RuleError ? e.message : "Could not send the request"));
  }
  redirect(`${path}?cancel=1`);
}

/** FR-W07: re-send the private link by SMS to the mobile on the booking. The link is never shown here. */
export async function findBookingAction(form: FormData) {
  try {
    await guard(form, "find");
    const ref = str(form, "reference").toUpperCase();
    const mobile = str(form, "mobile").replace(/[^0-9]/g, "").replace(/^88/, "");
    const b = await prisma.booking.findUnique({ where: { reference: ref }, include: { leadGuest: true } });
    if (b && b.leadGuest.mobile.replace(/[^0-9]/g, "").replace(/^88/, "") === mobile) {
      await notify("N-01", b.id, {}, { repeatKey: `resend-${Date.now()}` });
    }
  } catch (e) {
    redirect("/booking?error=" + encodeURIComponent(e instanceof RuleError ? e.message : "Please try again"));
  }
  // Same answer whether or not it matched, so references cannot be guessed.
  redirect("/booking?sent=1");
}
