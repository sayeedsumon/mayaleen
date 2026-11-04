import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { resetBookings } from "./helpers";
import { createBooking } from "@/server/booking-service";
import * as wf from "@/server/workflow-service";

const NOW = new Date("2026-12-01T06:00:00Z");
const lead = { name: "Rafi", mobile: "01712345678", nid: "1990000000001" };
const adults = (n: number) => [{ band: "Adult", count: n }];

async function fullBoat(date = "2026-12-08", n = 8) {
  return createBooking({ type: "FULL_BOAT", tripDate: date, channel: "ONLINE", lead, guests: adults(n), foodGuests: adults(n), now: NOW });
}
const status = async (id: string) => (await prisma.booking.findUniqueOrThrow({ where: { id } })).status;

beforeEach(resetBookings);

describe("approval and invoice", () => {
  it("approve issues invoice and 24h payment clock (BR-11)", async () => {
    const b = await fullBoat();
    const inv = await wf.approveBooking(b.id, "mgr", { paymentOption: "ADVANCE", now: NOW });
    expect(inv.total).toBe(55000 + 8 * 2500);
    expect(inv.dueNow).toBe(37500);
    expect(inv.balance).toBe(37500);
    expect(inv.number).toBe("INV-2026-0001");
    const bk = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(bk.status).toBe("AWAITING_PAYMENT");
    expect(bk.holdExpiresAt!.toISOString()).toBe("2026-12-02T06:00:00.000Z");
    expect(bk.balanceDueAt!.toISOString()).toBe("2026-12-07T07:00:00.000Z");
  });

  it("reject needs a reason and releases cabins", async () => {
    const b = await fullBoat();
    await expect(wf.rejectBooking(b.id, "mgr", " ")).rejects.toMatchObject({ code: "REASON_REQUIRED" });
    await wf.rejectBooking(b.id, "mgr", "Boat in maintenance");
    expect(await status(b.id)).toBe("REJECTED");
    expect(await prisma.cabinNight.count()).toBe(0);
  });

  it("cannot approve twice", async () => {
    const b = await fullBoat();
    await wf.approveBooking(b.id, "mgr", { now: NOW });
    await expect(wf.approveBooking(b.id, "mgr", { now: NOW })).rejects.toMatchObject({ code: "BAD_TRANSITION" });
  });
});

describe("payment flow (BR-12, BR-13)", () => {
  it("advance -> confirmed balance due -> balance -> check-in", async () => {
    const b = await fullBoat();
    const inv = await wf.approveBooking(b.id, "mgr", { paymentOption: "ADVANCE", now: NOW });
    const p1 = await wf.submitProof(b.id, { amountClaimed: inv.dueNow, txnId: "TX1" }, "guest");
    expect(await status(b.id)).toBe("PAYMENT_SUBMITTED");
    await wf.verifyPayment(p1.id, inv.dueNow, "mgr", NOW);
    expect(await status(b.id)).toBe("CONFIRMED_BALANCE_DUE");

    // check-in blocked while balance is due
    await expect(wf.checkIn(b.id, "desk", [{ name: "A", nidOrPassport: "1" }])).rejects.toMatchObject({ code: "BALANCE_DUE" });

    const p2 = await wf.submitProof(b.id, { amountClaimed: inv.balance, txnId: "TX2" }, "guest");
    await wf.verifyPayment(p2.id, inv.balance, "mgr", NOW);
    expect(await status(b.id)).toBe("CONFIRMED_PAID");

    await expect(wf.checkIn(b.id, "desk", [{ name: "A", nidOrPassport: "" }])).rejects.toMatchObject({ code: "NID_REQUIRED" });
    await wf.checkIn(b.id, "desk", Array.from({ length: 8 }, (_, i) => ({ name: `G${i}`, nidOrPassport: `NID${i}` })));
    expect(await status(b.id)).toBe("CHECKED_IN");
    expect(await prisma.bookingGuest.count({ where: { bookingId: b.id, nidOrPassport: { not: null } } })).toBe(8);
    await wf.checkOut(b.id, "desk", "All fine");
    expect(await status(b.id)).toBe("COMPLETED");
  });

  it("full payment confirms straight to paid", async () => {
    const b = await fullBoat();
    const inv = await wf.approveBooking(b.id, "mgr", { paymentOption: "FULL", now: NOW });
    const p = await wf.submitProof(b.id, { amountClaimed: inv.total }, "guest");
    await wf.verifyPayment(p.id, inv.total, "mgr", NOW);
    expect(await status(b.id)).toBe("CONFIRMED_PAID");
  });

  it("amount received is entered by staff: short payment does not confirm (R-01, R-05)", async () => {
    const b = await fullBoat();
    const inv = await wf.approveBooking(b.id, "mgr", { paymentOption: "FULL", now: NOW });
    const p = await wf.submitProof(b.id, { amountClaimed: inv.total }, "guest");
    await wf.verifyPayment(p.id, 50000, "mgr", NOW);
    expect(await status(b.id)).toBe("AWAITING_PAYMENT");
    // split transfer: second transfer completes it
    const p2 = await wf.submitProof(b.id, { amountClaimed: inv.total - 50000 }, "guest");
    await wf.verifyPayment(p2.id, inv.total - 50000, "mgr", NOW);
    expect(await status(b.id)).toBe("CONFIRMED_PAID");
  });

  it("rejected proof returns to awaiting payment with fresh window", async () => {
    const b = await fullBoat();
    const inv = await wf.approveBooking(b.id, "mgr", { now: NOW });
    const p = await wf.submitProof(b.id, { amountClaimed: inv.total }, "guest");
    await wf.rejectPayment(p.id, "Not in bank", "mgr", new Date("2026-12-01T20:00:00Z"));
    const bk = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(bk.status).toBe("AWAITING_PAYMENT");
    expect(bk.holdExpiresAt!.toISOString()).toBe("2026-12-02T20:00:00.000Z");
  });

  it("flags duplicate transaction ids (FR-A12)", async () => {
    const b1 = await fullBoat("2026-12-08");
    const b2 = await fullBoat("2026-12-09");
    const i1 = await wf.approveBooking(b1.id, "mgr", { now: NOW });
    const i2 = await wf.approveBooking(b2.id, "mgr", { now: NOW });
    await wf.submitProof(b1.id, { amountClaimed: i1.total, txnId: "SAME" }, "g");
    const p2 = await wf.submitProof(b2.id, { amountClaimed: i2.total, txnId: "SAME" }, "g");
    expect(await wf.duplicateTxn(p2.id)).toBe(true);
  });

  it("payment option is locked after the first proof (FR-W08)", async () => {
    const b = await fullBoat();
    await wf.approveBooking(b.id, "mgr", { now: NOW });
    const inv = await wf.choosePaymentOption(b.id, "ADVANCE", "guest", NOW);
    expect(inv.revision).toBe(2);
    expect(inv.dueNow).toBe(Math.round(inv.total / 2));
    await wf.submitProof(b.id, { amountClaimed: 1000 }, "guest");
    await expect(wf.choosePaymentOption(b.id, "FULL", "guest", NOW)).rejects.toMatchObject({ code: "BAD_STATE" });
  });
});

describe("cancel, refunds, food, deadlines", () => {
  it("cancel releases cabins; refund is a negative payment", async () => {
    const b = await fullBoat();
    const inv = await wf.approveBooking(b.id, "mgr", { paymentOption: "FULL", now: NOW });
    const p = await wf.submitProof(b.id, { amountClaimed: inv.total }, "g");
    await wf.verifyPayment(p.id, inv.total, "mgr", NOW);
    await wf.cancelBooking(b.id, "mgr", "Guest request");
    expect(await prisma.cabinNight.count()).toBe(0);
    await expect(wf.recordRefund(b.id, { amount: inv.total + 1, txnId: "R", reason: "x" }, "mgr")).rejects.toMatchObject({ code: "OVER_REFUND" });
    await wf.recordRefund(b.id, { amount: 40000, txnId: "R1", reason: "Partial" }, "mgr");
    expect(await prisma.$transaction((tx) => wf.paidAmount(tx, b.id))).toBe(inv.total - 40000);
  });

  it("food change re-prices and revises the invoice (FR-A15)", async () => {
    const b = await fullBoat("2026-12-08", 8);
    await wf.approveBooking(b.id, "mgr", { now: NOW });
    const inv = await wf.setFoodPackages(b.id, adults(4), "mgr", NOW);
    expect(inv!.total).toBe(55000 + 4 * 2500);
    expect(inv!.revision).toBe(2);
    await expect(wf.setFoodPackages(b.id, adults(9), "mgr", NOW)).rejects.toMatchObject({ code: "FOOD_QTY" });
    const old = await prisma.invoice.findMany({ where: { bookingId: b.id }, orderBy: { revision: "asc" } });
    expect(old.map((i) => i.status)).toEqual(["SUPERSEDED", "ISSUED"]);
  });

  it("food not allowed on shared bookings (BR-08)", async () => {
    const [c1, c2] = (await prisma.cabin.findMany({ orderBy: { sortOrder: "asc" } })).map((c) => c.id);
    const b = await createBooking({
      type: "SHARED", tripDate: "2026-12-12", channel: "ONLINE", lead, guests: adults(4),
      cabinIds: [c1, c2], guestsPerCabin: { [c1]: 2, [c2]: 2 }, now: NOW,
    });
    await expect(wf.setFoodPackages(b.id, adults(1), "mgr", NOW)).rejects.toMatchObject({ code: "SHARED_FOOD" });
  });

  it("extend deadline requires a reason and moves the clock", async () => {
    const b = await fullBoat();
    await expect(wf.extendDeadline(b.id, new Date("2026-12-05T00:00:00Z"), "mgr", "")).rejects.toMatchObject({ code: "REASON_REQUIRED" });
    await wf.extendDeadline(b.id, new Date("2026-12-05T00:00:00Z"), "mgr", "Guest abroad");
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).holdExpiresAt!.toISOString()).toBe("2026-12-05T00:00:00.000Z");
  });

  it("every transition is audit-logged (FR-A27)", async () => {
    const b = await fullBoat();
    await wf.approveBooking(b.id, "mgr", { now: NOW });
    await wf.cancelBooking(b.id, "mgr", "test");
    const actions = (await prisma.auditLog.findMany({ where: { entityId: b.id }, orderBy: { at: "asc" } })).map((a) => a.action);
    expect(actions).toEqual(["CREATED", "APPROVE", "CANCEL"]);
  });
});
