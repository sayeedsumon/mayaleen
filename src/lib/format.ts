export const tk = (n: number) => `Tk ${Math.round(n).toLocaleString("en-US")}`;

const dt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
});
const dtY = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
});
const tm = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", hour12: false });
const dShort = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const dLong = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
const dMid = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

const asDate = (x: Date | string) => (typeof x === "string" ? new Date(`${x.slice(0, 10)}T00:00:00Z`) : x);

/** Instants (deadlines, logs), shown in Asia/Dhaka. */
export const fmtDateTime = (x: Date | null | undefined, withYear = false) => (x ? (withYear ? dtY : dt).format(x) : "–");
export const fmtTime = (x: Date | null | undefined) => (x ? tm.format(x) : "–");
/** Calendar trip dates (stored at UTC midnight). */
export const fmtDate = (x: Date | string) => dShort.format(asDate(x));
export const fmtDateLong = (x: Date | string) => dLong.format(asDate(x));
export const fmtDateMid = (x: Date | string) => dMid.format(asDate(x));

/** "in 3 h 20 m" / "overdue 1 h" for hold countdowns. */
export function countdown(to: Date | null | undefined, now = new Date()): string {
  if (!to) return "–";
  const mins = Math.round((to.getTime() - now.getTime()) / 60_000);
  const abs = Math.abs(mins);
  const s = abs >= 1440 ? `${Math.floor(abs / 1440)} d ${Math.floor((abs % 1440) / 60)} h` : abs >= 60 ? `${Math.floor(abs / 60)} h ${abs % 60} m` : `${abs} m`;
  return mins >= 0 ? `in ${s}` : `overdue ${s}`;
}

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
export const maskId = (id: string | null | undefined) => (id ? `•••• ${id.replace(/\s/g, "").slice(-4)}` : "–");
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const SOURCE_LABEL: Record<string, string> = {
  WEBSITE: "Website", PHONE: "Phone", FACEBOOK: "Facebook", WALK_IN: "Walk-in", OTHER: "Other",
};
export const DAYTYPE_LABEL: Record<string, string> = {
  SUN_WED: "Sun–Wed", THU_SAT: "Thu / Sat", FRIDAY: "Friday", HOLIDAY: "Holiday",
};
