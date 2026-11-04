import type { DayType, PackageType, Prisma, Role } from "@prisma/client";
import { RuleError, toDhakaDate } from "@/domain";
import { dbDate } from "./config";
import { prisma } from "./db";
import { hashPassword, verifyPassword } from "./auth/password";
import { newTotpSecret, verifyTotp } from "./auth/totp";

type Tx = Prisma.TransactionClient;

async function log(tx: Tx | typeof prisma, entity: string, entityId: string, action: string, actor: string, after?: unknown, reason?: string) {
  await tx.auditLog.create({
    data: { entity, entityId, action, actor, after: after as Prisma.InputJsonValue | undefined, reason },
  });
}

const PACKAGES: PackageType[] = ["SHARED", "FULL_BOAT", "FULL_BOAT_FOOD"];
const DAYS: DayType[] = ["SUN_WED", "THU_SAT", "FRIDAY", "HOLIDAY"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

// ---------- Rates (FR-A22): new rows with an effective-from date; history kept (BR-18) ----------

export async function saveRates(
  effectiveFrom: string,
  rates: Record<PackageType, Record<DayType, number>>,
  actor: string,
) {
  if (!ISO.test(effectiveFrom)) throw new RuleError("BAD_DATE", "Pick an effective-from date");
  for (const p of PACKAGES) {
    for (const d of DAYS) {
      const v = rates[p]?.[d];
      if (!Number.isInteger(v) || v < 0) throw new RuleError("BAD_RATE", "Every rate must be a whole number of Taka");
    }
  }
  const from = dbDate(effectiveFrom);
  await prisma.$transaction(async (tx) => {
    await tx.rateRule.deleteMany({ where: { effectiveFrom: from } }); // re-saving the same date replaces it
    await tx.rateRule.createMany({
      data: PACKAGES.flatMap((p) => DAYS.map((d) => ({ packageType: p, dayType: d, amount: rates[p][d], effectiveFrom: from }))),
    });
    await log(tx, "RateRule", effectiveFrom, "RATES_SAVED", actor, rates);
  });
}

// ---------- Holidays (FR-A23) and date overrides ----------

export async function addHoliday(date: string, name: string, source: "expected" | "gazette", actor: string) {
  if (!ISO.test(date) || !name.trim()) throw new RuleError("BAD_HOLIDAY", "Give the holiday a date and a name");
  await prisma.holiday.upsert({
    where: { date: dbDate(date) },
    update: { name: name.trim(), source },
    create: { date: dbDate(date), name: name.trim(), source },
  });
  await log(prisma, "Holiday", date, "HOLIDAY_SAVED", actor, { name, source });
}

export async function removeHoliday(date: string, actor: string) {
  await prisma.holiday.deleteMany({ where: { date: dbDate(date) } });
  await log(prisma, "Holiday", date, "HOLIDAY_REMOVED", actor);
}

/** Paste one holiday per line: `2027-03-26 Independence Day`. Returns how many were saved. */
export async function importHolidays(text: string, source: "expected" | "gazette", actor: string) {
  const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^(\d{4}-\d{2}-\d{2})[\s,;\t]+(.+)$/);
    if (!m) throw new RuleError("BAD_LINE", `Could not read: "${l}". Use YYYY-MM-DD Name`);
    return { date: m[1], name: m[2].trim() };
  });
  for (const r of rows) await addHoliday(r.date, r.name, source, actor);
  return rows.length;
}

export async function saveOverride(date: string, packageType: PackageType, amount: number, actor: string) {
  if (!ISO.test(date)) throw new RuleError("BAD_DATE", "Pick a date");
  if (!Number.isInteger(amount) || amount <= 0) throw new RuleError("BAD_RATE", "Enter a price in Taka");
  await prisma.dateRateOverride.upsert({
    where: { tripDate_packageType: { tripDate: dbDate(date), packageType } },
    update: { amount },
    create: { tripDate: dbDate(date), packageType, amount },
  });
  await log(prisma, "DateRateOverride", date, "OVERRIDE_SAVED", actor, { packageType, amount });
}

export async function removeOverride(id: string, actor: string) {
  const o = await prisma.dateRateOverride.delete({ where: { id } });
  await log(prisma, "DateRateOverride", o.tripDate.toISOString().slice(0, 10), "OVERRIDE_REMOVED", actor);
}

// ---------- Cabins (FR-A21) ----------

export interface CabinInput {
  id?: string;
  name: string;
  cabinTypeId: string;
  capacity: number;
  active: boolean;
  sortOrder?: number;
}

/** Changes affect future dates; refused when they would break a held or confirmed booking. */
export async function saveCabin(input: CabinInput, actor: string, now = new Date()) {
  if (!input.name.trim()) throw new RuleError("CABIN_NAME", "Give the cabin a name");
  if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 12) {
    throw new RuleError("CABIN_CAP", "Capacity must be between 1 and 12");
  }
  const today = dbDate(toDhakaDate(now));
  if (input.id) {
    const nights = await prisma.cabinNight.findMany({
      where: { cabinId: input.id, tripDate: { gte: today } },
      include: { booking: true },
    });
    if (!input.active && nights.length > 0) {
      throw new RuleError("CABIN_IN_USE", `Cabin has ${nights.length} future booking night(s). Move them first.`);
    }
    const over = nights.find((n) => n.guests > input.capacity);
    if (over) throw new RuleError("CABIN_IN_USE", `${over.booking.reference} has ${over.guests} guests in this cabin`);
  }
  const data = {
    name: input.name.trim(), cabinTypeId: input.cabinTypeId, capacity: input.capacity, active: input.active,
    ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
  };
  const cabin = input.id
    ? await prisma.cabin.update({ where: { id: input.id }, data })
    : await prisma.cabin.create({ data: { ...data, sortOrder: input.sortOrder ?? (await prisma.cabin.count()) } });
  await log(prisma, "Cabin", cabin.id, input.id ? "CABIN_UPDATED" : "CABIN_CREATED", actor, data);
  return cabin;
}

export async function saveCabinType(input: { id?: string; name: string; surcharge: number }, actor: string) {
  if (!input.name.trim()) throw new RuleError("TYPE_NAME", "Give the type a name");
  if (!Number.isInteger(input.surcharge) || input.surcharge < 0) throw new RuleError("BAD_RATE", "Surcharge must be 0 or more");
  const t = input.id
    ? await prisma.cabinType.update({ where: { id: input.id }, data: { name: input.name.trim(), surcharge: input.surcharge } })
    : await prisma.cabinType.create({ data: { name: input.name.trim(), surcharge: input.surcharge } });
  await log(prisma, "CabinType", t.id, "CABIN_TYPE_SAVED", actor, input);
  return t;
}

// ---------- Booking rules (FR-A24): versioned settings row ----------

export interface RulesInput {
  capacityCap: number;
  approvalWindowHours: number;
  paymentWindowHours: number;
  balanceLeadHours: number;
  cutoffDays: number;
  horizonMonths: number;
  advancePct: number;
  minBillablePerCabin: number;
  groupTierEnabled: boolean;
  groupTierMinGuests: number;
  groupTierRate: number;
}

export async function saveRules(input: RulesInput, actor: string, now = new Date()) {
  const checks: [keyof RulesInput, number, number][] = [
    ["capacityCap", 1, 100], ["approvalWindowHours", 1, 168], ["paymentWindowHours", 1, 168],
    ["balanceLeadHours", 0, 336], ["cutoffDays", 0, 60], ["horizonMonths", 1, 36], ["advancePct", 1, 100],
    ["minBillablePerCabin", 0, 12], ["groupTierMinGuests", 0, 100], ["groupTierRate", 0, 1_000_000],
  ];
  for (const [k, lo, hi] of checks) {
    const v = input[k] as number;
    if (!Number.isInteger(v) || v < lo || v > hi) throw new RuleError("BAD_SETTING", `${k} must be between ${lo} and ${hi}`);
  }
  const row = await prisma.boatSetting.create({ data: { ...input, effectiveFrom: now } });
  await log(prisma, "BoatSetting", String(row.id), "RULES_SAVED", actor, input);
  return row;
}

// ---------- Staff (FR-A25) and own account ----------

const MOBILE = /^01[3-9]\d{8}$/;

export async function createStaff(input: { name: string; mobile: string; role: Role; password: string }, actor: string) {
  if (!input.name.trim()) throw new RuleError("STAFF_NAME", "Enter a name");
  if (!MOBILE.test(input.mobile)) throw new RuleError("BAD_MOBILE", "Enter an 11-digit mobile like 01712345678");
  if (input.password.length < 10) throw new RuleError("WEAK_PASSWORD", "Password must be at least 10 characters");
  if (await prisma.user.findUnique({ where: { mobile: input.mobile } })) {
    throw new RuleError("DUPLICATE", "Someone already uses that mobile number");
  }
  const u = await prisma.user.create({
    data: { name: input.name.trim(), mobile: input.mobile, role: input.role, pwHash: hashPassword(input.password) },
  });
  await log(prisma, "User", u.id, "STAFF_CREATED", actor, { name: u.name, role: u.role });
  return u;
}

export async function updateStaff(id: string, input: { role: Role; active: boolean }, actor: string) {
  if (id === actor && (!input.active || input.role !== "ADMIN")) {
    throw new RuleError("SELF_LOCKOUT", "You cannot remove your own owner access");
  }
  if (!input.active || input.role !== "ADMIN") {
    const otherAdmins = await prisma.user.count({ where: { role: "ADMIN", active: true, id: { not: id } } });
    const target = await prisma.user.findUniqueOrThrow({ where: { id } });
    if (target.role === "ADMIN" && otherAdmins === 0) throw new RuleError("LAST_ADMIN", "Keep at least one active owner");
  }
  const u = await prisma.user.update({ where: { id }, data: input });
  await log(prisma, "User", id, "STAFF_UPDATED", actor, input);
  return u;
}

export async function resetStaffPassword(id: string, password: string, actor: string) {
  if (password.length < 10) throw new RuleError("WEAK_PASSWORD", "Password must be at least 10 characters");
  await prisma.user.update({ where: { id }, data: { pwHash: hashPassword(password) } });
  await log(prisma, "User", id, "PASSWORD_RESET", actor);
}

export async function changeOwnPassword(userId: string, current: string, next: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!verifyPassword(current, u.pwHash)) throw new RuleError("BAD_PASSWORD", "Current password is wrong");
  if (next.length < 10) throw new RuleError("WEAK_PASSWORD", "New password must be at least 10 characters");
  if (next === current) throw new RuleError("SAME_PASSWORD", "Choose a different password");
  await prisma.user.update({ where: { id: userId }, data: { pwHash: hashPassword(next) } });
  await log(prisma, "User", userId, "PASSWORD_CHANGED", userId);
}

/** Step 1 of 2FA: store a pending secret (not yet enforced). */
export async function startTotp(userId: string) {
  const secret = newTotpSecret();
  await prisma.user.update({ where: { id: userId }, data: { totpSecret: secret, twoFaOn: false } });
  return secret;
}

/** Step 2: the user proves their app shows the right code; then 2FA is enforced at sign-in. */
export async function confirmTotp(userId: string, code: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!u.totpSecret || !verifyTotp(u.totpSecret, code)) throw new RuleError("BAD_CODE", "That code is not right. Try the newest one.");
  await prisma.user.update({ where: { id: userId }, data: { twoFaOn: true } });
  await log(prisma, "User", userId, "2FA_ON", userId);
}

export async function disableTotp(userId: string, password: string) {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!verifyPassword(password, u.pwHash)) throw new RuleError("BAD_PASSWORD", "Password is wrong");
  await prisma.user.update({ where: { id: userId }, data: { twoFaOn: false, totpSecret: null } });
  await log(prisma, "User", userId, "2FA_OFF", userId);
}

// ---------- Sign-in lockout (works across serverless instances) ----------

const MAX_TRIES = 5;
const LOCK_MS = 10 * 60_000;

export async function isLockedOut(key: string, now = new Date()) {
  const a = await prisma.loginAttempt.findUnique({ where: { key } });
  return !!a && a.count >= MAX_TRIES && a.until > now;
}

export async function recordFailedLogin(key: string, now = new Date()) {
  const a = await prisma.loginAttempt.findUnique({ where: { key } });
  const fresh = !a || a.until <= now;
  await prisma.loginAttempt.upsert({
    where: { key },
    update: { count: fresh ? 1 : a!.count + 1, until: new Date(now.getTime() + LOCK_MS) },
    create: { key, count: 1, until: new Date(now.getTime() + LOCK_MS) },
  });
}

export async function clearLogin(key: string) {
  await prisma.loginAttempt.deleteMany({ where: { key } });
}

// ---------- Guests ----------

export async function saveGuestNotes(guestId: string, notes: string, actor: string) {
  await prisma.guest.update({ where: { id: guestId }, data: { notes: notes.trim() || null } });
  await log(prisma, "Guest", guestId, "NOTES_SAVED", actor);
}
