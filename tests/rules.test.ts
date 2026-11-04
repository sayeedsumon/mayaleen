import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS as S, availabilityFor, checkBookingWindow, validateShared, validateFullBoat,
  transition, isHoldExpired, balanceDeadline, assertCanCheckIn, assertAdultIds, makeReference,
  nearestDates, RuleError, type CabinInfo,
} from "@/domain";

const cabins: CabinInfo[] = ["c1", "c2", "c3", "c4"].map((id) => ({
  id, name: id, capacity: 4, surcharge: 0, active: true,
}));
const adults = (n: number) => [{ band: "Adult", count: n }];
const code = (fn: () => unknown) => {
  try { fn(); } catch (e) { return (e as RuleError).code; }
  return "OK";
};

describe("availability (BR-01..03, BR-06)", () => {
  it("open date allows both", () => {
    const a = availabilityFor(cabins, [], false);
    expect(a).toMatchObject({ mode: "OPEN", canBookShared: true, canBookFullBoat: true });
  });
  it("any cabin booking blocks the full boat (BR-03)", () => {
    const a = availabilityFor(cabins, [{ type: "SHARED", cabinIds: ["c1", "c2"] }], false);
    expect(a).toMatchObject({ mode: "SHARED", canBookFullBoat: false, canBookShared: true });
  });
  it("full boat holds every cabin (BR-02)", () => {
    const a = availabilityFor(cabins, [{ type: "FULL_BOAT", cabinIds: ["c1", "c2", "c3", "c4"] }], false);
    expect(a).toMatchObject({ mode: "FULL_BOAT", canBookShared: false, freeCabinIds: [] });
  });
  it("last single cabin is not sold (BR-06)", () => {
    const a = availabilityFor(cabins, [{ type: "SHARED", cabinIds: ["c1", "c2", "c3"] }], false);
    expect(a.canBookShared).toBe(false);
    expect(a.freeCabinIds).toEqual(["c4"]);
  });
  it("two remaining cabins are sellable", () => {
    const a = availabilityFor(cabins, [{ type: "SHARED", cabinIds: ["c1", "c2"] }], false);
    expect(a.canBookShared).toBe(true);
  });
  it("blocked date sells nothing", () => {
    const a = availabilityFor(cabins, [], true);
    expect(a).toMatchObject({ mode: "BLOCKED", canBookShared: false, canBookFullBoat: false });
  });
  it("inactive cabins are ignored", () => {
    const c = cabins.map((x) => (x.id === "c4" ? { ...x, active: false } : x));
    const a = availabilityFor(c, [], false);
    expect(a.freeCabinIds).toHaveLength(3);
    expect(a.canBookFullBoat).toBe(true);
  });
});

describe("shared validation (BR-04, BR-05)", () => {
  const avail = availabilityFor(cabins, [], false);
  const ok = { cabinIds: ["c1", "c2"], guestsPerCabin: { c1: 2, c2: 2 }, guests: adults(4) };
  it("accepts a valid request", () => expect(code(() => validateShared(cabins, avail, ok, S))).toBe("OK"));
  it("needs 2 cabins", () =>
    expect(code(() => validateShared(cabins, avail, { ...ok, cabinIds: ["c1"], guestsPerCabin: { c1: 4 } }, S))).toBe("MIN_CABINS"));
  it("needs 2 guests", () =>
    expect(code(() => validateShared(cabins, avail, { cabinIds: ["c1", "c2"], guestsPerCabin: { c1: 1 }, guests: adults(1) }, S))).toBe("MIN_GUESTS"));
  it("cabin capacity", () =>
    expect(code(() => validateShared(cabins, avail, { ...ok, guestsPerCabin: { c1: 5, c2: 1 }, guests: adults(6) }, S))).toBe("CABIN_CAPACITY"));
  it("rejects taken cabin", () => {
    const a = availabilityFor(cabins, [{ type: "SHARED", cabinIds: ["c1", "c2"] }], false);
    expect(code(() => validateShared(cabins, a, ok, S))).toBe("CABIN_TAKEN");
  });
  it("guest split must match total", () =>
    expect(code(() => validateShared(cabins, avail, { ...ok, guests: adults(3) }, S))).toBe("GUEST_MISMATCH"));
});

describe("full boat validation (BR-02, BR-05, BR-07)", () => {
  const avail = availabilityFor(cabins, [], false);
  it("ok", () =>
    expect(code(() => validateFullBoat(cabins, avail, { guests: adults(12), foodGuests: adults(12) }, S))).toBe("OK"));
  it("food cannot exceed guests", () =>
    expect(code(() => validateFullBoat(cabins, avail, { guests: adults(10), foodGuests: adults(11) }, S))).toBe("FOOD_QTY"));
  it("capacity", () =>
    expect(code(() => validateFullBoat(cabins, avail, { guests: adults(17), foodGuests: [] }, S))).toBe("BOAT_CAPACITY"));
  it("unavailable when a cabin is taken", () => {
    const a = availabilityFor(cabins, [{ type: "SHARED", cabinIds: ["c1", "c2"] }], false);
    expect(code(() => validateFullBoat(cabins, a, { guests: adults(4), foodGuests: [] }, S))).toBe("UNAVAILABLE");
  });
});

describe("booking window (BR-14)", () => {
  const today = "2026-12-01";
  it("online closes 2 days before", () => {
    expect(code(() => checkBookingWindow("2026-12-02", today, S, "ONLINE"))).toBe("CUTOFF");
    expect(code(() => checkBookingWindow("2026-12-03", today, S, "ONLINE"))).toBe("OK");
  });
  it("online opens 12 months ahead", () => {
    expect(code(() => checkBookingWindow("2027-12-01", today, S, "ONLINE"))).toBe("OK");
    expect(code(() => checkBookingWindow("2027-12-02", today, S, "ONLINE"))).toBe("HORIZON");
  });
  it("staff can book up to the trip date", () => {
    expect(code(() => checkBookingWindow("2026-12-01", today, S, "STAFF"))).toBe("OK");
    expect(code(() => checkBookingWindow("2026-11-30", today, S, "STAFF"))).toBe("PAST_DATE");
  });
});

describe("lifecycle (§8, BR-10..13)", () => {
  it("happy path with advance", () => {
    let s = transition("PENDING_APPROVAL", "APPROVE");
    s = transition(s, "PROOF_UPLOADED");
    s = transition(s, "ADVANCE_VERIFIED");
    expect(s).toBe("CONFIRMED_BALANCE_DUE");
    s = transition(s, "BALANCE_VERIFIED");
    s = transition(s, "CHECK_IN");
    expect(transition(s, "CHECK_OUT")).toBe("COMPLETED");
  });
  it("rejected proof returns to awaiting payment", () =>
    expect(transition("PAYMENT_SUBMITTED", "PROOF_REJECTED")).toBe("AWAITING_PAYMENT"));
  it("illegal transitions throw", () => {
    expect(code(() => transition("PENDING_APPROVAL", "CHECK_IN"))).toBe("BAD_TRANSITION");
    expect(code(() => transition("COMPLETED", "CANCEL"))).toBe("BAD_TRANSITION");
    expect(code(() => transition("EXPIRED", "APPROVE"))).toBe("BAD_TRANSITION");
  });
  it("uploading proof stops the clock (BR-12)", () => {
    const past = new Date(Date.now() - 1000);
    expect(isHoldExpired("AWAITING_PAYMENT", past, new Date())).toBe(true);
    expect(isHoldExpired("PAYMENT_SUBMITTED", past, new Date())).toBe(false);
  });
  it("balance due 24h before 13:00 boarding (BR-13, BR-20)", () => {
    // 13:00 Dhaka = 07:00 UTC; minus 24h
    expect(balanceDeadline("2026-12-10", S).toISOString()).toBe("2026-12-09T07:00:00.000Z");
  });
  it("check-in blocked while balance outstanding", () => {
    expect(code(() => assertCanCheckIn("CONFIRMED_BALANCE_DUE", 0))).toBe("BALANCE_DUE");
    expect(code(() => assertCanCheckIn("CONFIRMED_PAID", 100))).toBe("BALANCE_DUE");
    expect(code(() => assertCanCheckIn("CONFIRMED_PAID", 0))).toBe("OK");
  });
  it("every adult needs an ID (BR-16)", () => {
    expect(code(() => assertAdultIds([{ nidOrPassport: "123" }, { nidOrPassport: "" }]))).toBe("NID_REQUIRED");
    expect(code(() => assertAdultIds([{ nidOrPassport: "123" }]))).toBe("OK");
  });
  it("reference format", () => expect(makeReference("2026-12-04", 7)).toBe("MYL-261204-07"));
  it("nearest dates", () => {
    expect(nearestDates("2026-12-01", 3, (d) => d !== "2026-12-03")).toEqual(["2026-12-02", "2026-12-04", "2026-12-05"]);
  });
});
