import type { DayType, ISODate } from "./types";

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000; // Asia/Dhaka is UTC+6, no DST (BR-20)

export function toDhakaDate(d: Date): ISODate {
  return new Date(d.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonths(date: ISODate, months: number): ISODate {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round(
    (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000,
  );
}

/** 0 = Sunday ... 6 = Saturday */
export function weekday(date: ISODate): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** BR-09: holiday -> Friday -> Thu/Sat -> Sun-Wed */
export function dayTypeOf(date: ISODate, holidays: Set<ISODate>): DayType {
  if (holidays.has(date)) return "HOLIDAY";
  const w = weekday(date);
  if (w === 5) return "FRIDAY";
  if (w === 4 || w === 6) return "THU_SAT";
  return "SUN_WED";
}

/** Instant of a Dhaka wall-clock time on a given date, e.g. boarding at 13:00. */
export function dhakaInstant(date: ISODate, hour: number, minute = 0): Date {
  return new Date(
    Date.parse(`${date}T00:00:00Z`) + (hour * 60 + minute) * 60_000 - DHAKA_OFFSET_MS,
  );
}

export function addHours(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * 3_600_000);
}
