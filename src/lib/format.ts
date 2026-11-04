export const tk = (n: number) => `Tk ${n.toLocaleString("en-US")}`;

const dt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
});
const d = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "short", year: "numeric" });

export const fmtDateTime = (x: Date | null | undefined) => (x ? dt.format(x) : "-");
/** Calendar date (stored at UTC midnight) */
export const fmtDate = (x: Date | string) => d.format(typeof x === "string" ? new Date(`${x}T00:00:00Z`) : x);

/** "in 3h 20m" / "overdue 1h" relative to now, for hold countdowns. */
export function countdown(to: Date | null | undefined, now = new Date()): string {
  if (!to) return "-";
  const mins = Math.round((to.getTime() - now.getTime()) / 60_000);
  const abs = Math.abs(mins);
  const s = abs >= 60 ? `${Math.floor(abs / 60)}h ${abs % 60}m` : `${abs}m`;
  return mins >= 0 ? `in ${s}` : `overdue ${s}`;
}

export const STATUS_LABEL: Record<string, string> = {
  PENDING_APPROVAL: "Pending approval",
  AWAITING_PAYMENT: "Awaiting payment",
  PAYMENT_SUBMITTED: "Payment submitted",
  CONFIRMED_BALANCE_DUE: "Confirmed, balance due",
  CONFIRMED_PAID: "Confirmed, paid",
  CHECKED_IN: "Checked in",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};

export const STATUS_COLOR: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-100 text-amber-800",
  AWAITING_PAYMENT: "bg-orange-100 text-orange-800",
  PAYMENT_SUBMITTED: "bg-blue-100 text-blue-800",
  CONFIRMED_BALANCE_DUE: "bg-lime-100 text-lime-800",
  CONFIRMED_PAID: "bg-green-100 text-green-800",
  CHECKED_IN: "bg-teal-100 text-teal-800",
  COMPLETED: "bg-slate-200 text-slate-700",
  REJECTED: "bg-red-100 text-red-700",
  EXPIRED: "bg-slate-100 text-slate-500",
  CANCELLED: "bg-red-100 text-red-700",
  NO_SHOW: "bg-red-100 text-red-700",
};
