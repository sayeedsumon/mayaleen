import type { Prisma, PrismaClient } from "@prisma/client";
import type { CabinInfo, DayType, PackageType, PricingConfig, Rates } from "@/domain";

type Db = PrismaClient | Prisma.TransactionClient;

export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const dbDate = (s: string) => new Date(`${s}T00:00:00Z`);

export async function loadCabins(db: Db): Promise<CabinInfo[]> {
  const cabins = await db.cabin.findMany({ include: { cabinType: true }, orderBy: { sortOrder: "asc" } });
  return cabins.map((c) => ({
    id: c.id, name: c.name, capacity: c.capacity, surcharge: c.cabinType.surcharge, active: c.active,
  }));
}

/** Latest rate per (package, day type) effective on `asOf` (BR-18: history is kept). */
export async function loadPricingConfig(db: Db, asOf = new Date()): Promise<PricingConfig> {
  const [rules, overrides, holidays, bands, settings] = await Promise.all([
    db.rateRule.findMany({ where: { effectiveFrom: { lte: asOf } }, orderBy: { effectiveFrom: "asc" } }),
    db.dateRateOverride.findMany(),
    db.holiday.findMany(),
    db.ageBand.findMany({ orderBy: { minAge: "desc" } }),
    db.boatSetting.findFirstOrThrow({ where: { effectiveFrom: { lte: asOf } }, orderBy: { effectiveFrom: "desc" } }),
  ]);
  const rates = {} as Rates;
  for (const r of rules) {
    rates[r.packageType as PackageType] ??= {} as Record<DayType, number>;
    rates[r.packageType as PackageType][r.dayType as DayType] = r.amount; // later rows win
  }
  return {
    rates,
    overrides: overrides.map((o) => ({ tripDate: iso(o.tripDate), packageType: o.packageType, amount: o.amount })),
    holidays: new Set(holidays.map((h) => iso(h.date))),
    ageBands: bands.map((b) => ({ name: b.name, pctOfAdult: b.pctOfAdult, isAdult: b.isAdult })),
    settings: {
      capacityCap: settings.capacityCap,
      approvalWindowHours: settings.approvalWindowHours,
      paymentWindowHours: settings.paymentWindowHours,
      balanceLeadHours: settings.balanceLeadHours,
      cutoffDays: settings.cutoffDays,
      horizonMonths: settings.horizonMonths,
      advancePct: settings.advancePct,
      minBillablePerCabin: settings.minBillablePerCabin,
      groupTierEnabled: settings.groupTierEnabled,
      groupTierMinGuests: settings.groupTierMinGuests,
      groupTierRate: settings.groupTierRate,
    },
  };
}
