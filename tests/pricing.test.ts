import { describe, expect, it } from "vitest";
import { defaultConfig, dayTypeOf, quoteFullBoat, quoteShared, splitPayment, RuleError } from "@/domain";

const cabin = (id: string, guests: number, surcharge = 0) => ({
  id, name: id, capacity: 4, surcharge, active: true, guests,
});

describe("day type (BR-09)", () => {
  const hol = new Set(["2026-12-16"]); // a Wednesday
  it("holiday beats weekday", () => expect(dayTypeOf("2026-12-16", hol)).toBe("HOLIDAY"));
  it("Friday", () => expect(dayTypeOf("2026-12-04", hol)).toBe("FRIDAY"));
  it("Thursday and Saturday", () => {
    expect(dayTypeOf("2026-12-03", hol)).toBe("THU_SAT");
    expect(dayTypeOf("2026-12-05", hol)).toBe("THU_SAT");
  });
  it("Sunday to Wednesday", () => {
    for (const d of ["2026-12-06", "2026-12-07", "2026-12-08", "2026-12-09"]) {
      expect(dayTypeOf(d, hol)).toBe("SUN_WED");
    }
  });
  it("holiday on a Friday stays HOLIDAY", () => {
    expect(dayTypeOf("2026-12-04", new Set(["2026-12-04"]))).toBe("HOLIDAY");
  });
});

describe("PRD §6.4 examples", () => {
  const cfg = defaultConfig({ holidays: new Set(["2026-12-16"]) });

  it("shared, 6 adults, Tuesday = 46,800", () => {
    const q = quoteShared(cfg, {
      date: "2026-12-08",
      cabins: [cabin("a", 3), cabin("b", 3)],
      guests: [{ band: "Adult", count: 6 }],
    });
    expect(q.total).toBe(46800);
  });
  it("shared, 10 adults, Saturday = 88,000", () => {
    const q = quoteShared(cfg, {
      date: "2026-12-05",
      cabins: [cabin("a", 4), cabin("b", 3), cabin("c", 3)],
      guests: [{ band: "Adult", count: 10 }],
    });
    expect(q.total).toBe(88000);
  });
  it("full boat, 12 adults with food, Thursday = 95,000", () => {
    const q = quoteFullBoat(cfg, { date: "2026-12-03", foodGuests: [{ band: "Adult", count: 12 }] });
    expect(q.total).toBe(95000);
  });
  it("full boat, 16 adults with food, holiday = 115,000", () => {
    const q = quoteFullBoat(cfg, { date: "2026-12-16", foodGuests: [{ band: "Adult", count: 16 }] });
    expect(q.total).toBe(115000);
  });
});

describe("pricing options", () => {
  it("date override beats day type", () => {
    const cfg = defaultConfig({
      overrides: [{ tripDate: "2026-12-08", packageType: "SHARED", amount: 12000 }],
    });
    const q = quoteShared(cfg, {
      date: "2026-12-08", cabins: [cabin("a", 1), cabin("b", 1)], guests: [{ band: "Adult", count: 2 }],
    });
    expect(q.total).toBe(24000);
  });
  it("child bands (BR-17)", () => {
    const q = quoteShared(defaultConfig(), {
      date: "2026-12-08",
      cabins: [cabin("a", 2), cabin("b", 2)],
      guests: [{ band: "Adult", count: 2 }, { band: "Child 4-10", count: 1 }, { band: "Infant 0-3", count: 1 }],
    });
    expect(q.total).toBe(2 * 7800 + 3900);
  });
  it("cabin surcharge", () => {
    const q = quoteShared(defaultConfig(), {
      date: "2026-12-08", cabins: [cabin("a", 1, 1000), cabin("b", 1)], guests: [{ band: "Adult", count: 2 }],
    });
    expect(q.total).toBe(15600 + 1000);
  });
  it("group tier lowers the rate, never raises it", () => {
    const base = defaultConfig().settings;
    const on = defaultConfig({ settings: { ...base, groupTierEnabled: true, groupTierMinGuests: 8 } });
    const q = quoteShared(on, {
      date: "2026-12-04", cabins: [cabin("a", 4), cabin("b", 4)], guests: [{ band: "Adult", count: 8 }],
    });
    expect(q.total).toBe(8 * 6800);
    const q2 = quoteShared(on, {
      date: "2026-12-04", cabins: [cabin("a", 2), cabin("b", 2)], guests: [{ band: "Adult", count: 4 }],
    });
    expect(q2.total).toBe(4 * 9800);
  });
  it("per-cabin minimum billable guests", () => {
    const base = defaultConfig().settings;
    const cfg = defaultConfig({ settings: { ...base, minBillablePerCabin: 2 } });
    const q = quoteShared(cfg, {
      date: "2026-12-08", cabins: [cabin("a", 1), cabin("b", 2)], guests: [{ band: "Adult", count: 3 }],
    });
    expect(q.total).toBe(4 * 7800);
  });
  it("discount requires a reason", () => {
    expect(() =>
      quoteFullBoat(defaultConfig(), {
        date: "2026-12-08", foodGuests: [], discount: { amount: 1000, reason: " " },
      }),
    ).toThrow(RuleError);
  });
  it("discount reduces the total", () => {
    const q = quoteFullBoat(defaultConfig(), {
      date: "2026-12-08", foodGuests: [], discount: { amount: 5000, reason: "Repeat guest" },
    });
    expect(q.total).toBe(50000);
  });
});

describe("splitPayment (§6.5)", () => {
  it("full", () => expect(splitPayment(46800, "FULL", 50)).toEqual({ dueNow: 46800, balance: 0 }));
  it("advance 50%", () => expect(splitPayment(95000, "ADVANCE", 50)).toEqual({ dueNow: 47500, balance: 47500 }));
  it("advance rounds, parts add up", () => {
    const s = splitPayment(10001, "ADVANCE", 50);
    expect(s.dueNow + s.balance).toBe(10001);
  });
});
