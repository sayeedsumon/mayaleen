import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { createBooking } from "@/server/booking-service";
import { loadPricingConfig } from "@/server/config";
import * as wf from "@/server/workflow-service";
import * as s from "@/server/settings-service";
import { totp } from "@/server/auth/totp";
import { verifyPassword } from "@/server/auth/password";
import { resetBookings } from "./helpers";

const NOW = new Date("2026-12-01T06:00:00Z");
const lead = { name: "Nusrat", mobile: "01819204511", nid: "1985000000001" };
const adults = (n: number) => [{ band: "Adult", count: n }];
const fullBoat = (date = "2026-12-08", n = 8) =>
  createBooking({ type: "FULL_BOAT", tripDate: date, channel: "STAFF", lead, guests: adults(n), foodGuests: adults(n), now: NOW });

beforeEach(async () => {
  await resetBookings();
  await prisma.loginAttempt.deleteMany();
});

afterAll(async () => {
  // put seed state back for other test files
  await prisma.rateRule.deleteMany({ where: { effectiveFrom: { gt: new Date("2020-01-02") } } });
  await prisma.boatSetting.deleteMany({ where: { effectiveFrom: { gt: new Date("2020-01-02") } } });
  await prisma.dateRateOverride.deleteMany();
  await prisma.holiday.deleteMany({ where: { name: { startsWith: "Test" } } });
  await prisma.user.deleteMany({ where: { mobile: { in: ["01911000001", "01911000002"] } } });
  await prisma.cabin.deleteMany({ where: { name: "Cabin T" } });
});

describe("discount at booking time (FR-A11)", () => {
  it("staff can discount with a reason; it is a priced line", async () => {
    const b = await createBooking({
      type: "FULL_BOAT", tripDate: "2026-12-08", channel: "STAFF", lead, guests: adults(4), foodGuests: [],
      discount: { amount: 5000, reason: "Repeat guest" }, now: NOW,
    });
    expect(b.quote.total).toBe(50000);
    const lines = await prisma.bookingLine.findMany({ where: { bookingId: b.id } });
    expect(lines.find((l) => l.kind === "DISCOUNT")).toMatchObject({ total: -5000, description: "Discount: Repeat guest" });
  });
  it("online bookings cannot carry a discount", async () => {
    await expect(createBooking({
      type: "FULL_BOAT", tripDate: "2026-12-08", channel: "ONLINE", lead, guests: adults(4), foodGuests: [],
      discount: { amount: 5000, reason: "x" }, now: NOW,
    })).rejects.toMatchObject({ code: "NO_DISCOUNT" });
  });
});

describe("invoice editing (reviseInvoice)", () => {
  it("replaces lines, keeps the invoice number, bumps the revision", async () => {
    const b = await fullBoat();
    const inv1 = await wf.approveBooking(b.id, "m", { paymentOption: "ADVANCE", now: NOW });
    const inv2 = await wf.reviseInvoice(b.id, {
      paymentOption: "ADVANCE",
      lines: [
        { kind: "PACKAGE", description: "Full boat", qty: 1, unitPrice: 55000 },
        { kind: "FOOD", description: "Food package, Adult", qty: 6, unitPrice: 2500 },
        { kind: "DISCOUNT", description: "Discount: Corporate rate", qty: 1, unitPrice: 5000 },
      ],
    }, "m", NOW);
    expect(inv2.number).toBe(inv1.number);
    expect(inv2.revision).toBe(2);
    expect(inv2.total).toBe(55000 + 15000 - 5000);
    expect(inv2.dueNow).toBe(32500);
  });
  it("needs a reason for a discount and refuses a negative total", async () => {
    const b = await fullBoat();
    await wf.approveBooking(b.id, "m", { now: NOW });
    await expect(wf.reviseInvoice(b.id, { paymentOption: "FULL", lines: [
      { kind: "PACKAGE", description: "Full boat", qty: 1, unitPrice: 1000 },
      { kind: "DISCOUNT", description: "Discount:", qty: 1, unitPrice: 10 },
    ] }, "m", NOW)).rejects.toMatchObject({ code: "DISCOUNT_REASON" });
    await expect(wf.reviseInvoice(b.id, { paymentOption: "FULL", lines: [
      { kind: "PACKAGE", description: "Full boat", qty: 1, unitPrice: 1000 },
      { kind: "DISCOUNT", description: "Discount: x", qty: 1, unitPrice: 2000 },
    ] }, "m", NOW)).rejects.toMatchObject({ code: "NEGATIVE_TOTAL" });
  });
  it("a paid booking whose invoice goes up returns to balance due", async () => {
    const b = await fullBoat();
    const inv = await wf.approveBooking(b.id, "m", { paymentOption: "FULL", now: NOW });
    await wf.recordManualPayment(b.id, { amount: inv.total }, "m", NOW);
    await wf.reviseInvoice(b.id, { paymentOption: "FULL", lines: [
      { kind: "PACKAGE", description: "Full boat", qty: 1, unitPrice: 55000 },
      { kind: "FOOD", description: "Food package, Adult", qty: 10, unitPrice: 2500 },
    ] }, "m", NOW);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("CONFIRMED_BALANCE_DUE");
  });
  it("custom deadlines move the hold for an unpaid booking", async () => {
    const b = await fullBoat();
    const inv = await wf.approveBooking(b.id, "m", { now: NOW });
    const due = new Date("2026-12-03T12:00:00Z");
    await wf.reviseInvoice(b.id, { paymentOption: "FULL", dueNowAt: due, lines: [{ kind: "PACKAGE", description: "Full boat", qty: 1, unitPrice: inv.total }] }, "m", NOW);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).holdExpiresAt?.toISOString()).toBe(due.toISOString());
  });
});

describe("check-in details", () => {
  it("records cabin per adult, emergency contact and the check-in time", async () => {
    const b = await fullBoat("2026-12-08", 2);
    const inv = await wf.approveBooking(b.id, "m", { paymentOption: "FULL", now: NOW });
    await wf.recordManualPayment(b.id, { amount: inv.total }, "m", NOW);
    await wf.checkIn(b.id, "d", [{ name: "A", nidOrPassport: "1234567890", cabin: "Cabin 1" }, { name: "B", nidOrPassport: "1234567891", cabin: "Cabin 2" }], NOW, { emergencyContact: "Mother 01700000001" });
    const bk = await prisma.booking.findUniqueOrThrow({ where: { id: b.id }, include: { guests: true, leadGuest: true } });
    expect(bk.checkedInAt?.toISOString()).toBe(NOW.toISOString());
    expect(bk.guests.map((g) => g.cabinName).sort()).toEqual(["Cabin 1", "Cabin 2"]);
    expect(bk.leadGuest.emergencyContact).toBe("Mother 01700000001");
    await wf.checkOut(b.id, "d", "Paddle cracked", NOW);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).checkoutNotes).toBe("Paddle cracked");
  });
});

describe("settings", () => {
  it("rates take effect from their date only (BR-18)", async () => {
    const r = (await loadPricingConfig(prisma)).rates;
    await s.saveRates("2027-01-01", { ...r, SHARED: { ...r.SHARED, SUN_WED: 8000 } }, "owner");
    expect((await loadPricingConfig(prisma, new Date("2026-12-15T00:00:00Z"))).rates.SHARED.SUN_WED).toBe(7800);
    expect((await loadPricingConfig(prisma, new Date("2027-01-02T00:00:00Z"))).rates.SHARED.SUN_WED).toBe(8000);
  });
  it("imports holidays and rejects bad lines", async () => {
    expect(await s.importHolidays("2027-06-01 Test One\n2027-06-02, Test Two", "gazette", "o")).toBe(2);
    await expect(s.importHolidays("June 3 Test", "gazette", "o")).rejects.toMatchObject({ code: "BAD_LINE" });
  });
  it("date overrides beat the day type", async () => {
    await s.saveOverride("2027-04-10", "SHARED", 12000, "o");
    const cfg = await loadPricingConfig(prisma);
    expect(cfg.overrides.find((o) => o.tripDate === "2027-04-10")?.amount).toBe(12000);
  });
  it("a cabin with future bookings cannot be switched off (FR-A21)", async () => {
    const b = await fullBoat("2026-12-20", 4);
    const cabin = await prisma.cabin.findFirstOrThrow({ orderBy: { sortOrder: "asc" } });
    await expect(s.saveCabin({ id: cabin.id, name: cabin.name, cabinTypeId: cabin.cabinTypeId, capacity: cabin.capacity, active: false }, "o", NOW))
      .rejects.toMatchObject({ code: "CABIN_IN_USE" });
    await wf.cancelBooking(b.id, "o", "test");
    const added = await s.saveCabin({ name: "Cabin T", cabinTypeId: cabin.cabinTypeId, capacity: 2, active: true }, "o", NOW);
    expect(added.capacity).toBe(2);
  });
  it("booking rules are validated and versioned", async () => {
    const base = await prisma.boatSetting.findFirstOrThrow({ orderBy: { effectiveFrom: "desc" } });
    const { id: _id, effectiveFrom: _e, ...rest } = base;
    await expect(s.saveRules({ ...rest, advancePct: 0 }, "o")).rejects.toMatchObject({ code: "BAD_SETTING" });
    await s.saveRules({ ...rest, approvalWindowHours: 6 }, "o", new Date());
    expect((await loadPricingConfig(prisma)).settings.approvalWindowHours).toBe(6);
  });
});

describe("staff, passwords, 2FA, lockout", () => {
  it("creates staff, refuses duplicates and weak passwords", async () => {
    await s.createStaff({ name: "Kamal", mobile: "01911000001", role: "FRONT_DESK", password: "long enough pw" }, "o");
    await expect(s.createStaff({ name: "K2", mobile: "01911000001", role: "FRONT_DESK", password: "long enough pw" }, "o")).rejects.toMatchObject({ code: "DUPLICATE" });
    await expect(s.createStaff({ name: "K3", mobile: "01911000002", role: "FRONT_DESK", password: "short" }, "o")).rejects.toMatchObject({ code: "WEAK_PASSWORD" });
  });
  it("keeps at least one owner", async () => {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN", active: true } });
    if (admins.length === 1) {
      await expect(s.updateStaff(admins[0].id, { role: "MANAGER", active: true }, "someone-else")).rejects.toMatchObject({ code: "LAST_ADMIN" });
    }
  });
  it("changes own password only with the current one", async () => {
    const u = await prisma.user.findUniqueOrThrow({ where: { mobile: "01911000001" } });
    await expect(s.changeOwnPassword(u.id, "wrong", "another long pw")).rejects.toMatchObject({ code: "BAD_PASSWORD" });
    await s.changeOwnPassword(u.id, "long enough pw", "another long pw");
    expect(verifyPassword("another long pw", (await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).pwHash)).toBe(true);
  });
  it("2FA turns on only after a correct code", async () => {
    const u = await prisma.user.findUniqueOrThrow({ where: { mobile: "01911000001" } });
    const secret = await s.startTotp(u.id);
    await expect(s.confirmTotp(u.id, "000000")).rejects.toMatchObject({ code: "BAD_CODE" });
    await s.confirmTotp(u.id, totp(secret));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).twoFaOn).toBe(true);
  });
  it("locks after 5 failed sign-ins and resets after the window", async () => {
    const t = new Date("2026-12-01T00:00:00Z");
    for (let i = 0; i < 5; i++) await s.recordFailedLogin("m:x", t);
    expect(await s.isLockedOut("m:x", t)).toBe(true);
    expect(await s.isLockedOut("m:x", new Date(t.getTime() + 11 * 60_000))).toBe(false);
    await s.clearLogin("m:x");
    expect(await s.isLockedOut("m:x", t)).toBe(false);
  });
});
