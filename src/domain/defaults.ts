import type { AgeBand, PricingConfig, Rates, Settings } from "./types";

/** Launch rates from PRD §6.2. Seed data and test fixtures both use these. */
export const DEFAULT_RATES: Rates = {
  SHARED: { SUN_WED: 7800, THU_SAT: 8800, FRIDAY: 9800, HOLIDAY: 9800 },
  FULL_BOAT: { SUN_WED: 55000, THU_SAT: 65000, FRIDAY: 75000, HOLIDAY: 75000 },
  FULL_BOAT_FOOD: { SUN_WED: 2500, THU_SAT: 2500, FRIDAY: 2500, HOLIDAY: 2500 },
};

export const DEFAULT_SETTINGS: Settings = {
  capacityCap: 16,
  approvalWindowHours: 12,
  paymentWindowHours: 24,
  balanceLeadHours: 24,
  cutoffDays: 2,
  horizonMonths: 12,
  advancePct: 50,
  minBillablePerCabin: 0,
  groupTierEnabled: false,
  groupTierMinGuests: 0,
  groupTierRate: 6800,
};

/** Assumed until the owner confirms (PRD §19). */
export const DEFAULT_AGE_BANDS: AgeBand[] = [
  { name: "Adult", pctOfAdult: 100, isAdult: true },
  { name: "Child 4-10", pctOfAdult: 50, isAdult: false },
  { name: "Infant 0-3", pctOfAdult: 0, isAdult: false },
];

export function defaultConfig(overrides: Partial<PricingConfig> = {}): PricingConfig {
  return {
    rates: DEFAULT_RATES,
    overrides: [],
    holidays: new Set(),
    ageBands: DEFAULT_AGE_BANDS,
    settings: DEFAULT_SETTINGS,
    ...overrides,
  };
}
