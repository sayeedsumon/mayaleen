import { randomBytes } from "node:crypto";
import { Prisma, type BookingSource } from "@prisma/client";
import {
  RuleError, availabilityFor, checkBookingWindow, initialHoldExpiry, makeReference, nearestDates,
  quoteFullBoat, quoteShared, toDhakaDate, validateFullBoat, validateShared,
  type BookingType, type GuestCount, type ISODate, type Quote,
} from "@/domain";
import { dbDate, iso, loadCabins, loadPricingConfig } from "./config";
import { blindIndex, encryptField } from "./crypto";
import { prisma } from "./db";
import { notify } from "./notify";

export interface LeadGuest {
  name: string;
  mobile: string;
  email?: string;
  nid: string; // BR-16: required to submit
}

export interface CreateBookingInput {
  type: BookingType;
  tripDate: ISODate;
  channel: "ONLINE" | "STAFF";
  source?: BookingSource;
  lead: LeadGuest;
  guests: GuestCount[];
  language?: "en" | "bn";
  notes?: string;
  /** SHARED only */
  cabinIds?: string[];
  guestsPerCabin?: Record<string, number>;
  /** FULL_BOAT only */
  foodGuests?: GuestCount[];
  discount?: { amount: number; reason: string };
  /** Staff user id for the audit log (online bookings log "ONLINE"). */
  actorId?: string;
  now?: Date;
}

export interface CreatedBooking {
  id: string;
  reference: string;
  accessToken: string;
  holdExpiresAt: Date;
  quote: Quote;
}

/** Raised when the slot was taken (FR-W06); carries the nearest alternatives. */
export class SlotTakenError extends RuleError {
  constructor(public alternatives: ISODate[]) {
    super("SLOT_TAKEN", "Just booked by someone else");
  }
}

type Tx = Prisma.TransactionClient;

export interface PlanInput {
  type: BookingType;
  tripDate: ISODate;
  channel: "ONLINE" | "STAFF";
  guests: GuestCount[];
  cabinIds?: string[];
  guestsPerCabin?: Record<string, number>;
  foodGuests?: GuestCount[];
  /** Staff-only price reduction; the reason prints on the invoice (FR-A11). */
  discount?: { amount: number; reason: string };
}

/**
 * Re-checks every availability rule against fresh data and prices the request.
 * Shared by new bookings and by changes to existing ones (`excludeBookingId` frees the
 * booking's own cabins so it can be moved or edited without clashing with itself).
 */
export async function evaluate(tx: Tx, input: PlanInput, now: Date, today: ISODate, excludeBookingId?: string) {
  const [cfg, cabins] = await Promise.all([loadPricingConfig(tx, now), loadCabins(tx)]);
  checkBookingWindow(input.tripDate, today, cfg.settings, input.channel);

  const date = dbDate(input.tripDate);
  const [nights, block] = await Promise.all([
    tx.cabinNight.findMany({
      where: { tripDate: date, ...(excludeBookingId && { bookingId: { not: excludeBookingId } }) },
      include: { booking: true },
    }),
    tx.dateBlock.findUnique({ where: { tripDate: date } }),
  ]);
  const byBooking = new Map<string, { type: BookingType; cabinIds: string[] }>();
  for (const n of nights) {
    const e = byBooking.get(n.bookingId) ?? { type: n.booking.type, cabinIds: [] };
    e.cabinIds.push(n.cabinId);
    byBooking.set(n.bookingId, e);
  }
  const avail = availabilityFor(cabins, [...byBooking.values()], !!block);
  if (block) throw new RuleError("BLOCKED", "Date is not available");

  let quote: Quote;
  let rows: { cabinId: string; guests: number }[];
  if (input.type === "SHARED") {
    const chosen = validateShared(
      cabins, avail,
      { cabinIds: input.cabinIds ?? [], guestsPerCabin: input.guestsPerCabin ?? {}, guests: input.guests },
      cfg.settings,
    );
    quote = quoteShared(cfg, {
      date: input.tripDate,
      cabins: chosen.map((c) => ({ ...c, guests: input.guestsPerCabin![c.id] })),
      guests: input.guests,
      discount: input.discount,
    });
    rows = chosen.map((c) => ({ cabinId: c.id, guests: input.guestsPerCabin![c.id] }));
  } else {
    const chosen = validateFullBoat(
      cabins, avail, { guests: input.guests, foodGuests: input.foodGuests ?? [] }, cfg.settings,
    );
    quote = quoteFullBoat(cfg, { date: input.tripDate, foodGuests: input.foodGuests ?? [], discount: input.discount });
    rows = chosen.map((c) => ({ cabinId: c.id, guests: 0 }));
  }
  return { cfg, quote, rows };
}

const BR_MOBILE = /^(?:\+?88)?01[3-9]\d{8}$/;

/**
 * Booking write path (PRD §14): one transaction that locks the trip date, re-checks every
 * rule against fresh data, inserts cabin_night rows (UNIQUE rejects clashes), then the booking.
 */
async function _createBooking(input: CreateBookingInput): Promise<CreatedBooking> {
  const now = input.now ?? new Date();
  const today = toDhakaDate(now);
  if (!BR_MOBILE.test(input.lead.mobile)) throw new RuleError("BAD_MOBILE", "Invalid Bangladeshi mobile number");
  if (!input.lead.nid.trim()) throw new RuleError("NID_REQUIRED", "Lead guest NID is required");
  if (input.channel === "ONLINE" && input.discount) throw new RuleError("NO_DISCOUNT", "Discounts are staff-only");

  try {
    return await prisma.$transaction(
      async (tx) => {
        // Serialize writers per trip date; the unique constraint remains the final guard.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.tripDate}))`;

        const { cfg, quote, rows } = await evaluate(tx, input, now, today);
        const date = dbDate(input.tripDate);

        // Reuse guest by mobile (repeat guests).
        const existing = await tx.guest.findFirst({ where: { mobile: input.lead.mobile } });
        const lead = existing
          ? await tx.guest.update({
              where: { id: existing.id },
              data: { name: input.lead.name, email: input.lead.email, nid: encryptField(input.lead.nid), nidHash: blindIndex(input.lead.nid) },
            })
          : await tx.guest.create({
              data: { name: input.lead.name, mobile: input.lead.mobile, email: input.lead.email, nid: encryptField(input.lead.nid), nidHash: blindIndex(input.lead.nid) },
            });

        const seq = (await tx.booking.count({ where: { tripDate: date } })) + 1;
        const holdExpiresAt = initialHoldExpiry(now, cfg.settings);
        const accessToken = randomBytes(24).toString("base64url");

        const booking = await tx.booking.create({
          data: {
            reference: makeReference(input.tripDate, seq),
            type: input.type,
            tripDate: date,
            source: input.source ?? (input.channel === "ONLINE" ? "WEBSITE" : "PHONE"),
            holdExpiresAt,
            leadGuestId: lead.id,
            language: input.language ?? "en",
            notes: input.notes,
            accessToken,
            guests: {
              create: input.guests.flatMap((g) =>
                Array.from({ length: g.count }, (_, i) => ({
                  ageBandName: g.band,
                  isLead: i === 0 && g === input.guests.find((x) => x.count > 0),
                })),
              ),
            },
            lines: { create: quote.lines },
            nights: { create: rows.map((r) => ({ cabinId: r.cabinId, tripDate: date, guests: r.guests })) },
          },
        });
        await tx.auditLog.create({
          data: { entity: "Booking", entityId: booking.id, action: "CREATED", actor: input.actorId ?? input.channel, after: { total: quote.total } },
        });
        return { id: booking.id, reference: booking.reference, accessToken, holdExpiresAt, quote };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 },
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new SlotTakenError(await alternativeDates(input));
    }
    if (e instanceof RuleError && e.code === "UNAVAILABLE") {
      throw new SlotTakenError(await alternativeDates(input));
    }
    throw e;
  }
}

async function alternativeDates(input: CreateBookingInput): Promise<ISODate[]> {
  const cabins = await loadCabins(prisma);
  const from = dbDate(input.tripDate);
  const horizon = new Date(from.getTime() + 61 * 86_400_000);
  const [nights, blocks] = await Promise.all([
    prisma.cabinNight.findMany({ where: { tripDate: { gte: from, lte: horizon } }, include: { booking: true } }),
    prisma.dateBlock.findMany({ where: { tripDate: { gte: from, lte: horizon } } }),
  ]);
  const blocked = new Set(blocks.map((b) => iso(b.tripDate)));
  return nearestDates(input.tripDate, 3, (d) => {
    if (blocked.has(d)) return false;
    const day = nights.filter((n) => iso(n.tripDate) === d);
    const by = new Map<string, { type: BookingType; cabinIds: string[] }>();
    for (const n of day) {
      const e = by.get(n.bookingId) ?? { type: n.booking.type, cabinIds: [] };
      e.cabinIds.push(n.cabinId);
      by.set(n.bookingId, e);
    }
    const a = availabilityFor(cabins, [...by.values()], false);
    return input.type === "FULL_BOAT" ? a.canBookFullBoat : a.canBookShared;
  });
}

/** Release holds whose deadline passed (BR-10/11). Run every 5 minutes. */
export async function expireHolds(now = new Date()): Promise<number> {
  const due = await prisma.booking.findMany({
    where: { status: { in: ["PENDING_APPROVAL", "AWAITING_PAYMENT"] }, holdExpiresAt: { lte: now } },
    select: { id: true },
  });
  for (const b of due) {
    await prisma.$transaction([
      prisma.cabinNight.deleteMany({ where: { bookingId: b.id } }),
      prisma.booking.update({ where: { id: b.id }, data: { status: "EXPIRED" } }),
      prisma.auditLog.create({ data: { entity: "Booking", entityId: b.id, action: "HOLD_EXPIRED", actor: "system" } }),
    ]);
    await notify("N-10", b.id);
  }
  return due.length;
}

/** Create a booking, then tell the guest (N-01) and the managers (N-02). */
export async function createBooking(input: CreateBookingInput): Promise<CreatedBooking> {
  const b = await _createBooking(input);
  await notify("N-01", b.id);
  await notify("N-02", b.id);
  return b;
}
