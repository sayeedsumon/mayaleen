"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { RuleError, type GuestCount, type PaymentOption } from "@/domain";
import { requireUser, SESSION_COOKIE } from "@/server/auth/current-user";
import { verifyPassword } from "@/server/auth/password";
import { createSessionToken } from "@/server/auth/session";
import { verifyTotp } from "@/server/auth/totp";
import { createBooking, SlotTakenError } from "@/server/booking-service";
import { prisma } from "@/server/db";
import * as wf from "@/server/workflow-service";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string) => Number.parseInt(str(f, k) || "0", 10) || 0;

function fail(path: string, e: unknown): never {
  const msg = e instanceof SlotTakenError
    ? `Just booked by someone else. Nearest free dates: ${e.alternatives.join(", ") || "none soon"}`
    : e instanceof RuleError ? e.message : "Something went wrong";
  if (!(e instanceof RuleError)) console.error(e);
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(msg)}`);
}

// ---------- session ----------

const attempts = new Map<string, { n: number; until: number }>();

export async function loginAction(form: FormData) {
  const mobile = str(form, "mobile");
  const rec = attempts.get(mobile);
  if (rec && rec.n >= 5 && rec.until > Date.now()) fail("/admin/login", new RuleError("LOCKED", "Too many attempts. Try again in 10 minutes."));

  const user = await prisma.user.findUnique({ where: { mobile } });
  const ok =
    !!user && user.active && verifyPassword(str(form, "password"), user.pwHash) &&
    (!user.twoFaOn || (!!user.totpSecret && verifyTotp(user.totpSecret, str(form, "code"))));
  if (!ok || !user) {
    attempts.set(mobile, { n: (rec?.n ?? 0) + 1, until: Date.now() + 10 * 60_000 });
    fail("/admin/login", new RuleError("BAD_LOGIN", "Wrong mobile, password or code"));
  }
  attempts.delete(mobile);
  (await cookies()).set(SESSION_COOKIE, createSessionToken(user.id, user.role), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 12 * 3600,
  });
  redirect("/admin");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}

// ---------- bookings ----------

function guestsFromForm(f: FormData, prefix: string, bands: string[]): GuestCount[] {
  return bands.map((band, i) => ({ band, count: int(f, `${prefix}${i}`) })).filter((g) => g.count > 0);
}

export async function createBookingAction(form: FormData) {
  const user = await requireUser("CREATE_BOOKING");
  const bands = await prisma.ageBand.findMany({ orderBy: { minAge: "desc" } });
  const names = bands.map((b) => b.name);
  const type = str(form, "type") as "SHARED" | "FULL_BOAT";
  const cabinIds = form.getAll("cabin").map(String);
  let id: string;
  try {
    const b = await createBooking({
      type, tripDate: str(form, "tripDate"), channel: "STAFF", source: str(form, "source") as never,
      lead: { name: str(form, "name"), mobile: str(form, "mobile"), email: str(form, "email") || undefined, nid: str(form, "nid") },
      guests: guestsFromForm(form, "g", names),
      foodGuests: type === "FULL_BOAT" ? guestsFromForm(form, "f", names) : undefined,
      cabinIds: type === "SHARED" ? cabinIds : undefined,
      guestsPerCabin: type === "SHARED" ? Object.fromEntries(cabinIds.map((c) => [c, int(form, `cg_${c}`)])) : undefined,
      notes: str(form, "notes") || undefined,
    });
    id = b.id;
    if (str(form, "approveNow") === "on" && (await requireUser("MANAGE_BOOKINGS")).id) {
      await wf.approveBooking(id, user.id, { paymentOption: (str(form, "paymentOption") || "FULL") as PaymentOption });
    }
  } catch (e) {
    fail("/admin/bookings/new", e);
  }
  redirect(`/admin/bookings/${id}`);
}

type Act = (id: string, f: FormData, uid: string) => Promise<unknown>;

/** Run a workflow action with permission check, error redirect and cache refresh. */
async function act(cap: "MANAGE_BOOKINGS" | "VIEW_OPERATIONS", id: string, form: FormData, fn: Act) {
  const user = await requireUser(cap);
  const path = `/admin/bookings/${id}`;
  try {
    await fn(id, form, user.id);
  } catch (e) {
    fail(path, e);
  }
  revalidatePath(path);
  redirect(path);
}

export const approveAction = async (id: string, f: FormData) =>
  act("MANAGE_BOOKINGS", id, f, (i, ff, u) => wf.approveBooking(i, u, { paymentOption: (str(ff, "paymentOption") || undefined) as PaymentOption | undefined }));
export const rejectAction = async (id: string, f: FormData) =>
  act("MANAGE_BOOKINGS", id, f, (i, ff, u) => wf.rejectBooking(i, u, str(ff, "reason")));
export const cancelAction = async (id: string, f: FormData) =>
  act("MANAGE_BOOKINGS", id, f, (i, ff, u) => wf.cancelBooking(i, u, str(ff, "reason")));
export const noShowAction = async (id: string, f: FormData) =>
  act("MANAGE_BOOKINGS", id, f, (i, ff, u) => wf.markNoShow(i, u, str(ff, "reason")));
export const extendAction = async (id: string, f: FormData) =>
  act("MANAGE_BOOKINGS", id, f, (i, ff, u) => wf.extendDeadline(i, new Date(str(ff, "until")), u, str(ff, "reason")));
export const manualPaymentAction = async (id: string, f: FormData) =>
  act("MANAGE_BOOKINGS", id, f, (i, ff, u) =>
    wf.recordManualPayment(i, { amount: int(ff, "amount"), txnId: str(ff, "txnId") || undefined, senderName: str(ff, "sender") || undefined }, u));
export const refundAction = async (id: string, f: FormData) =>
  act("MANAGE_BOOKINGS", id, f, (i, ff, u) => wf.recordRefund(i, { amount: int(ff, "amount"), txnId: str(ff, "txnId"), reason: str(ff, "reason") }, u));
export const foodAction = async (id: string, f: FormData) =>
  act("MANAGE_BOOKINGS", id, f, async (i, ff, u) => {
    const bands = await prisma.ageBand.findMany({ orderBy: { minAge: "desc" } });
    return wf.setFoodPackages(i, guestsFromForm(ff, "f", bands.map((b) => b.name)), u);
  });
export const checkOutAction = async (id: string, f: FormData) =>
  act("VIEW_OPERATIONS", id, f, (i, ff, u) => wf.checkOut(i, u, str(ff, "notes") || undefined));
export const checkInAction = async (id: string, f: FormData) =>
  act("VIEW_OPERATIONS", id, f, (i, ff, u) => {
    const n = int(ff, "count");
    const adults = Array.from({ length: n }, (_, k) => ({ name: str(ff, `name${k}`), nidOrPassport: str(ff, `nid${k}`) }));
    return wf.checkIn(i, u, adults);
  });

export async function verifyPaymentAction(paymentId: string, bookingId: string, form: FormData) {
  const user = await requireUser("MANAGE_BOOKINGS");
  const path = `/admin/bookings/${bookingId}`;
  try {
    if (str(form, "decision") === "reject") await wf.rejectPayment(paymentId, str(form, "reason"), user.id);
    else await wf.verifyPayment(paymentId, int(form, "received"), user.id);
  } catch (e) {
    fail(path, e);
  }
  revalidatePath("/admin");
  redirect(path);
}

export async function blockDateAction(form: FormData) {
  const user = await requireUser("MANAGE_BOOKINGS");
  const date = str(form, "date");
  const reason = str(form, "reason");
  const back = `/admin/calendar?month=${date.slice(0, 7)}`;
  try {
    if (!reason) throw new RuleError("REASON_REQUIRED", "A reason is required to block a date");
    const d = new Date(`${date}T00:00:00Z`);
    if (str(form, "unblock")) {
      await prisma.dateBlock.deleteMany({ where: { tripDate: d } });
    } else {
      const open = await prisma.booking.count({ where: { tripDate: d, status: { in: ["PENDING_APPROVAL", "AWAITING_PAYMENT", "PAYMENT_SUBMITTED", "CONFIRMED_BALANCE_DUE", "CONFIRMED_PAID"] } } });
      if (open > 0 && str(form, "confirm") !== "yes") {
        throw new RuleError("HAS_BOOKINGS", `${open} booking(s) exist on ${date}. Tick the box to block anyway.`);
      }
      await prisma.dateBlock.upsert({ where: { tripDate: d }, update: { reason }, create: { tripDate: d, reason, createdBy: user.id } });
    }
    await prisma.auditLog.create({ data: { entity: "DateBlock", entityId: date, action: str(form, "unblock") ? "UNBLOCK" : "BLOCK", actor: user.id, reason } });
  } catch (e) {
    fail(back, e);
  }
  redirect(back);
}

export async function changeBookingAction(id: string, form: FormData) {
  const user = await requireUser("MANAGE_BOOKINGS");
  const bands = await prisma.ageBand.findMany({ orderBy: { minAge: "desc" } });
  const names = bands.map((b) => b.name);
  const b = await prisma.booking.findUniqueOrThrow({ where: { id } });
  const cabinIds = form.getAll("cabin").map(String);
  try {
    await wf.changeBooking(id, {
      tripDate: str(form, "tripDate") || undefined,
      guests: guestsFromForm(form, "g", names),
      foodGuests: b.type === "FULL_BOAT" ? guestsFromForm(form, "f", names) : undefined,
      cabinIds: b.type === "SHARED" ? cabinIds : undefined,
      guestsPerCabin: b.type === "SHARED" ? Object.fromEntries(cabinIds.map((c) => [c, int(form, `cg_${c}`)])) : undefined,
    }, user.id);
  } catch (e) {
    fail(`/admin/bookings/${id}/edit`, e);
  }
  revalidatePath(`/admin/bookings/${id}`);
  redirect(`/admin/bookings/${id}`);
}

// ---------- settings (admin only) ----------

export async function saveBankAccountAction(form: FormData) {
  const user = await requireUser("ADMIN_SETTINGS");
  const data = {
    bank: str(form, "bank"), branch: str(form, "branch"), accountName: str(form, "accountName"),
    accountNo: str(form, "accountNo"), routingNo: str(form, "routingNo"),
  };
  const id = str(form, "id");
  try {
    if (Object.values(data).some((v) => !v)) throw new RuleError("REQUIRED", "All bank fields are required");
    const makeDefault = str(form, "isDefault") === "on";
    const acct = id
      ? await prisma.bankAccount.update({ where: { id }, data: { ...data, active: str(form, "active") === "on" } })
      : await prisma.bankAccount.create({ data: { ...data, isDefault: false } });
    if (makeDefault) {
      await prisma.$transaction([
        prisma.bankAccount.updateMany({ data: { isDefault: false } }),
        prisma.bankAccount.update({ where: { id: acct.id }, data: { isDefault: true, active: true } }),
      ]);
    }
    await prisma.auditLog.create({ data: { entity: "BankAccount", entityId: acct.id, action: id ? "UPDATED" : "CREATED", actor: user.id } });
  } catch (e) {
    fail("/admin/settings/bank", e);
  }
  revalidatePath("/admin/settings/bank");
  redirect("/admin/settings/bank");
}
