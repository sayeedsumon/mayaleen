import type { BookingStatus, Prisma } from "@prisma/client";
import { addDays, availabilityFor, toDhakaDate, type BookingType, type DateMode, type ISODate } from "@/domain";
import { dbDate, iso, loadCabins } from "./config";
import { blindIndex } from "./crypto";
import { prisma } from "./db";
import { paidAmount } from "./workflow-service";

export const OPEN_STATUSES: BookingStatus[] = [
  "PENDING_APPROVAL", "AWAITING_PAYMENT", "PAYMENT_SUBMITTED",
  "CONFIRMED_BALANCE_DUE", "CONFIRMED_PAID", "CHECKED_IN",
];

const withLead = { leadGuest: true } satisfies Prisma.BookingInclude;

/** FR-A01: the action queue shown on login. */
export async function dashboard(now = new Date()) {
  const today = toDhakaDate(now);
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);
  const [pending, proofs, balances, checkIns, checkOuts] = await Promise.all([
    prisma.booking.findMany({ where: { status: "PENDING_APPROVAL" }, include: withLead, orderBy: { holdExpiresAt: "asc" } }),
    prisma.payment.findMany({
      where: { status: "SUBMITTED" },
      include: { invoice: { include: { booking: { include: withLead } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.booking.findMany({
      where: {
        status: "CONFIRMED_BALANCE_DUE",
        balanceDueAt: { lte: new Date(now.getTime() + 48 * 3_600_000) },
      },
      include: withLead,
      orderBy: { balanceDueAt: "asc" },
    }),
    prisma.booking.findMany({
      where: { tripDate: dbDate(today), status: { in: ["CONFIRMED_BALANCE_DUE", "CONFIRMED_PAID", "CHECKED_IN"] } },
      include: withLead,
    }),
    prisma.booking.findMany({ where: { tripDate: dbDate(yesterday), status: "CHECKED_IN" }, include: withLead }),
  ]);
  return { today, tomorrow, pending, proofs, balances, checkIns, checkOuts };
}

export interface CalendarDay {
  date: ISODate;
  mode: DateMode;
  cabinsSold: number;
  cabinsTotal: number;
  guests: number;
  holiday: string | null;
  bookings: { id: string; reference: string; status: BookingStatus; type: BookingType; lead: string }[];
  blockReason: string | null;
}

/** FR-A02: availability of every day of a month. `month` is "YYYY-MM". */
export async function monthCalendar(month: string): Promise<CalendarDay[]> {
  const first = `${month}-01`;
  const d = new Date(`${first}T00:00:00Z`);
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  const last = addDays(iso(next), -1);
  const [cabins, nights, blocks, holidays] = await Promise.all([
    loadCabins(prisma),
    prisma.cabinNight.findMany({
      where: { tripDate: { gte: dbDate(first), lte: dbDate(last) } },
      include: { booking: { include: withLead } },
    }),
    prisma.dateBlock.findMany({ where: { tripDate: { gte: dbDate(first), lte: dbDate(last) } } }),
    prisma.holiday.findMany({ where: { date: { gte: dbDate(first), lte: dbDate(last) } } }),
  ]);
  const blockBy = new Map(blocks.map((b) => [iso(b.tripDate), b.reason]));
  const holBy = new Map(holidays.map((h) => [iso(h.date), h.name]));
  const days: CalendarDay[] = [];
  for (let date = first; date <= last; date = addDays(date, 1)) {
    const dayNights = nights.filter((n) => iso(n.tripDate) === date);
    const by = new Map<string, CalendarDay["bookings"][number] & { cabinIds: string[]; guestCount: number }>();
    for (const n of dayNights) {
      const e = by.get(n.bookingId) ?? {
        id: n.bookingId, reference: n.booking.reference, status: n.booking.status, type: n.booking.type,
        lead: n.booking.leadGuest.name, cabinIds: [], guestCount: 0,
      };
      e.cabinIds.push(n.cabinId);
      e.guestCount += n.guests;
      by.set(n.bookingId, e);
    }
    const list = [...by.values()];
    const av = availabilityFor(cabins, list.map((b) => ({ type: b.type, cabinIds: b.cabinIds })), blockBy.has(date));
    days.push({
      date, mode: av.mode,
      cabinsSold: dayNights.length, cabinsTotal: cabins.filter((c) => c.active).length,
      guests: list.reduce((n, b) => n + b.guestCount, 0),
      holiday: holBy.get(date) ?? null,
      bookings: list.map(({ cabinIds: _c, guestCount: _g, ...b }) => b),
      blockReason: blockBy.get(date) ?? null,
    });
  }
  return days;
}

/** FR-A03: cabins x dates grid for a date range. */
export async function timeline(from: ISODate, days: number) {
  const to = addDays(from, days - 1);
  const [cabins, nights] = await Promise.all([
    prisma.cabin.findMany({ where: { active: true }, include: { cabinType: true }, orderBy: { sortOrder: "asc" } }),
    prisma.cabinNight.findMany({
      where: { tripDate: { gte: dbDate(from), lte: dbDate(to) } },
      include: { booking: { include: withLead } },
    }),
  ]);
  const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
  return { dates, cabins, nights };
}

export interface BookingSearch {
  q?: string;
  status?: BookingStatus;
  type?: BookingType;
  source?: string;
  from?: ISODate;
  to?: ISODate;
  page?: number;
}
const PAGE_SIZE = 25;

/** FR-A07: search by reference, name, mobile or NID; filter; paginate. */
export async function searchBookings(s: BookingSearch) {
  const q = s.q?.trim();
  const where: Prisma.BookingWhereInput = {
    ...(s.status && { status: s.status }),
    ...(s.type && { type: s.type }),
    ...(s.source && { source: s.source as never }),
    ...((s.from || s.to) && {
      tripDate: { ...(s.from && { gte: dbDate(s.from) }), ...(s.to && { lte: dbDate(s.to) }) },
    }),
    ...(q && {
      OR: [
        { reference: { contains: q, mode: "insensitive" } },
        { leadGuest: { name: { contains: q, mode: "insensitive" } } },
        { leadGuest: { mobile: { contains: q } } },
        { leadGuest: { nidHash: blindIndex(q) } }, // exact NID match only
      ],
    }),
  };
  const page = Math.max(1, s.page ?? 1);
  const [rows, total] = await Promise.all([
    prisma.booking.findMany({
      where, include: { leadGuest: true, invoices: { orderBy: { revision: "desc" }, take: 1 } },
      orderBy: [{ tripDate: "desc" }, { createdAt: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
    }),
    prisma.booking.count({ where }),
  ]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function bookingDetail(id: string) {
  const b = await prisma.booking.findUnique({
    where: { id },
    include: {
      leadGuest: true, guests: true, lines: true,
      nights: { include: { cabin: { include: { cabinType: true } } } },
      invoices: { orderBy: { revision: "desc" }, include: { payments: { orderBy: { createdAt: "asc" } } } },
    },
  });
  if (!b) return null;
  const paid = await prisma.$transaction((tx) => paidAmount(tx, id));
  const total = b.invoices[0]?.total ?? b.lines.reduce((n, l) => n + l.total, 0);
  const audit = await prisma.auditLog.findMany({ where: { entityId: id }, orderBy: { at: "desc" } });
  return { ...b, paid, outstanding: Math.max(0, total - paid), total, audit };
}

/** FR-A16/A19: everything on board for a trip date. */
export async function manifest(date: ISODate) {
  const bookings = await prisma.booking.findMany({
    where: { tripDate: dbDate(date), status: { in: ["CONFIRMED_BALANCE_DUE", "CONFIRMED_PAID", "CHECKED_IN", "COMPLETED"] } },
    include: { leadGuest: true, guests: true, nights: { include: { cabin: true } }, lines: true },
    orderBy: { reference: "asc" },
  });
  const guests = bookings.reduce((n, b) => n + b.guests.length, 0);
  const meals = bookings.reduce(
    (n, b) =>
      n + (b.type === "SHARED"
        ? b.guests.length
        : b.lines.filter((l) => l.kind === "FOOD").reduce((m, l) => m + l.qty, 0)),
    0,
  );
  const children = bookings.reduce((n, b) => n + b.guests.filter((g) => !/^adult/i.test(g.ageBandName)).length, 0);
  return { bookings, guests, meals, children };
}
