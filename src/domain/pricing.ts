import { dayTypeOf } from "./dates";
import {
  RuleError,
  type CabinInfo,
  type GuestCount,
  type ISODate,
  type PackageType,
  type PaymentOption,
  type PricingConfig,
  type Quote,
  type QuoteLine,
} from "./types";

/** BR-09: date override beats day-type rate. */
export function rateFor(cfg: PricingConfig, date: ISODate, pkg: PackageType): number {
  const ov = cfg.overrides.find((o) => o.tripDate === date && o.packageType === pkg);
  if (ov) return ov.amount;
  return cfg.rates[pkg][dayTypeOf(date, cfg.holidays)];
}

export function totalGuests(guests: GuestCount[]): number {
  return guests.reduce((n, g) => n + g.count, 0);
}

function bandPct(cfg: PricingConfig, band: string): number {
  const b = cfg.ageBands.find((x) => x.name === band);
  if (!b) throw new RuleError("UNKNOWN_AGE_BAND", `Unknown age band: ${band}`);
  return b.pctOfAdult;
}

export interface SharedQuoteInput {
  date: ISODate;
  /** Selected cabins with the number of guests staying in each. */
  cabins: (CabinInfo & { guests: number })[];
  guests: GuestCount[];
  discount?: { amount: number; reason: string };
}

/** Shared package: guests x per-guest rate (by band) + cabin surcharges - discount (§6.4). */
export function quoteShared(cfg: PricingConfig, input: SharedQuoteInput): Quote {
  const { date, cabins, guests } = input;
  const dayType = dayTypeOf(date, cfg.holidays);
  const lines: QuoteLine[] = [];

  let rate = rateFor(cfg, date, "SHARED");
  const n = totalGuests(guests);
  const s = cfg.settings;
  if (s.groupTierEnabled && n >= s.groupTierMinGuests) rate = Math.min(rate, s.groupTierRate);

  for (const g of guests) {
    if (g.count === 0) continue;
    const pct = bandPct(cfg, g.band);
    const unit = Math.round((rate * pct) / 100);
    lines.push({
      kind: "PACKAGE",
      description: `Shared package, ${g.band}`,
      qty: g.count,
      unitPrice: unit,
      total: unit * g.count,
    });
  }

  // Optional per-cabin minimum billable guests (billed at the full adult rate).
  if (s.minBillablePerCabin > 0) {
    const shortfall = cabins.reduce(
      (sum, c) => sum + Math.max(0, Math.min(s.minBillablePerCabin, c.capacity) - c.guests),
      0,
    );
    if (shortfall > 0) {
      lines.push({
        kind: "PACKAGE",
        description: "Cabin minimum guests",
        qty: shortfall,
        unitPrice: rate,
        total: rate * shortfall,
      });
    }
  }

  for (const c of cabins) {
    if (c.surcharge > 0) {
      lines.push({
        kind: "SURCHARGE",
        description: `Cabin surcharge, ${c.name}`,
        qty: 1,
        unitPrice: c.surcharge,
        total: c.surcharge,
      });
    }
  }

  return finish(dayType, lines, input.discount);
}

export interface FullBoatQuoteInput {
  date: ISODate;
  /** Guests per band who take the food package (BR-07). */
  foodGuests: GuestCount[];
  discount?: { amount: number; reason: string };
}

/** Full boat: boat rate + food guests x food rate (by band) - discount. */
export function quoteFullBoat(cfg: PricingConfig, input: FullBoatQuoteInput): Quote {
  const { date, foodGuests } = input;
  const dayType = dayTypeOf(date, cfg.holidays);
  const boat = rateFor(cfg, date, "FULL_BOAT");
  const lines: QuoteLine[] = [
    { kind: "PACKAGE", description: "Full boat", qty: 1, unitPrice: boat, total: boat },
  ];
  const food = rateFor(cfg, date, "FULL_BOAT_FOOD");
  for (const g of foodGuests) {
    if (g.count === 0) continue;
    const unit = Math.round((food * bandPct(cfg, g.band)) / 100);
    lines.push({
      kind: "FOOD",
      description: `Food package, ${g.band}`,
      qty: g.count,
      unitPrice: unit,
      total: unit * g.count,
    });
  }
  return finish(dayType, lines, input.discount);
}

function finish(
  dayType: Quote["dayType"],
  lines: QuoteLine[],
  discount?: { amount: number; reason: string },
): Quote {
  if (discount && discount.amount > 0) {
    if (!discount.reason.trim()) throw new RuleError("DISCOUNT_REASON", "Discount requires a reason");
    lines.push({
      kind: "DISCOUNT",
      description: `Discount: ${discount.reason}`,
      qty: 1,
      unitPrice: -discount.amount,
      total: -discount.amount,
    });
  }
  const total = lines.reduce((n, l) => n + l.total, 0);
  return { dayType, lines, total: Math.max(0, total) };
}

/** Split a total into the amount due now and the balance (§6.5). */
export function splitPayment(
  total: number,
  option: PaymentOption,
  advancePct: number,
): { dueNow: number; balance: number } {
  if (option === "FULL") return { dueNow: total, balance: 0 };
  const dueNow = Math.round((total * advancePct) / 100);
  return { dueNow, balance: total - dueNow };
}
