import { addDays, addMonths, diffDays } from "./dates";
import {
  RuleError,
  type BookingType,
  type CabinInfo,
  type GuestCount,
  type ISODate,
  type Settings,
} from "./types";

export type DateMode = "OPEN" | "SHARED" | "FULL_BOAT" | "BLOCKED";

export interface ExistingBooking {
  type: BookingType;
  cabinIds: string[];
}

export interface DateAvailability {
  mode: DateMode;
  freeCabinIds: string[];
  /** BR-04/06: shared bookings need >= 2 free cabins. */
  canBookShared: boolean;
  /** BR-02/03: full boat needs every active cabin free. */
  canBookFullBoat: boolean;
}

/**
 * Availability of one trip date from active cabins, held/confirmed bookings and blocks.
 * BR-01, BR-02, BR-03, BR-06.
 */
export function availabilityFor(
  activeCabins: CabinInfo[],
  existing: ExistingBooking[],
  blocked: boolean,
): DateAvailability {
  const active = activeCabins.filter((c) => c.active);
  if (blocked) {
    return { mode: "BLOCKED", freeCabinIds: [], canBookShared: false, canBookFullBoat: false };
  }
  const taken = new Set(existing.flatMap((b) => b.cabinIds));
  const free = active.filter((c) => !taken.has(c.id)).map((c) => c.id);
  const hasFull = existing.some((b) => b.type === "FULL_BOAT");

  const mode: DateMode = hasFull ? "FULL_BOAT" : taken.size > 0 ? "SHARED" : "OPEN";
  return {
    mode,
    freeCabinIds: free,
    canBookShared: !hasFull && free.length >= 2,
    canBookFullBoat: active.length > 0 && free.length === active.length,
  };
}

/** BR-14: online bookings open 12 months ahead, close `cutoffDays` before; staff until the trip date. */
export function checkBookingWindow(
  tripDate: ISODate,
  today: ISODate,
  settings: Settings,
  channel: "ONLINE" | "STAFF",
): void {
  if (channel === "STAFF") {
    if (tripDate < today) throw new RuleError("PAST_DATE", "Trip date is in the past");
    return;
  }
  if (diffDays(tripDate, today) < settings.cutoffDays) {
    throw new RuleError("CUTOFF", `Online booking closes ${settings.cutoffDays} days before the trip`);
  }
  if (tripDate > addMonths(today, settings.horizonMonths)) {
    throw new RuleError("HORIZON", `Online booking opens ${settings.horizonMonths} months ahead`);
  }
}

export interface SharedRequest {
  cabinIds: string[];
  /** Guests per selected cabin (cabinId -> count). */
  guestsPerCabin: Record<string, number>;
  guests: GuestCount[];
}

/** BR-04, BR-05, BR-02/03/06 for a shared request. Returns the chosen cabins. */
export function validateShared(
  activeCabins: CabinInfo[],
  avail: DateAvailability,
  req: SharedRequest,
  settings: Settings,
): CabinInfo[] {
  if (!avail.canBookShared) throw new RuleError("UNAVAILABLE", "Date not available for cabins");
  if (new Set(req.cabinIds).size !== req.cabinIds.length) {
    throw new RuleError("DUPLICATE_CABIN", "Duplicate cabin selected");
  }
  if (req.cabinIds.length < 2) throw new RuleError("MIN_CABINS", "Select at least 2 cabins");

  const chosen = req.cabinIds.map((id) => {
    const c = activeCabins.find((x) => x.id === id && x.active);
    if (!c) throw new RuleError("UNKNOWN_CABIN", `Cabin not found or inactive: ${id}`);
    if (!avail.freeCabinIds.includes(id)) {
      throw new RuleError("CABIN_TAKEN", `Cabin already booked: ${c.name}`);
    }
    return c;
  });

  const total = req.guests.reduce((n, g) => n + g.count, 0);
  if (total < 2) throw new RuleError("MIN_GUESTS", "At least 2 guests required");

  let seated = 0;
  for (const c of chosen) {
    const n = req.guestsPerCabin[c.id] ?? 0;
    if (n < 1) throw new RuleError("EMPTY_CABIN", `Cabin ${c.name} needs at least 1 guest`);
    if (n > c.capacity) throw new RuleError("CABIN_CAPACITY", `Cabin ${c.name} holds ${c.capacity}`);
    seated += n;
  }
  if (seated !== total) throw new RuleError("GUEST_MISMATCH", "Guests per cabin must add up to total guests");
  if (total > capacityOf(activeCabins, settings)) {
    throw new RuleError("BOAT_CAPACITY", "Exceeds boat capacity");
  }
  return chosen;
}

export interface FullBoatRequest {
  guests: GuestCount[];
  foodGuests: GuestCount[];
}

/** BR-02, BR-05, BR-07 for a full-boat request. Returns all active cabins. */
export function validateFullBoat(
  activeCabins: CabinInfo[],
  avail: DateAvailability,
  req: FullBoatRequest,
  settings: Settings,
): CabinInfo[] {
  if (!avail.canBookFullBoat) throw new RuleError("UNAVAILABLE", "Full boat not available on this date");
  const total = req.guests.reduce((n, g) => n + g.count, 0);
  const food = req.foodGuests.reduce((n, g) => n + g.count, 0);
  if (total < 1) throw new RuleError("MIN_GUESTS", "At least 1 guest required");
  if (total > capacityOf(activeCabins, settings)) {
    throw new RuleError("BOAT_CAPACITY", "Exceeds boat capacity");
  }
  if (food > total) throw new RuleError("FOOD_QTY", "Food packages cannot exceed guests");
  return activeCabins.filter((c) => c.active);
}

/** Boat capacity = sum of active cabin capacities, capped by the admin cap. */
export function capacityOf(cabins: CabinInfo[], settings: Settings): number {
  const sum = cabins.filter((c) => c.active).reduce((n, c) => n + c.capacity, 0);
  return Math.min(sum, settings.capacityCap);
}

/** Next `count` dates after `from` that still allow the wanted booking type (FR-W06). */
export function nearestDates(
  from: ISODate,
  count: number,
  isAvailable: (d: ISODate) => boolean,
  searchDays = 60,
): ISODate[] {
  const out: ISODate[] = [];
  for (let i = 1; i <= searchDays && out.length < count; i++) {
    const d = addDays(from, i);
    if (isAvailable(d)) out.push(d);
  }
  return out;
}
