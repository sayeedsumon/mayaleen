import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { resetBookings } from "./helpers";
import { createBooking, expireHolds, SlotTakenError } from "@/server/booking-service";

const NOW = new Date("2026-12-01T06:00:00Z");
const lead = (n = 1) => ({ name: `Guest ${n}`, mobile: `0171234567${n}`, nid: `19900000000${n}` });
const adults = (n: number) => [{ band: "Adult", count: n }];

async function cabinIds() {
  return (await prisma.cabin.findMany({ orderBy: { sortOrder: "asc" } })).map((c) => c.id);
}

beforeEach(resetBookings);

describe("createBooking", () => {
  it("creates a shared booking, holds cabins, prices it, sets a 12h hold", async () => {
    const [c1, c2] = await cabinIds();
    const b = await createBooking({
      type: "SHARED", tripDate: "2026-12-08", channel: "ONLINE", lead: lead(),
      guests: adults(6), cabinIds: [c1, c2], guestsPerCabin: { [c1]: 3, [c2]: 3 }, now: NOW,
    });
    expect(b.quote.total).toBe(46800);
    expect(b.reference).toBe("MYL-261208-01");
    expect(b.holdExpiresAt.toISOString()).toBe("2026-12-01T18:00:00.000Z");
    expect(await prisma.cabinNight.count()).toBe(2);
  });

  it("BR-03: shared booking makes the full boat unavailable", async () => {
    const [c1, c2] = await cabinIds();
    await createBooking({
      type: "SHARED", tripDate: "2026-12-08", channel: "ONLINE", lead: lead(),
      guests: adults(4), cabinIds: [c1, c2], guestsPerCabin: { [c1]: 2, [c2]: 2 }, now: NOW,
    });
    await expect(
      createBooking({ type: "FULL_BOAT", tripDate: "2026-12-08", channel: "ONLINE", lead: lead(2), guests: adults(8), now: NOW }),
    ).rejects.toBeInstanceOf(SlotTakenError);
  });

  it("BR-02: full boat takes every cabin and returns nearest alternatives when refused", async () => {
    await createBooking({ type: "FULL_BOAT", tripDate: "2026-12-08", channel: "ONLINE", lead: lead(), guests: adults(12), foodGuests: adults(12), now: NOW });
    expect(await prisma.cabinNight.count()).toBe(4);
    const [c1, c2] = await cabinIds();
    const err = await createBooking({
      type: "SHARED", tripDate: "2026-12-08", channel: "ONLINE", lead: lead(2),
      guests: adults(4), cabinIds: [c1, c2], guestsPerCabin: { [c1]: 2, [c2]: 2 }, now: NOW,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(SlotTakenError);
    expect(err.alternatives).toEqual(["2026-12-09", "2026-12-10", "2026-12-11"]);
  });

  it("BR-06: the last single cabin is never sold", async () => {
    const [c1, c2, c3, c4] = await cabinIds();
    await createBooking({
      type: "SHARED", tripDate: "2026-12-08", channel: "ONLINE", lead: lead(),
      guests: adults(6), cabinIds: [c1, c2, c3], guestsPerCabin: { [c1]: 2, [c2]: 2, [c3]: 2 }, now: NOW,
    });
    await expect(
      createBooking({
        type: "SHARED", tripDate: "2026-12-08", channel: "ONLINE", lead: lead(2),
        guests: adults(2), cabinIds: [c4], guestsPerCabin: { [c4]: 2 }, now: NOW,
      }),
    ).rejects.toBeInstanceOf(SlotTakenError);
  });

  it("blocked dates cannot be booked on any channel", async () => {
    await prisma.dateBlock.create({ data: { tripDate: new Date("2026-12-08T00:00:00Z"), reason: "Maintenance" } });
    await expect(
      createBooking({ type: "FULL_BOAT", tripDate: "2026-12-08", channel: "STAFF", lead: lead(), guests: adults(4), now: NOW }),
    ).rejects.toMatchObject({ code: "BLOCKED" });
  });

  it("enforces the online cut-off but lets staff book closer in (BR-14)", async () => {
    await expect(
      createBooking({ type: "FULL_BOAT", tripDate: "2026-12-02", channel: "ONLINE", lead: lead(), guests: adults(4), now: NOW }),
    ).rejects.toMatchObject({ code: "CUTOFF" });
    await expect(
      createBooking({ type: "FULL_BOAT", tripDate: "2026-12-02", channel: "STAFF", lead: lead(), guests: adults(4), now: NOW }),
    ).resolves.toBeTruthy();
  });

  it("requires a valid BD mobile and lead NID (BR-16)", async () => {
    await expect(
      createBooking({ type: "FULL_BOAT", tripDate: "2026-12-08", channel: "ONLINE", lead: { ...lead(), mobile: "123" }, guests: adults(4), now: NOW }),
    ).rejects.toMatchObject({ code: "BAD_MOBILE" });
    await expect(
      createBooking({ type: "FULL_BOAT", tripDate: "2026-12-08", channel: "ONLINE", lead: { ...lead(), nid: " " }, guests: adults(4), now: NOW }),
    ).rejects.toMatchObject({ code: "NID_REQUIRED" });
  });

  it("expired holds release cabins (BR-10/19)", async () => {
    const [c1, c2] = await cabinIds();
    const input = {
      type: "SHARED" as const, tripDate: "2026-12-08", channel: "ONLINE" as const, lead: lead(),
      guests: adults(4), cabinIds: [c1, c2], guestsPerCabin: { [c1]: 2, [c2]: 2 },
    };
    await createBooking({ ...input, now: NOW });
    expect(await expireHolds(new Date("2026-12-01T17:59:00Z"))).toBe(0);
    expect(await expireHolds(new Date("2026-12-01T18:01:00Z"))).toBe(1);
    expect(await prisma.cabinNight.count()).toBe(0);
    await expect(createBooking({ ...input, lead: lead(2), now: NOW })).resolves.toBeTruthy();
  });
});

describe("NFR-02: concurrency race", () => {
  it("20 simultaneous requests for the same date: exactly one wins", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        createBooking({ type: "FULL_BOAT", tripDate: "2026-12-10", channel: "ONLINE", lead: lead(i % 10), guests: adults(8), now: NOW }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected" && r.reason instanceof SlotTakenError)).toHaveLength(19);
    expect(await prisma.booking.count()).toBe(1);
    expect(await prisma.cabinNight.count()).toBe(4);
  });

  it("racing shared requests for overlapping cabins: no cabin sold twice", async () => {
    const [c1, c2, c3] = await cabinIds();
    const mk = (cabs: string[], i: number) =>
      createBooking({
        type: "SHARED", tripDate: "2026-12-11", channel: "ONLINE", lead: lead(i),
        guests: adults(cabs.length * 2), cabinIds: cabs, guestsPerCabin: Object.fromEntries(cabs.map((c) => [c, 2])), now: NOW,
      });
    const res = await Promise.allSettled([mk([c1, c2], 1), mk([c2, c3], 2), mk([c1, c3], 3), mk([c1, c2], 4)]);
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rows = await prisma.cabinNight.findMany({ where: { tripDate: new Date("2026-12-11T00:00:00Z") } });
    expect(new Set(rows.map((r) => r.cabinId)).size).toBe(rows.length);
  });
});
