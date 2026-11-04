"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { RuleError, type GuestCount, type PaymentOption } from "@/domain";
import { requireUser } from "@/server/auth/current-user";
import { can } from "@/server/auth/permissions";
import { createBooking } from "@/server/booking-service";
import { prisma } from "@/server/db";
import * as wf from "@/server/workflow-service";
import { dhakaLocal, fail, int, str, withParam } from "../_lib/form";

/** Payload the calendar's booking panel sends (one JSON field, built from its state). */
interface NewBookingPayload {
  tripDate: string;
  type: "SHARED" | "FULL_BOAT";
  cabinIds: string[];
  guestsPerCabin: Record<string, number>;
  guests: GuestCount[];
  foodGuests: GuestCount[];
  discount: number;
  discountReason: string;
  approve: boolean;
}

export async function createBookingAction(form: FormData) {
  const user = await requireUser("CREATE_BOOKING");
  let p: NewBookingPayload;
  try {
    p = JSON.parse(str(form, "payload"));
  } catch {
    fail("/admin/calendar", new RuleError("BAD_FORM", "The booking form was incomplete"));
  }
  const back = `/admin/calendar?month=${p.tripDate.slice(0, 7)}&day=${p.tripDate}`;
  let id: string;
  try {
    if (p.discount > 0 && !can(user.role, "MANAGE_BOOKINGS")) {
      throw new RuleError("NO_PERMISSION", "Only a manager or the owner can give a discount");
    }
    const b = await createBooking({
      type: p.type, tripDate: p.tripDate, channel: "STAFF",
      source: (str(form, "source") || "PHONE") as never,
      lead: { name: str(form, "name"), mobile: str(form, "mobile").replace(/[^0-9+]/g, ""), email: str(form, "email") || undefined, nid: str(form, "nid") },
      guests: p.guests.filter((g) => g.count > 0),
      foodGuests: p.type === "FULL_BOAT" ? p.foodGuests.filter((g) => g.count > 0) : undefined,
      cabinIds: p.type === "SHARED" ? p.cabinIds : undefined,
      guestsPerCabin: p.type === "SHARED" ? p.guestsPerCabin : undefined,
      discount: p.discount > 0 ? { amount: p.discount, reason: p.discountReason || "Staff discount" } : undefined,
      notes: str(form, "notes") || undefined,
    });
    id = b.id;
    if (p.approve) {
      if (!can(user.role, "MANAGE_BOOKINGS")) throw new RuleError("NO_PERMISSION", "Only a manager can approve");
      await wf.approveBooking(id, user.id, { paymentOption: (str(form, "paymentOption") || "ADVANCE") as PaymentOption });
    }
  } catch (e) {
    fail(back, e);
  }
  revalidatePath("/admin");
  redirect(`/admin/bookings/${id}?ok=${encodeURIComponent(p.approve ? "Booking created and invoice issued" : "Booking created. Cabins are held for approval.")}`);
}

type Act = (id: string, f: FormData, uid: string) => Promise<unknown>;

async function act(cap: "MANAGE_BOOKINGS" | "VIEW_OPERATIONS" | "CREATE_BOOKING", id: string, form: FormData, fn: Act, okMsg: string) {
  const user = await requireUser(cap);
  const path = str(form, "back") || `/admin/bookings/${id}`;
  try {
    await fn(id, form, user.id);
  } catch (e) {
    fail(path, e);
  }
  revalidatePath("/admin", "layout");
  redirect(withParam(path, "ok", okMsg));
}

export async function approveAction(id: string, f: FormData) {
  return act("MANAGE_BOOKINGS", id, f, (i, ff, u) => wf.approveBooking(i, u, { paymentOption: (str(ff, "paymentOption") || undefined) as PaymentOption | undefined }), "Approved. Invoice sent to the guest.");
}
export async function rejectAction(id: string, f: FormData) {
  return act("MANAGE_BOOKINGS", id, f, (i, ff, u) => wf.rejectBooking(i, u, str(ff, "reason")), "Booking rejected and cabins released.");
}
export async function cancelAction(id: string, f: FormData) {
  return act("MANAGE_BOOKINGS", id, f, (i, ff, u) => wf.cancelBooking(i, u, str(ff, "reason")), "Booking cancelled and cabins released.");
}
export async function noShowAction(id: string, f: FormData) {
  return act("MANAGE_BOOKINGS", id, f, (i, ff, u) => wf.markNoShow(i, u, str(ff, "reason") || "Guests did not arrive"), "Marked as no-show.");
}
export async function extendAction(id: string, f: FormData) {
  return act("MANAGE_BOOKINGS", id, f, (i, ff, u) => {
    const until = dhakaLocal(str(ff, "until"));
    if (!until) throw new RuleError("BAD_DATE", "Pick the new deadline");
    return wf.extendDeadline(i, until, u, str(ff, "reason"));
  }, "Deadline extended.");
}
export async function foodAction(id: string, f: FormData) {
  return act("MANAGE_BOOKINGS", id, f, async (i, ff, u) => {
    const bands = await prisma.ageBand.findMany({ orderBy: { minAge: "desc" } });
    return wf.setFoodPackages(i, bands.map((b, k) => ({ band: b.name, count: int(ff, `f${k}`) })).filter((g) => g.count > 0), u);
  }, "Food packages updated and invoice revised.");
}

export async function changeBookingAction(id: string, form: FormData) {
  const user = await requireUser("MANAGE_BOOKINGS");
  const bands = await prisma.ageBand.findMany({ orderBy: { minAge: "desc" } });
  const b = await prisma.booking.findUniqueOrThrow({ where: { id } });
  const cabinIds = form.getAll("cabin").map(String);
  try {
    await wf.changeBooking(id, {
      tripDate: str(form, "tripDate") || undefined,
      guests: bands.map((x, i) => ({ band: x.name, count: int(form, `g${i}`) })).filter((g) => g.count > 0),
      foodGuests: b.type === "FULL_BOAT" ? bands.map((x, i) => ({ band: x.name, count: int(form, `f${i}`) })).filter((g) => g.count > 0) : undefined,
      cabinIds: b.type === "SHARED" ? cabinIds : undefined,
      guestsPerCabin: b.type === "SHARED" ? Object.fromEntries(cabinIds.map((c) => [c, int(form, `cg_${c}`)])) : undefined,
    }, user.id);
  } catch (e) {
    fail(`/admin/bookings/${id}/edit`, e);
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/bookings/${id}?ok=${encodeURIComponent("Booking changed. A revised invoice was issued if needed.")}`);
}

export async function blockDateAction(form: FormData) {
  const user = await requireUser("MANAGE_BOOKINGS");
  const date = str(form, "date");
  const back = `/admin/calendar?month=${date.slice(0, 7)}&day=${date}`;
  const unblock = str(form, "unblock") === "1";
  try {
    const d = new Date(`${date}T00:00:00Z`);
    if (unblock) {
      await prisma.dateBlock.deleteMany({ where: { tripDate: d } });
    } else {
      const reason = str(form, "reason");
      if (!reason) throw new RuleError("REASON_REQUIRED", "Say why the date is blocked");
      const open = await prisma.booking.count({ where: { tripDate: d, status: { in: ["PENDING_APPROVAL", "AWAITING_PAYMENT", "PAYMENT_SUBMITTED", "CONFIRMED_BALANCE_DUE", "CONFIRMED_PAID"] } } });
      if (open > 0 && str(form, "confirm") !== "yes") {
        throw new RuleError("HAS_BOOKINGS", `${open} booking(s) exist on ${date}. Tick "block anyway" to confirm.`);
      }
      await prisma.dateBlock.upsert({ where: { tripDate: d }, update: { reason }, create: { tripDate: d, reason, createdBy: user.id } });
    }
    await prisma.auditLog.create({ data: { entity: "DateBlock", entityId: date, action: unblock ? "UNBLOCK" : "BLOCK", actor: user.id, reason: str(form, "reason") || null } });
  } catch (e) {
    fail(back, e);
  }
  revalidatePath("/admin", "layout");
  redirect(withParam(back, "ok", unblock ? "Date unblocked" : "Date blocked"));
}
