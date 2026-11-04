import type { Prisma } from "@prisma/client";
import {
  RuleError, assertAdultIds, assertCanCheckIn, balanceDeadline, paymentDeadline,
  quoteFullBoat, splitPayment, toDhakaDate, transition,
  type BookingEvent, type GuestCount, type PaymentOption,
} from "@/domain";
import { evaluate } from "./booking-service";
import { dbDate, iso, loadPricingConfig } from "./config";
import { encryptField } from "./crypto";
import { prisma } from "./db";

type Tx = Prisma.TransactionClient;

async function audit(
  tx: Tx, entityId: string, action: string, actor: string,
  data: { before?: unknown; after?: unknown; reason?: string } = {},
) {
  await tx.auditLog.create({
    data: {
      entity: "Booking", entityId, action, actor, reason: data.reason,
      before: data.before as Prisma.InputJsonValue | undefined,
      after: data.after as Prisma.InputJsonValue | undefined,
    },
  });
}

async function lockBooking(tx: Tx, id: string) {
  // Serialise all workflow actions on one booking.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"booking:" + id}))`;
  return tx.booking.findUniqueOrThrow({
    where: { id },
    include: { lines: true, invoices: { orderBy: { revision: "desc" } }, nights: true },
  });
}

/** Sum of verified payments minus refunds across every invoice revision of a booking. */
export async function paidAmount(tx: Tx, bookingId: string): Promise<number> {
  const rows = await tx.payment.findMany({
    where: { invoice: { bookingId }, status: "VERIFIED" },
  });
  return rows.reduce((n, p) => n + (p.isRefund ? -1 : 1) * (p.amountReceived ?? 0), 0);
}

async function nextInvoiceNumber(tx: Tx, now: Date): Promise<string> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('invoice-number'))`;
  const year = toDhakaDate(now).slice(0, 4);
  const n = await tx.invoice.count({ where: { number: { startsWith: `INV-${year}-` } } });
  return `INV-${year}-${String(n + 1).padStart(4, "0")}`;
}

async function issueInvoice(
  tx: Tx,
  booking: Awaited<ReturnType<typeof lockBooking>>,
  opts: { now: Date; dueNowAt: Date; paid?: number },
) {
  const cfg = await loadPricingConfig(tx, opts.now);
  const total = Math.max(0, booking.lines.reduce((n, l) => n + l.total, 0));
  const { dueNow, balance } = splitPayment(total, booking.paymentOption, cfg.settings.advancePct);
  const bank =
    (await tx.bankAccount.findFirst({ where: { isDefault: true, active: true } })) ??
    (await tx.bankAccount.findFirstOrThrow({ where: { active: true } }));
  const prev = booking.invoices[0];
  if (prev) await tx.invoice.update({ where: { id: prev.id }, data: { status: "SUPERSEDED" } });
  return tx.invoice.create({
    data: {
      number: await nextInvoiceNumber(tx, opts.now),
      bookingId: booking.id,
      revision: (prev?.revision ?? 0) + 1,
      total, dueNow, dueNowAt: opts.dueNowAt, balance,
      balanceAt: balance > 0 ? balanceDeadline(iso(booking.tripDate), cfg.settings) : null,
      bankSnapshot: bank as unknown as Prisma.InputJsonValue,
    },
  });
}

async function releaseCabins(tx: Tx, bookingId: string) {
  await tx.cabinNight.deleteMany({ where: { bookingId } });
}

async function applyEvent(
  tx: Tx, bookingId: string, event: BookingEvent, actor: string,
  extra: Prisma.BookingUpdateInput = {}, reason?: string,
) {
  const b = await lockBooking(tx, bookingId);
  const to = transition(b.status, event);
  const updated = await tx.booking.update({ where: { id: bookingId }, data: { status: to, ...extra } });
  await audit(tx, bookingId, event, actor, { before: { status: b.status }, after: { status: to }, reason });
  return updated;
}

// ---------- Approval (FR-A06, FR-A11) ----------

export async function approveBooking(
  bookingId: string, actor: string,
  opts: { paymentOption?: PaymentOption; now?: Date } = {},
) {
  const now = opts.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const b = await lockBooking(tx, bookingId);
    const to = transition(b.status, "APPROVE");
    const cfg = await loadPricingConfig(tx, now);
    const dueNowAt = paymentDeadline(now, cfg.settings); // BR-11
    const option = opts.paymentOption ?? b.paymentOption;
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: to, paymentOption: option, holdExpiresAt: dueNowAt, paymentDueAt: dueNowAt,
        balanceDueAt: option === "ADVANCE" ? balanceDeadline(iso(b.tripDate), cfg.settings) : null,
      },
    });
    const invoice = await issueInvoice(tx, { ...b, paymentOption: option }, { now, dueNowAt, paid: 0 });
    await audit(tx, bookingId, "APPROVE", actor, { after: { invoice: invoice.number, total: invoice.total } });
    return invoice;
  });
}

export async function rejectBooking(bookingId: string, actor: string, reason: string) {
  if (!reason.trim()) throw new RuleError("REASON_REQUIRED", "A reason is required");
  return prisma.$transaction(async (tx) => {
    const b = await applyEvent(tx, bookingId, "REJECT", actor, { holdExpiresAt: null }, reason);
    await releaseCabins(tx, bookingId);
    return b;
  });
}

/** Guest chooses full/advance on the approved invoice until the first proof is uploaded (FR-W08). */
export async function choosePaymentOption(bookingId: string, option: PaymentOption, actor: string, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const b = await lockBooking(tx, bookingId);
    if (b.status !== "AWAITING_PAYMENT") {
      throw new RuleError("BAD_STATE", "Payment option can only change before the first proof");
    }
    const cfg = await loadPricingConfig(tx, now);
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        paymentOption: option,
        balanceDueAt: option === "ADVANCE" ? balanceDeadline(iso(b.tripDate), cfg.settings) : null,
      },
    });
    const dueNowAt = b.paymentDueAt ?? paymentDeadline(now, cfg.settings);
    const inv = await issueInvoice(tx, { ...b, paymentOption: option }, { now, dueNowAt, paid: 0 });
    await audit(tx, bookingId, "PAYMENT_OPTION", actor, { after: { option } });
    return inv;
  });
}

// ---------- Payments (FR-A12, FR-A13, FR-W09) ----------

export interface ProofInput {
  amountClaimed: number;
  txnId?: string;
  senderName?: string;
  senderBank?: string;
  transferAt?: Date;
  proofUrl?: string;
}

/** Guest (or staff) submits a bank-transfer proof. Pauses the deadline clock (BR-12). */
export async function submitProof(bookingId: string, input: ProofInput, actor: string) {
  if (!(input.amountClaimed > 0)) throw new RuleError("BAD_AMOUNT", "Amount must be positive");
  return prisma.$transaction(async (tx) => {
    const b = await lockBooking(tx, bookingId);
    const invoice = b.invoices[0];
    if (!invoice) throw new RuleError("NO_INVOICE", "No invoice issued yet");
    if (b.status === "AWAITING_PAYMENT") {
      await tx.booking.update({ where: { id: bookingId }, data: { status: transition(b.status, "PROOF_UPLOADED") } });
    } else if (b.status !== "CONFIRMED_BALANCE_DUE" && b.status !== "PAYMENT_SUBMITTED") {
      throw new RuleError("BAD_STATE", `Cannot submit proof while ${b.status}`);
    }
    const p = await tx.payment.create({ data: { invoiceId: invoice.id, ...input } });
    await audit(tx, bookingId, "PROOF_SUBMITTED", actor, { after: { paymentId: p.id, amount: input.amountClaimed } });
    return p;
  });
}

/** Is another payment (any booking) using the same transaction id? FR-A12 duplicate flag. */
export async function duplicateTxn(paymentId: string): Promise<boolean> {
  const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (!p.txnId) return false;
  return (await prisma.payment.count({ where: { txnId: p.txnId, id: { not: p.id }, status: { not: "REJECTED" } } })) > 0;
}

async function afterVerification(tx: Tx, bookingId: string, actor: string, now: Date) {
  const b = await lockBooking(tx, bookingId);
  const invoice = b.invoices[0];
  const paid = await paidAmount(tx, bookingId);
  const pending = await tx.payment.count({ where: { invoice: { bookingId }, status: "SUBMITTED" } });

  if (b.status === "PAYMENT_SUBMITTED") {
    if (paid >= invoice.total) return applyEvent(tx, bookingId, "FULL_VERIFIED", actor, { holdExpiresAt: null });
    if (paid >= invoice.dueNow && invoice.dueNow < invoice.total) {
      return applyEvent(tx, bookingId, "ADVANCE_VERIFIED", actor, { holdExpiresAt: null });
    }
    if (pending === 0) {
      // Split transfer still short: reopen the payment window (R-05).
      const cfg = await loadPricingConfig(tx, now);
      return applyEvent(tx, bookingId, "PROOF_REJECTED", actor, { holdExpiresAt: paymentDeadline(now, cfg.settings) }, "Partial payment");
    }
  } else if (b.status === "CONFIRMED_BALANCE_DUE" && paid >= invoice.total) {
    return applyEvent(tx, bookingId, "BALANCE_VERIFIED", actor);
  }
  return b;
}

/** Staff enter the amount actually received and mark the proof Verified (R-01). */
export async function verifyPayment(paymentId: string, amountReceived: number, actor: string, now = new Date()) {
  if (!(amountReceived > 0)) throw new RuleError("BAD_AMOUNT", "Amount received must be positive");
  return prisma.$transaction(async (tx) => {
    const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { invoice: true } });
    if (p.status !== "SUBMITTED") throw new RuleError("BAD_STATE", "Payment already decided");
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: "VERIFIED", amountReceived, verifiedBy: actor, verifiedAt: now },
    });
    await audit(tx, p.invoice.bookingId, "PAYMENT_VERIFIED", actor, { after: { paymentId, amountReceived } });
    return afterVerification(tx, p.invoice.bookingId, actor, now);
  });
}

export async function rejectPayment(paymentId: string, reason: string, actor: string, now = new Date()) {
  if (!reason.trim()) throw new RuleError("REASON_REQUIRED", "A reason is required");
  return prisma.$transaction(async (tx) => {
    const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { invoice: true } });
    if (p.status !== "SUBMITTED") throw new RuleError("BAD_STATE", "Payment already decided");
    await tx.payment.update({ where: { id: paymentId }, data: { status: "REJECTED", rejectReason: reason, verifiedBy: actor, verifiedAt: now } });
    await audit(tx, p.invoice.bookingId, "PAYMENT_REJECTED", actor, { reason });
    const b = await lockBooking(tx, p.invoice.bookingId);
    const pending = await tx.payment.count({ where: { invoice: { bookingId: b.id }, status: "SUBMITTED" } });
    if (b.status === "PAYMENT_SUBMITTED" && pending === 0) {
      const cfg = await loadPricingConfig(tx, now);
      return applyEvent(tx, b.id, "PROOF_REJECTED", actor, { holdExpiresAt: paymentDeadline(now, cfg.settings) }, reason);
    }
    return b;
  });
}

/** Staff record a bank payment the guest did not upload (FR-A13): created already verified. */
export async function recordManualPayment(
  bookingId: string,
  input: { amount: number; txnId?: string; transferAt?: Date; senderName?: string },
  actor: string,
  now = new Date(),
) {
  return prisma.$transaction(async (tx) => {
    const b = await lockBooking(tx, bookingId);
    const invoice = b.invoices[0];
    if (!invoice) throw new RuleError("NO_INVOICE", "No invoice issued yet");
    if (b.status === "AWAITING_PAYMENT") {
      await tx.booking.update({ where: { id: bookingId }, data: { status: "PAYMENT_SUBMITTED" } });
    } else if (b.status !== "CONFIRMED_BALANCE_DUE" && b.status !== "PAYMENT_SUBMITTED") {
      throw new RuleError("BAD_STATE", `Cannot record payment while ${b.status}`);
    }
    await tx.payment.create({
      data: {
        invoiceId: invoice.id, amountClaimed: input.amount, amountReceived: input.amount,
        txnId: input.txnId, transferAt: input.transferAt, senderName: input.senderName,
        status: "VERIFIED", verifiedBy: actor, verifiedAt: now,
      },
    });
    await audit(tx, bookingId, "MANUAL_PAYMENT", actor, { after: { amount: input.amount } });
    return afterVerification(tx, bookingId, actor, now);
  });
}

/** Refund recorded as a negative payment with a bank reference (FR-A10, BR-19). */
export async function recordRefund(
  bookingId: string, input: { amount: number; txnId: string; reason: string }, actor: string,
) {
  if (!(input.amount > 0)) throw new RuleError("BAD_AMOUNT", "Refund must be positive");
  return prisma.$transaction(async (tx) => {
    const b = await lockBooking(tx, bookingId);
    const invoice = b.invoices[0];
    if (!invoice) throw new RuleError("NO_INVOICE", "No invoice");
    if ((await paidAmount(tx, bookingId)) < input.amount) throw new RuleError("OVER_REFUND", "Refund exceeds amount paid");
    const p = await tx.payment.create({
      data: {
        invoiceId: invoice.id, amountClaimed: input.amount, amountReceived: input.amount, txnId: input.txnId,
        status: "VERIFIED", isRefund: true, verifiedBy: actor, verifiedAt: new Date(), rejectReason: input.reason,
      },
    });
    await audit(tx, bookingId, "REFUND", actor, { after: { amount: input.amount, txnId: input.txnId } , reason: input.reason });
    return p;
  });
}

// ---------- Cancel / no-show / deadlines (FR-A09, FR-A10) ----------

export async function cancelBooking(bookingId: string, actor: string, reason: string) {
  if (!reason.trim()) throw new RuleError("REASON_REQUIRED", "A reason is required");
  return prisma.$transaction(async (tx) => {
    const b = await applyEvent(tx, bookingId, "CANCEL", actor, { holdExpiresAt: null }, reason);
    await releaseCabins(tx, bookingId); // BR-19
    return b;
  });
}

export async function markNoShow(bookingId: string, actor: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const b = await applyEvent(tx, bookingId, "NO_SHOW", actor, {}, reason);
    await releaseCabins(tx, bookingId);
    return b;
  });
}

export async function extendDeadline(bookingId: string, newDeadline: Date, actor: string, reason: string) {
  if (!reason.trim()) throw new RuleError("REASON_REQUIRED", "A reason is required");
  return prisma.$transaction(async (tx) => {
    const b = await lockBooking(tx, bookingId);
    if (b.status !== "PENDING_APPROVAL" && b.status !== "AWAITING_PAYMENT") {
      throw new RuleError("BAD_STATE", "Only unpaid holds have a deadline to extend");
    }
    await tx.booking.update({
      where: { id: bookingId },
      data: { holdExpiresAt: newDeadline, paymentDueAt: b.status === "AWAITING_PAYMENT" ? newDeadline : b.paymentDueAt },
    });
    await audit(tx, bookingId, "DEADLINE_EXTENDED", actor, { before: { at: b.holdExpiresAt }, after: { at: newDeadline }, reason });
  });
}

// ---------- Food packages on full boat (FR-A15, BR-07/08) ----------

export async function setFoodPackages(bookingId: string, foodGuests: GuestCount[], actor: string, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const b = await lockBooking(tx, bookingId);
    if (b.type !== "FULL_BOAT") throw new RuleError("SHARED_FOOD", "Food is included on shared bookings (BR-08)");
    if (["REJECTED", "EXPIRED", "CANCELLED", "NO_SHOW", "COMPLETED"].includes(b.status)) {
      throw new RuleError("BAD_STATE", "Booking is closed");
    }
    const guests = await tx.bookingGuest.count({ where: { bookingId } });
    const food = foodGuests.reduce((n, g) => n + g.count, 0);
    if (food > guests) throw new RuleError("FOOD_QTY", "Food packages cannot exceed guests");
    const cfg = await loadPricingConfig(tx, now);
    const q = quoteFullBoat(cfg, { date: iso(b.tripDate), foodGuests });
    // Frozen price lines: keep package/discount lines, replace food lines.
    await tx.bookingLine.deleteMany({ where: { bookingId, kind: "FOOD" } });
    await tx.bookingLine.createMany({ data: q.lines.filter((l) => l.kind === "FOOD").map((l) => ({ ...l, bookingId })) });
    const fresh = await lockBooking(tx, bookingId);
    let invoice = fresh.invoices[0];
    if (invoice) {
      invoice = await issueInvoice(tx, fresh, { now, dueNowAt: invoice.dueNowAt, paid: 0 });
    }
    await audit(tx, bookingId, "FOOD_CHANGED", actor, { after: { foodGuests, total: invoice?.total } });
    return invoice;
  });
}

// ---------- Check-in / out (FR-A17..A20) ----------

export async function checkIn(
  bookingId: string, actor: string,
  adults: { name: string; nidOrPassport: string }[],
  now = new Date(),
) {
  return prisma.$transaction(async (tx) => {
    const b = await lockBooking(tx, bookingId);
    const invoice = b.invoices[0];
    const outstanding = invoice ? invoice.total - (await paidAmount(tx, bookingId)) : 1;
    assertCanCheckIn(b.status, outstanding); // BR-13
    assertAdultIds(adults); // BR-16
    const cfg = await loadPricingConfig(tx, now);
    const adultBands = cfg.ageBands.filter((x) => x.isAdult).map((x) => x.name);
    await tx.bookingGuest.deleteMany({ where: { bookingId, ageBandName: { in: adultBands } } });
    await tx.bookingGuest.createMany({
      data: adults.map((a, i) => ({
        bookingId, name: a.name, nidOrPassport: encryptField(a.nidOrPassport.trim()), ageBandName: adultBands[0] ?? "Adult", isLead: i === 0,
      })),
    });
    return applyEvent(tx, bookingId, "CHECK_IN", actor, {}, `Checked in ${adults.length} adults`);
  });
}

export async function checkOut(bookingId: string, actor: string, notes?: string) {
  return prisma.$transaction((tx) => applyEvent(tx, bookingId, "CHECK_OUT", actor, notes ? { notes } : {}));
}

// ---------- Change a booking (FR-A08) ----------

export interface BookingChange {
  tripDate?: string;
  guests: GuestCount[];
  cabinIds?: string[];
  guestsPerCabin?: Record<string, number>;
  foodGuests?: GuestCount[];
}

const CHANGEABLE = ["PENDING_APPROVAL", "AWAITING_PAYMENT", "CONFIRMED_BALANCE_DUE", "CONFIRMED_PAID"];

/**
 * Staff change date, cabins, guests or food. Availability is re-checked and the booking re-priced;
 * if an invoice exists a revised one is issued, and the payment status follows the new total.
 */
export async function changeBooking(bookingId: string, change: BookingChange, actor: string, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const b = await lockBooking(tx, bookingId);
    if (!CHANGEABLE.includes(b.status)) {
      throw new RuleError("BAD_STATE", `Cannot change a booking that is ${b.status}`);
    }
    const oldDate = iso(b.tripDate);
    const newDate = change.tripDate ?? oldDate;
    for (const d of [...new Set([oldDate, newDate])].sort()) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${d}))`;
    }
    const { cfg, quote, rows } = await evaluate(
      tx,
      { type: b.type, tripDate: newDate, channel: "STAFF", guests: change.guests, cabinIds: change.cabinIds, guestsPerCabin: change.guestsPerCabin, foodGuests: change.foodGuests },
      now, toDhakaDate(now), bookingId,
    );

    const discounts = b.lines.filter((l) => l.kind === "DISCOUNT");
    await tx.bookingLine.deleteMany({ where: { bookingId, kind: { not: "DISCOUNT" } } });
    await tx.bookingLine.createMany({ data: quote.lines.map((l) => ({ ...l, bookingId })) });

    await tx.cabinNight.deleteMany({ where: { bookingId } });
    await tx.cabinNight.createMany({
      data: rows.map((r) => ({ bookingId, cabinId: r.cabinId, tripDate: dbDate(newDate), guests: r.guests })),
    });

    await tx.bookingGuest.deleteMany({ where: { bookingId } });
    let first = true;
    for (const g of change.guests) {
      for (let i = 0; i < g.count; i++) {
        await tx.bookingGuest.create({ data: { bookingId, ageBandName: g.band, isLead: first } });
        first = false;
      }
    }

    await tx.booking.update({
      where: { id: bookingId },
      data: {
        tripDate: dbDate(newDate),
        balanceDueAt: b.paymentOption === "ADVANCE" ? balanceDeadline(newDate, cfg.settings) : null,
      },
    });

    const fresh = await lockBooking(tx, bookingId);
    const oldTotal = b.invoices[0]?.total ?? null;
    let newTotal = Math.max(0, quote.total + discounts.reduce((n, l) => n + l.total, 0));
    if (fresh.invoices[0]) {
      const inv = await issueInvoice(tx, fresh, { now, dueNowAt: fresh.invoices[0].dueNowAt });
      newTotal = inv.total;
      // Status follows the revised amount (R-04: re-quote when dates/rates move).
      const paid = await paidAmount(tx, bookingId);
      if (b.status === "CONFIRMED_PAID" && paid < inv.total) {
        await tx.booking.update({ where: { id: bookingId }, data: { status: "CONFIRMED_BALANCE_DUE" } });
      } else if (b.status === "CONFIRMED_BALANCE_DUE" && paid >= inv.total) {
        await tx.booking.update({ where: { id: bookingId }, data: { status: "CONFIRMED_PAID" } });
      }
    }
    await audit(tx, bookingId, "CHANGED", actor, {
      before: { tripDate: oldDate, total: oldTotal },
      after: { tripDate: newDate, total: newTotal, cabins: rows.map((r) => r.cabinId) },
    });
    return { total: newTotal, previousTotal: oldTotal };
  });
}
