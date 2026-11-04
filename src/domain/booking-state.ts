import { addHours, dhakaInstant, addDays } from "./dates";
import { RuleError, type BookingStatus, type ISODate, type Settings } from "./types";

export type BookingEvent =
  | "APPROVE"
  | "REJECT"
  | "HOLD_EXPIRED"
  | "PROOF_UPLOADED"
  | "PROOF_REJECTED"
  | "ADVANCE_VERIFIED"
  | "FULL_VERIFIED"
  | "BALANCE_VERIFIED"
  | "CHECK_IN"
  | "CHECK_OUT"
  | "CANCEL"
  | "NO_SHOW";

const T: Record<BookingStatus, Partial<Record<BookingEvent, BookingStatus>>> = {
  PENDING_APPROVAL: {
    APPROVE: "AWAITING_PAYMENT",
    REJECT: "REJECTED",
    HOLD_EXPIRED: "EXPIRED",
    CANCEL: "CANCELLED",
  },
  AWAITING_PAYMENT: {
    PROOF_UPLOADED: "PAYMENT_SUBMITTED",
    HOLD_EXPIRED: "EXPIRED",
    CANCEL: "CANCELLED",
  },
  PAYMENT_SUBMITTED: {
    ADVANCE_VERIFIED: "CONFIRMED_BALANCE_DUE",
    FULL_VERIFIED: "CONFIRMED_PAID",
    PROOF_REJECTED: "AWAITING_PAYMENT",
    CANCEL: "CANCELLED",
  },
  CONFIRMED_BALANCE_DUE: {
    BALANCE_VERIFIED: "CONFIRMED_PAID",
    CANCEL: "CANCELLED",
    NO_SHOW: "NO_SHOW",
  },
  CONFIRMED_PAID: { CHECK_IN: "CHECKED_IN", CANCEL: "CANCELLED", NO_SHOW: "NO_SHOW" },
  CHECKED_IN: { CHECK_OUT: "COMPLETED" },
  COMPLETED: {},
  REJECTED: {},
  EXPIRED: {},
  CANCELLED: {},
  NO_SHOW: {},
};

export function transition(from: BookingStatus, event: BookingEvent): BookingStatus {
  const to = T[from][event];
  if (!to) throw new RuleError("BAD_TRANSITION", `Cannot ${event} a booking that is ${from}`);
  return to;
}

/** Statuses whose cabin_night rows are kept (cabins held). */
export const HOLDING_STATUSES: BookingStatus[] = [
  "PENDING_APPROVAL",
  "AWAITING_PAYMENT",
  "PAYMENT_SUBMITTED",
  "CONFIRMED_BALANCE_DUE",
  "CONFIRMED_PAID",
  "CHECKED_IN",
];

export const RELEASED_STATUSES: BookingStatus[] = ["REJECTED", "EXPIRED", "CANCELLED", "NO_SHOW"];

/** BR-10: new request holds cabins for the approval window. */
export function initialHoldExpiry(now: Date, s: Settings): Date {
  return addHours(now, s.approvalWindowHours);
}

/** BR-11: on approval the hold extends to the payment deadline. */
export function paymentDeadline(approvedAt: Date, s: Settings): Date {
  return addHours(approvedAt, s.paymentWindowHours);
}

/** BR-13: balance due `balanceLeadHours` before 13:00 boarding on the trip date. */
export function balanceDeadline(tripDate: ISODate, s: Settings): Date {
  return addHours(dhakaInstant(tripDate, 13), -s.balanceLeadHours);
}

/** Whether a holding booking has passed its deadline (BR-10/11/12). */
export function isHoldExpired(
  status: BookingStatus,
  holdExpiresAt: Date | null,
  now: Date,
): boolean {
  // BR-12: a submitted proof stops the clock until staff decide.
  if (status !== "PENDING_APPROVAL" && status !== "AWAITING_PAYMENT") return false;
  return holdExpiresAt !== null && holdExpiresAt.getTime() <= now.getTime();
}

/** BR-13 / FR-A18: check-in blocked until balance is fully verified. */
export function assertCanCheckIn(status: BookingStatus, balanceOutstanding: number): void {
  if (status !== "CONFIRMED_PAID" || balanceOutstanding > 0) {
    throw new RuleError("BALANCE_DUE", "Balance must be fully verified before check-in");
  }
}

/** BR-16: every adult needs NID/passport at check-in. */
export function assertAdultIds(adults: { nidOrPassport?: string | null }[]): void {
  if (adults.length === 0 || adults.some((a) => !a.nidOrPassport?.trim())) {
    throw new RuleError("NID_REQUIRED", "NID or passport required for every adult");
  }
}

/** Booking reference like MYL-261204-07 (date + daily sequence). */
export function makeReference(tripDate: ISODate, seq: number): string {
  const [y, m, d] = tripDate.split("-");
  return `MYL-${y.slice(2)}${m}${d}-${String(seq).padStart(2, "0")}`;
}

export { addDays };
