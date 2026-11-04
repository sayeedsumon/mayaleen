import type { BookingStatus, Prisma } from "@prisma/client";
import { addDays, availabilityFor, dayTypeOf, toDhakaDate, type BookingType, type DateMode, type ISODate } from "@/domain";
import { expireHolds } from "./booking-service";
import { dbDate, iso, loadCabins, loadPricingConfig } from "./config";
import { blindIndex } from "./crypto";
import { prisma } from "./db";
import { paidAmount } from "./workflow-service";

export const OPEN_STATUSES: BookingStatus[] = [
  "PENDING_APPROVAL", "AWAITING_PAYMENT", "PAYMENT_SUBMITTED",
  "CONFIRMED_BALANCE_DUE", "CONFIRMED_PAID", "CHECKED_IN",
];
const CONFIRMED: BookingStatus[] = ["CONFIRMED_BALANCE_DUE", "CONFIRMED_PAID", "CHECKED_IN"];

const withLead = { leadGuest: true } satisfies Prisma.BookingInclude;

/** Release expired holds before showing availability (the cron job does the same every few minutes). */
let lastSweep = 0;
export async function sweepHolds(now = new Date()) {
  if (now.getTime() - lastSweep < 60_000) return;
  lastSweep = now.getTime();
  try {
    await expireHolds(now);
  } catch (e) {
    console.error("hold sweep failed", e);
  }
}

/** Verified paid amount for many bookings at once (refunds subtract). */
export async function paidByBooking(bookingIds: string[]): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  if (bookingIds.length === 0) return m;
  const rows = await prisma.payment.findMany({
    where: { status: "VERIFIED", invoice: { bookingId: { in: bookingIds } } },
    select: { amountReceived: true, isRefund: true, invoice: { select: { bookingId: true } } },
  });
  for (const r of rows) {
    const id = r.invoice.bookingId;
    m.set(id, (m.get(id) ?? 0) + (r.isRefund ? -1 : 1) * (r.amountReceived ?? 0));
  }
  return m;
}

const latestInvoice = { invoices: { orderBy: { revision: "desc" as const }, take: 1 } };

// ---------- Sidebar counters ----------

export async function navCounts() {
  const [approvals, proofs] = await Promise.all([
    prisma.booking.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.payment.count({ where: { status: "SUBMITTED" } }),
  ]);
  return { approvals, proofs };
}

// ---------- Today (FR-A01) ----------

export async function dashboard(now = new Date()) {
  const today = toDhakaDate(now);
  const [pending, proofs, awaiting, balances, upcoming, activity, cabins, weekNights, users] = await Promise.all([
    prisma.booking.findMany({
      where: { status: "PENDING_APPROVAL" }, include: { ...withLead, lines: true }, orderBy: { holdExpiresAt: "asc" },
    }),
    prisma.payment.findMany({
      where: { status: "SUBMITTED" },
      include: { invoice: { include: { booking: { include: withLead } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.booking.findMany({
      where: { status: "AWAITING_PAYMENT" }, include: { ...withLead, ...latestInvoice }, orderBy: { holdExpiresAt: "asc" },
    }),
    prisma.booking.findMany({
      where: { status: "CONFIRMED_BALANCE_DUE", balanceDueAt: { lte: new Date(now.getTime() + 48 * 3_600_000) } },
      include: { ...withLead, ...latestInvoice }, orderBy: { balanceDueAt: "asc" },
    }),
    prisma.booking.findMany({
      where: { tripDate: { gte: dbDate(today) }, status: { in: CONFIRMED } },
      include: { ...withLead, guests: true, lines: true, nights: true, ...latestInvoice },
      orderBy: { tripDate: "asc" }, take: 6,
    }),
    prisma.auditLog.findMany({ orderBy: { at: "desc" }, take: 6 }),
    loadCabins(prisma),
    prisma.cabinNight.findMany({
      where: { tripDate: { gte: dbDate(today), lte: dbDate(addDays(today, 6)) } }, include: { booking: true },
    }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);
  const paid = await paidByBooking([...balances, ...upcoming].map((b) => b.id));
  const nextDate = upcoming[0] ? iso(upcoming[0].tripDate) : null;
  const nextGroup = upcoming.filter((b) => nextDate && iso(b.tripDate) === nextDate);
  const who = new Map(users.map((u) => [u.id, u.name]));

  const active = cabins.filter((c) => c.active);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i);
    const ns = weekNights.filter((n) => iso(n.tripDate) === d);
    return {
      date: d,
      cabins: active.map((c) => {
        const n = ns.find((x) => x.cabinId === c.id);
        return n ? (CONFIRMED.includes(n.booking.status) ? "confirmed" : "held") : "free";
      }),
      full: ns.some((n) => n.booking.type === "FULL_BOAT"),
    };
  });

  return {
    today, pending, proofs, awaiting, balances, week, nextDate,
    nextGroup: nextGroup.map((b) => ({
      ...b, paid: paid.get(b.id) ?? 0,
      adults: b.guests.filter((g) => /^adult/i.test(g.ageBandName)).length,
      idsRecorded: b.guests.filter((g) => g.nidOrPassport).length,
      meals: b.type === "SHARED" ? b.guests.length : b.lines.filter((l) => l.kind === "FOOD").reduce((n, l) => n + l.qty, 0),
    })),
    activity: activity.map((a) => ({ ...a, who: who.get(a.actor) ?? (a.actor === "ONLINE" ? "Website" : a.actor) })),
    paid,
  };
}

// ---------- Calendar (FR-A02) — serialisable for the client booking panel ----------

export interface CalBooking {
  id: string; reference: string; lead: string; type: BookingType; status: BookingStatus; cabinIds: string[]; guests: number;
}
export interface CalDay { date: ISODate; blockReason: string | null; holiday: string | null; bookings: CalBooking[] }

export async function calendarMonth(month: string) {
  const first = `${month}-01`;
  const d = new Date(`${first}T00:00:00Z`);
  const last = addDays(iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))), -1);
  const [cabins, nights, blocks, holidays, cfg, types, bookingGuests] = await Promise.all([
    prisma.cabin.findMany({ include: { cabinType: true }, orderBy: { sortOrder: "asc" } }),
    prisma.cabinNight.findMany({
      where: { tripDate: { gte: dbDate(first), lte: dbDate(last) } }, include: { booking: { include: withLead } },
    }),
    prisma.dateBlock.findMany({ where: { tripDate: { gte: dbDate(first), lte: dbDate(last) } } }),
    prisma.holiday.findMany({ where: { date: { gte: dbDate(first), lte: dbDate(last) } } }),
    loadPricingConfig(prisma),
    prisma.cabinType.findMany(),
    prisma.bookingGuest.groupBy({
      by: ["bookingId"], _count: true,
      where: { booking: { tripDate: { gte: dbDate(first), lte: dbDate(last) } } },
    }),
  ]);
  const guestCount = new Map(bookingGuests.map((g) => [g.bookingId, g._count]));
  const blockBy = new Map(blocks.map((b) => [iso(b.tripDate), b.reason]));
  const holBy = new Map(holidays.map((h) => [iso(h.date), h.name]));
  const days: CalDay[] = [];
  for (let date = first; date <= last; date = addDays(date, 1)) {
    const by = new Map<string, CalBooking>();
    for (const n of nights.filter((x) => iso(x.tripDate) === date)) {
      const e = by.get(n.bookingId) ?? {
        id: n.bookingId, reference: n.booking.reference, lead: n.booking.leadGuest.name, type: n.booking.type,
        status: n.booking.status, cabinIds: [], guests: guestCount.get(n.bookingId) ?? 0,
      };
      e.cabinIds.push(n.cabinId);
      by.set(n.bookingId, e);
    }
    days.push({ date, blockReason: blockBy.get(date) ?? null, holiday: holBy.get(date) ?? null, bookings: [...by.values()] });
  }
  return {
    month, days,
    cabins: cabins.map((c) => ({
      id: c.id, name: c.name, type: c.cabinType.name, capacity: c.capacity, surcharge: c.cabinType.surcharge, active: c.active,
    })),
    pricing: {
      rates: cfg.rates, overrides: cfg.overrides, holidays: [...cfg.holidays], ageBands: cfg.ageBands, settings: cfg.settings,
    },
    cabinTypes: types.length,
  };
}
export type CalendarData = Awaited<ReturnType<typeof calendarMonth>>;

/** Mode of a date for small summaries (dashboard, timeline). */
export function modeOf(cabins: { id: string; active: boolean; name: string; capacity: number; surcharge: number }[], day: CalDay): DateMode {
  return availabilityFor(cabins, day.bookings.map((b) => ({ type: b.type, cabinIds: b.cabinIds })), !!day.blockReason).mode;
}

// ---------- Timeline (FR-A03) ----------

export async function timeline(from: ISODate, days: number) {
  const to = addDays(from, days - 1);
  const [cabins, nights, blocks, cfg] = await Promise.all([
    prisma.cabin.findMany({ where: { active: true }, include: { cabinType: true }, orderBy: { sortOrder: "asc" } }),
    prisma.cabinNight.findMany({
      where: { tripDate: { gte: dbDate(from), lte: dbDate(to) } }, include: { booking: { include: withLead } },
    }),
    prisma.dateBlock.findMany({ where: { tripDate: { gte: dbDate(from), lte: dbDate(to) } } }),
    loadPricingConfig(prisma),
  ]);
  const dates = Array.from({ length: days }, (_, i) => {
    const d = addDays(from, i);
    return { date: d, dayType: dayTypeOf(d, cfg.holidays), rate: cfg.rates.SHARED[dayTypeOf(d, cfg.holidays)] };
  });
  return { dates, cabins, nights, blocked: new Set(blocks.map((b) => iso(b.tripDate))) };
}

// ---------- Bookings list (FR-A07) ----------

export interface BookingSearch {
  q?: string; status?: BookingStatus; type?: BookingType; source?: string; from?: ISODate; to?: ISODate; when?: string; page?: number;
}
const PAGE_SIZE = 25;

function bookingWhere(s: BookingSearch, today: ISODate): Prisma.BookingWhereInput {
  const q = s.q?.trim();
  const when: Prisma.BookingWhereInput =
    s.when === "past" ? { tripDate: { lt: dbDate(today) } }
    : s.when === "all" ? {}
    : s.from || s.to ? { tripDate: { ...(s.from && { gte: dbDate(s.from) }), ...(s.to && { lte: dbDate(s.to) }) } }
    : { tripDate: { gte: dbDate(today) } };
  return {
    ...when,
    ...(s.type && { type: s.type }),
    ...(s.source && { source: s.source as never }),
    ...(q && {
      OR: [
        { reference: { contains: q, mode: "insensitive" } },
        { leadGuest: { name: { contains: q, mode: "insensitive" } } },
        { leadGuest: { mobile: { contains: q.replace(/[^0-9]/g, "") || q } } },
        { leadGuest: { nidHash: blindIndex(q) } },
      ],
    }),
  };
}

export async function searchBookings(s: BookingSearch, now = new Date()) {
  const today = toDhakaDate(now);
  const base = bookingWhere(s, today);
  const where = { ...base, ...(s.status && { status: s.status }) };
  const page = Math.max(1, s.page ?? 1);
  const [rows, total, counts] = await Promise.all([
    prisma.booking.findMany({
      where, include: { leadGuest: true, nights: { include: { cabin: true } }, guests: true, ...latestInvoice },
      orderBy: s.when === "past" ? [{ tripDate: "desc" }] : [{ tripDate: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
    }),
    prisma.booking.count({ where }),
    prisma.booking.groupBy({ by: ["status"], where: base, _count: true }),
  ]);
  const paid = await paidByBooking(rows.map((r) => r.id));
  return {
    rows: rows.map((r) => ({ ...r, paid: paid.get(r.id) ?? 0 })),
    total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count])) as Partial<Record<BookingStatus, number>>,
  };
}

export async function bookingDetail(id: string) {
  const b = await prisma.booking.findUnique({
    where: { id },
    include: {
      leadGuest: true, guests: true, lines: true,
      nights: { include: { cabin: { include: { cabinType: true } } }, orderBy: { cabin: { sortOrder: "asc" } } },
      invoices: { orderBy: { revision: "desc" }, include: { payments: { orderBy: { createdAt: "asc" } } } },
    },
  });
  if (!b) return null;
  const paid = await prisma.$transaction((tx) => paidAmount(tx, id));
  const total = b.invoices[0]?.total ?? b.lines.reduce((n, l) => n + l.total, 0);
  const [audit, users, earlierTrips] = await Promise.all([
    prisma.auditLog.findMany({ where: { entityId: id }, orderBy: { at: "desc" } }),
    prisma.user.findMany({ select: { id: true, name: true } }),
    prisma.booking.count({ where: { leadGuestId: b.leadGuestId, id: { not: id } } }),
  ]);
  const who = new Map(users.map((u) => [u.id, u.name]));
  return {
    ...b, paid, outstanding: Math.max(0, total - paid), total, earlierTrips,
    audit: audit.map((a) => ({ ...a, who: who.get(a.actor) ?? (a.actor === "ONLINE" ? "Website" : a.actor) })),
  };
}

// ---------- Boarding (FR-A17, A18, A20) ----------

export async function boardingDay(date: ISODate) {
  const include = { leadGuest: true, guests: true, nights: { include: { cabin: true } }, lines: true, ...latestInvoice } as const;
  const [arrivals, departures] = await Promise.all([
    prisma.booking.findMany({
      where: { tripDate: dbDate(date), status: { in: [...CONFIRMED, "COMPLETED"] } }, include, orderBy: { reference: "asc" },
    }),
    prisma.booking.findMany({
      where: { tripDate: dbDate(addDays(date, -1)), status: { in: ["CHECKED_IN", "COMPLETED"] } }, include, orderBy: { reference: "asc" },
    }),
  ]);
  const paid = await paidByBooking([...arrivals, ...departures].map((b) => b.id));
  const enrich = (b: (typeof arrivals)[number]) => {
    const total = b.invoices[0]?.total ?? 0;
    const p = paid.get(b.id) ?? 0;
    return {
      ...b, paidAmount: p, outstanding: Math.max(0, total - p),
      adults: b.guests.filter((g) => /^adult/i.test(g.ageBandName)).length,
      idsRecorded: b.guests.filter((g) => g.nidOrPassport).length,
    };
  };
  return { date, arrivals: arrivals.map(enrich), departures: departures.map(enrich) };
}

/** FR-A16/A19: everything on board for a trip date, plus the next-morning breakfast of the previous night's guests. */
export async function manifest(date: ISODate) {
  const include = { leadGuest: true, guests: true, nights: { include: { cabin: true } }, lines: true } as const;
  const [bookings, leaving] = await Promise.all([
    prisma.booking.findMany({
      where: { tripDate: dbDate(date), status: { in: [...CONFIRMED, "COMPLETED"] } }, include, orderBy: { reference: "asc" },
    }),
    prisma.booking.findMany({
      where: { tripDate: dbDate(addDays(date, -1)), status: { in: ["CHECKED_IN", "COMPLETED"] } }, include,
    }),
  ]);
  const plates = (b: (typeof bookings)[number]) =>
    b.type === "SHARED" ? b.guests.length : b.lines.filter((l) => l.kind === "FOOD").reduce((n, l) => n + l.qty, 0);
  const guests = bookings.reduce((n, b) => n + b.guests.length, 0);
  const children = bookings.reduce((n, b) => n + b.guests.filter((g) => !/^adult/i.test(g.ageBandName)).length, 0);
  const meals = bookings.reduce((n, b) => n + plates(b), 0);
  const leavingPlates = leaving.reduce((n, b) => n + plates(b), 0);
  return { bookings, leaving, guests, children, meals, leavingPlates, plates };
}

// ---------- Invoices (FR-A11) ----------

export async function invoicesList(filter: "open" | "paid" | "all", q?: string) {
  const invoices = await prisma.invoice.findMany({
    where: {
      status: "ISSUED",
      booking: {
        status: { notIn: ["REJECTED", "EXPIRED"] },
        ...(q?.trim() && {
          OR: [
            { reference: { contains: q.trim(), mode: "insensitive" } },
            { leadGuest: { name: { contains: q.trim(), mode: "insensitive" } } },
          ],
        }),
      },
      ...(q?.trim() && /^INV/i.test(q.trim()) && { number: { contains: q.trim().toUpperCase() } }),
    },
    include: { booking: { include: withLead } },
    orderBy: { booking: { tripDate: "asc" } },
  });
  const paid = await paidByBooking(invoices.map((i) => i.bookingId));
  const rows = invoices.map((i) => ({ ...i, paid: paid.get(i.bookingId) ?? 0 }));
  const isPaid = (r: (typeof rows)[number]) => r.paid >= r.total;
  return {
    rows: filter === "all" ? rows : rows.filter((r) => (filter === "paid" ? isPaid(r) : !isPaid(r) && r.booking.status !== "CANCELLED")),
    counts: { open: rows.filter((r) => !isPaid(r) && r.booking.status !== "CANCELLED").length, paid: rows.filter(isPaid).length },
  };
}

export async function invoiceDetail(id: string) {
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: {
      booking: {
        include: {
          leadGuest: true, lines: true, guests: true, nights: { include: { cabin: { include: { cabinType: true } } } },
          invoices: { orderBy: { revision: "desc" } },
        },
      },
      payments: true,
    },
  });
  if (!inv) return null;
  const paid = await prisma.$transaction((tx) => paidAmount(tx, inv.bookingId));
  return { ...inv, paid };
}

// ---------- Payments (FR-A12, A13) ----------

export async function paymentsPage(tab: "verify" | "verified" | "rejected" | "refunds") {
  const statusWhere: Prisma.PaymentWhereInput =
    tab === "verify" ? { status: "SUBMITTED" }
    : tab === "rejected" ? { status: "REJECTED" }
    : tab === "refunds" ? { isRefund: true }
    : { status: "VERIFIED", isRefund: false };
  const [rows, counts, users] = await Promise.all([
    prisma.payment.findMany({
      where: statusWhere,
      include: { invoice: { include: { booking: { include: { ...withLead, nights: { include: { cabin: true } } } } } } },
      orderBy: { createdAt: tab === "verify" ? "asc" : "desc" }, take: 50,
    }),
    Promise.all([
      prisma.payment.count({ where: { status: "SUBMITTED" } }),
      prisma.payment.count({ where: { status: "VERIFIED", isRefund: false } }),
      prisma.payment.count({ where: { status: "REJECTED" } }),
      prisma.payment.count({ where: { isRefund: true } }),
    ]),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);
  const txnIds = rows.map((r) => r.txnId).filter((t): t is string => !!t);
  const dupes = txnIds.length
    ? await prisma.payment.groupBy({ by: ["txnId"], where: { txnId: { in: txnIds }, status: { not: "REJECTED" } }, _count: true })
    : [];
  const dupSet = new Set(dupes.filter((d) => d._count > 1).map((d) => d.txnId));
  const paid = await paidByBooking(rows.map((r) => r.invoice.bookingId));
  const who = new Map(users.map((u) => [u.id, u.name]));
  return {
    rows: rows.map((r) => ({
      ...r, duplicate: !!r.txnId && dupSet.has(r.txnId), bookingPaid: paid.get(r.invoice.bookingId) ?? 0,
      verifiedByName: r.verifiedBy ? who.get(r.verifiedBy) ?? r.verifiedBy : null,
    })),
    counts: { verify: counts[0], verified: counts[1], rejected: counts[2], refunds: counts[3] },
  };
}

// ---------- Guests ----------

export async function guestsList(q?: string, filter?: "repeat") {
  const query = q?.trim();
  const guests = await prisma.guest.findMany({
    where: query
      ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { mobile: { contains: query.replace(/[^0-9]/g, "") || query } }, { nidHash: blindIndex(query) }] }
      : {},
    include: { bookings: { select: { id: true, tripDate: true, status: true }, orderBy: { tripDate: "desc" } } },
    orderBy: { name: "asc" }, take: 200,
  });
  const rows = guests.map((g) => {
    const real = g.bookings.filter((b) => !["REJECTED", "EXPIRED"].includes(b.status));
    return { ...g, trips: real.length, next: real.filter((b) => OPEN_STATUSES.includes(b.status)).at(-1)?.tripDate ?? null };
  });
  const repeat = rows.filter((r) => r.trips > 1);
  return { rows: filter === "repeat" ? repeat : rows, counts: { all: rows.length, repeat: repeat.length } };
}

export async function guestDetail(id: string) {
  const g = await prisma.guest.findUnique({
    where: { id },
    include: { bookings: { include: { ...latestInvoice, guests: true, nights: { include: { cabin: true } } }, orderBy: { tripDate: "desc" } } },
  });
  if (!g) return null;
  const paid = await paidByBooking(g.bookings.map((b) => b.id));
  const real = g.bookings.filter((b) => !["REJECTED", "EXPIRED"].includes(b.status));
  const sizes = real.map((b) => b.guests.length).sort((a, b) => a - b);
  return {
    ...g,
    bookings: g.bookings.map((b) => ({ ...b, paid: paid.get(b.id) ?? 0 })),
    totalPaid: [...paid.values()].reduce((a, b) => a + b, 0),
    trips: real.length,
    party: sizes.length ? (sizes[0] === sizes.at(-1) ? String(sizes[0]) : `${sizes[0]}–${sizes.at(-1)}`) : "–",
  };
}

// ---------- Reports (FR-A26) ----------

export async function reports(month: string) {
  const first = `${month}-01`;
  const d = new Date(`${first}T00:00:00Z`);
  const last = addDays(iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))), -1);
  const [bookings, cabins, cfg] = await Promise.all([
    prisma.booking.findMany({
      where: { tripDate: { gte: dbDate(first), lte: dbDate(last) }, status: { notIn: ["REJECTED", "EXPIRED"] } },
      include: { leadGuest: true, guests: true, nights: true, ...latestInvoice },
    }),
    prisma.cabin.count({ where: { active: true } }),
    loadPricingConfig(prisma),
  ]);
  const paid = await paidByBooking(bookings.map((b) => b.id));
  const live = bookings.filter((b) => b.status !== "CANCELLED" && b.status !== "NO_SHOW");
  const invoiced = live.filter((b) => b.invoices[0]);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const invoicedTotal = sum(invoiced.map((b) => b.invoices[0].total));
  const collected = sum(bookings.map((b) => paid.get(b.id) ?? 0));
  const nightsInMonth = Math.round((Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000) + 1;
  const perNight = Array.from({ length: nightsInMonth }, (_, i) => {
    const date = addDays(first, i);
    const day = live.filter((b) => iso(b.tripDate) === date);
    return {
      date,
      full: day.some((b) => b.type === "FULL_BOAT"),
      confirmed: sum(day.filter((b) => b.status !== "PENDING_APPROVAL").map((b) => b.nights.length)),
      pending: sum(day.filter((b) => b.status === "PENDING_APPROVAL").map((b) => b.nights.length)),
    };
  });
  const cabinNights = sum(live.map((b) => b.nights.length));
  const byDayType: Record<string, number> = { FRIDAY: 0, THU_SAT: 0, SUN_WED: 0, HOLIDAY: 0 };
  const byPackage: Record<string, number> = { SHARED: 0, FULL_BOAT: 0 };
  const bySource: Record<string, number> = {};
  for (const b of invoiced) {
    byDayType[dayTypeOf(iso(b.tripDate), cfg.holidays)] += b.invoices[0].total;
    byPackage[b.type] += b.invoices[0].total;
  }
  for (const b of live) bySource[b.source] = (bySource[b.source] ?? 0) + 1;
  const owed = invoiced
    .map((b) => ({ b, due: b.invoices[0].total - (paid.get(b.id) ?? 0) }))
    .filter((x) => x.due > 0)
    .sort((a, b) => (a.b.paymentDueAt ?? a.b.balanceDueAt ?? a.b.tripDate).getTime() - (b.b.paymentDueAt ?? b.b.balanceDueAt ?? b.b.tripDate).getTime());
  return {
    month, invoicedTotal, invoicedCount: invoiced.length, collected, outstanding: invoicedTotal - collected,
    cabinNights, capacity: cabins * nightsInMonth, guests: sum(live.map((b) => b.guests.length)),
    perNight, byDayType, byPackage, bySource, owed, cabins, sourceTotal: live.length,
    unpaidCount: owed.filter((o) => (paid.get(o.b.id) ?? 0) === 0).length,
    balanceCount: owed.filter((o) => (paid.get(o.b.id) ?? 0) > 0).length,
  };
}
