import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { blindIndex, decryptField, encryptField } from "@/server/crypto";
import { createBooking } from "@/server/booking-service";
import { checkIn, approveBooking, recordManualPayment } from "@/server/workflow-service";
import { searchBookings } from "@/server/queries";
import { resetBookings } from "./helpers";

const NOW = new Date("2026-12-01T06:00:00Z");

describe("field encryption (NFR-06)", () => {
  it("round-trips and never stores plaintext", () => {
    const e = encryptField("1990123456789");
    expect(e).not.toContain("1990123456789");
    expect(decryptField(e)).toBe("1990123456789");
    expect(encryptField("x")).not.toBe(encryptField("x")); // random IV
  });
  it("detects tampering", () => {
    const e = encryptField("secret");
    const bad = e.slice(0, -2) + (e.endsWith("A") ? "BB" : "AA");
    expect(() => decryptField(bad)).toThrow();
  });
  it("passes legacy plaintext through and handles null", () => {
    expect(decryptField("legacy")).toBe("legacy");
    expect(decryptField(null)).toBeNull();
  });
  it("blind index is stable and case/space-insensitive", () => {
    expect(blindIndex(" ab123 ")).toBe(blindIndex("AB123"));
    expect(blindIndex("a")).not.toBe(blindIndex("b"));
  });
});

describe("NID storage", () => {
  beforeEach(resetBookings);

  it("lead and adult NIDs are encrypted in the database but searchable by exact NID", async () => {
    const b = await createBooking({
      type: "FULL_BOAT", tripDate: "2026-12-08", channel: "STAFF", now: NOW,
      lead: { name: "Rafi", mobile: "01712345678", nid: "1990123456789" },
      guests: [{ band: "Adult", count: 2 }], foodGuests: [],
    });
    const g = await prisma.guest.findFirstOrThrow({ where: { mobile: "01712345678" } });
    expect(g.nid).toMatch(/^enc1:/);
    expect(decryptField(g.nid)).toBe("1990123456789");

    expect((await searchBookings({ q: "1990123456789" })).total).toBe(1);
    expect((await searchBookings({ q: "199012345" })).total).toBe(0); // no partial NID matching

    const inv = await approveBooking(b.id, "m", { paymentOption: "FULL", now: NOW });
    await recordManualPayment(b.id, { amount: inv.total }, "m", NOW);
    await checkIn(b.id, "d", [{ name: "A", nidOrPassport: "NID-A" }, { name: "B", nidOrPassport: "PASS-B" }]);
    const rows = await prisma.bookingGuest.findMany({ where: { bookingId: b.id, nidOrPassport: { not: null } } });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.nidOrPassport!.startsWith("enc1:"))).toBe(true);
    expect(rows.map((r) => decryptField(r.nidOrPassport)).sort()).toEqual(["NID-A", "PASS-B"]);
  });
});
