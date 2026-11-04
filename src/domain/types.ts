export type ISODate = string; // "YYYY-MM-DD", calendar date in Asia/Dhaka

export type DayType = "HOLIDAY" | "FRIDAY" | "THU_SAT" | "SUN_WED";
export type PackageType = "SHARED" | "FULL_BOAT" | "FULL_BOAT_FOOD";
export type BookingType = "SHARED" | "FULL_BOAT";
export type PaymentOption = "FULL" | "ADVANCE";

export type BookingStatus =
  | "PENDING_APPROVAL"
  | "AWAITING_PAYMENT"
  | "PAYMENT_SUBMITTED"
  | "CONFIRMED_BALANCE_DUE"
  | "CONFIRMED_PAID"
  | "CHECKED_IN"
  | "COMPLETED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED"
  | "NO_SHOW";

export type Rates = Record<PackageType, Record<DayType, number>>;

export interface AgeBand {
  name: string;
  pctOfAdult: number; // 0..100
  isAdult: boolean;
}

export interface GuestCount {
  band: string; // AgeBand.name
  count: number;
}

export interface DateOverride {
  tripDate: ISODate;
  packageType: PackageType;
  amount: number;
}

export interface Settings {
  capacityCap: number;
  approvalWindowHours: number;
  paymentWindowHours: number;
  balanceLeadHours: number;
  cutoffDays: number;
  horizonMonths: number;
  advancePct: number;
  minBillablePerCabin: number; // 0 = off
  groupTierEnabled: boolean;
  groupTierMinGuests: number;
  groupTierRate: number;
}

export interface PricingConfig {
  rates: Rates;
  overrides: DateOverride[];
  holidays: Set<ISODate>;
  ageBands: AgeBand[];
  settings: Settings;
}

export interface CabinInfo {
  id: string;
  name: string;
  capacity: number;
  surcharge: number;
  active: boolean;
}

export type LineKind = "PACKAGE" | "FOOD" | "SURCHARGE" | "DISCOUNT";

export interface QuoteLine {
  kind: LineKind;
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface Quote {
  dayType: DayType;
  lines: QuoteLine[];
  total: number;
}

export class RuleError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "RuleError";
  }
}
