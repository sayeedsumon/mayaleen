import type { Channel, Prisma } from "@prisma/client";
import { addHours, toDhakaDate } from "@/domain";
import { fill, money, tripDate, when, type Lang } from "@/lib/i18n";
import { prisma } from "./db";

/**
 * Guest and staff messages (PRD §11, N-01 … N-14).
 * Every message goes into the Message outbox first. It is sent through the SMS gateway / email
 * provider when configured; otherwise it stays as LOGGED so staff can see and send it by hand.
 *
 * SMS: set SMS_URL_TEMPLATE to your Bangladeshi gateway's send URL with {to} and {text}
 *      placeholders, e.g. https://gateway.example/api?key=XXX&sender=MAYALEEN&to={to}&msg={text}
 * Email: set RESEND_API_KEY and EMAIL_FROM (e.g. "Mayaleen <booking@yourdomain>").
 */

export type EventKey =
  | "N-01" | "N-02" | "N-03" | "N-04" | "N-05" | "N-06" | "N-07" | "N-08" | "N-09" | "N-10" | "N-11" | "N-12" | "N-13" | "N-14";

const SITE = () => (process.env.SITE_URL ?? "https://mayaleen.vercel.app").replace(/\/$/, "");

const T: Record<Lang, Partial<Record<EventKey, { sms: string; subject?: string }>>> = {
  en: {
    "N-01": { sms: "Mayaleen: request {ref} for {date} received. Cabins held while we confirm. Track it: {link}", subject: "We got your booking request {ref}" },
    "N-03": { sms: "Mayaleen: {ref} approved. Pay {due} by {deadline} (bank transfer, note {ref}). Invoice and bank details: {link}", subject: "Booking {ref} approved: your invoice" },
    "N-04": { sms: "Mayaleen: sorry, we could not confirm {ref}. {reason} Pick another date: {site}/book", subject: "About your booking {ref}" },
    "N-05": { sms: "Mayaleen reminder: {due} for {ref} is due by {deadline}, or the cabins are released. {link}" },
    "N-07": { sms: "Mayaleen: advance received, {ref} is confirmed. Balance {balance} by {balanceAt}. {link}", subject: "Booking {ref} confirmed" },
    "N-08": { sms: "Mayaleen: {ref} is paid in full. See you {date} at 13:00, {place}. Bring every adult's NID. {link}", subject: "You're all set for {date}" },
    "N-09": { sms: "Mayaleen: we could not accept your payment proof for {ref}. {reason} Please send it again: {link}" },
    "N-10": { sms: "Mayaleen: {ref} has been released because the deadline passed. Book again: {site}/book" },
    "N-11": { sms: "Mayaleen reminder: balance {balance} for {ref} is due by {balanceAt}. {link}" },
    "N-12": { sms: "Mayaleen: see you tomorrow at 13:00, {place}. Bring every adult's NID. Questions: {phone}" },
    "N-13": { sms: "Mayaleen: your booking {ref} was updated ({what}). Details: {link}", subject: "Booking {ref} updated" },
    "N-14": { sms: "Thank you for sailing with Mayaleen! We'd love a review: {review}", subject: "Thank you from Mayaleen" },
  },
  bn: {
    "N-01": { sms: "মায়ালীন: {date}-এর জন্য {ref} অনুরোধ পেয়েছি। নিশ্চিত করা পর্যন্ত কেবিন ধরে রাখা আছে। দেখুন: {link}", subject: "আপনার বুকিং অনুরোধ {ref} পেয়েছি" },
    "N-03": { sms: "মায়ালীন: {ref} অনুমোদিত। {deadline}-এর মধ্যে {due} দিন (ব্যাংক ট্রান্সফার, নোটে {ref})। ইনভয়েস: {link}", subject: "বুকিং {ref} অনুমোদিত" },
    "N-04": { sms: "মায়ালীন: দুঃখিত, {ref} নিশ্চিত করা গেল না। {reason} অন্য তারিখ: {site}/book", subject: "আপনার বুকিং {ref}" },
    "N-05": { sms: "মায়ালীন: {ref}-এর {due} {deadline}-এর মধ্যে দিন, নইলে কেবিন ছেড়ে দেওয়া হবে। {link}" },
    "N-07": { sms: "মায়ালীন: অগ্রিম পেয়েছি, {ref} নিশ্চিত। বাকি {balance} {balanceAt}-এর মধ্যে। {link}", subject: "বুকিং {ref} নিশ্চিত" },
    "N-08": { sms: "মায়ালীন: {ref} পুরো পরিশোধিত। {date} দুপুর ১টায় {place}-এ দেখা হবে। সবার এনআইডি আনুন। {link}", subject: "{date}-এর জন্য সব প্রস্তুত" },
    "N-09": { sms: "মায়ালীন: {ref}-এর পেমেন্টের প্রমাণ গ্রহণ করা যায়নি। {reason} আবার পাঠান: {link}" },
    "N-10": { sms: "মায়ালীন: সময়সীমা পার হওয়ায় {ref} ছেড়ে দেওয়া হয়েছে। আবার বুক করুন: {site}/book" },
    "N-11": { sms: "মায়ালীন: {ref}-এর বাকি {balance} {balanceAt}-এর মধ্যে দিন। {link}" },
    "N-12": { sms: "মায়ালীন: কাল দুপুর ১টায় {place}-এ দেখা হবে। সবার এনআইডি আনুন। প্রশ্ন: {phone}" },
    "N-13": { sms: "মায়ালীন: আপনার বুকিং {ref} বদলানো হয়েছে ({what})। দেখুন: {link}", subject: "বুকিং {ref} বদলানো হয়েছে" },
    "N-14": { sms: "মায়ালীনে আসার জন্য ধন্যবাদ! একটি রিভিউ দিলে খুশি হব: {review}", subject: "মায়ালীনের পক্ষ থেকে ধন্যবাদ" },
  },
};

const STAFF: Partial<Record<EventKey, string>> = {
  "N-02": "Mayaleen: new request {ref} · {date} · {pkg} · {guests} guests · {total}. Hold ends {hold}.",
  "N-06": "Mayaleen: payment proof for {ref} ({claimed}). Please verify.",
  "N-10": "Mayaleen: hold expired for {ref} ({date}). Cabins released.",
};

async function bookingVars(bookingId: string) {
  const b = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { leadGuest: true, guests: true, invoices: { orderBy: { revision: "desc" }, take: 1 }, lines: true },
  });
  const content = await prisma.siteContent.findMany({ where: { key: { in: ["meetingPoint", "phone", "facebook"] } } }).catch(() => []);
  const c = (k: string, lang: Lang) => { const r = content.find((x) => x.key === k); return (lang === "bn" ? r?.bn || r?.en : r?.en) ?? ""; };
  const lang: Lang = b.language === "bn" ? "bn" : "en";
  const inv = b.invoices[0];
  const vars = (l: Lang): Record<string, string> => ({
    ref: b.reference, date: tripDate(b.tripDate.toISOString(), l), link: `${SITE()}/booking/${b.accessToken}`, site: SITE(),
    due: money(inv?.dueNow ?? 0, l), deadline: when(b.paymentDueAt ?? inv?.dueNowAt, l),
    balance: money(inv?.balance ?? 0, l), balanceAt: when(inv?.balanceAt ?? b.balanceDueAt, l),
    place: c("meetingPoint", l) || "Rangamati", phone: c("phone", l), review: c("facebook", l) || SITE(),
    pkg: b.type === "FULL_BOAT" ? "full boat" : "shared", guests: String(b.guests.length),
    total: money(inv?.total ?? b.lines.reduce((n, x) => n + x.total, 0), "en"), hold: when(b.holdExpiresAt, "en"),
  });
  return { b, lang, vars };
}

async function queue(data: Prisma.MessageCreateInput) {
  try {
    return await prisma.message.create({ data });
  } catch (e) {
    // Unique (booking, event, channel, to): this message was already queued.
    if ((e as { code?: string }).code === "P2002") return null;
    throw e;
  }
}

/** Queue (and try to send) the messages for one event. Never throws: messaging must not break bookings. */
export async function notify(event: EventKey, bookingId: string, extra: Record<string, string> = {}, opts: { repeatKey?: string } = {}) {
  try {
    const { b, lang, vars } = await bookingVars(bookingId);
    const v = { ...vars(lang), ...extra };
    const evKey = opts.repeatKey ? `${event}:${opts.repeatKey}` : event;
    const created = [];
    const tpl = T[lang][event];
    if (tpl) {
      created.push(await queue({ event: evKey, channel: "SMS", to: b.leadGuest.mobile, body: fill(tpl.sms, v), bookingId }));
      if (tpl.subject && b.leadGuest.email) {
        created.push(await queue({ event: evKey, channel: "EMAIL", to: b.leadGuest.email, subject: fill(tpl.subject, v), body: fill(tpl.sms, v), bookingId }));
      }
    }
    const staffTpl = STAFF[event];
    if (staffTpl) {
      const managers = await prisma.user.findMany({ where: { active: true, role: { in: ["MANAGER", "ADMIN"] } } });
      const body = fill(staffTpl, { ...vars("en"), ...extra });
      for (const m of managers) created.push(await queue({ event: `${evKey}:staff`, channel: "SMS", to: m.mobile, body, bookingId }));
    }
    await Promise.all(created.filter(Boolean).map((m) => deliver(m!.id)));
  } catch (e) {
    console.error(`notify ${event} failed`, e);
  }
}

/** Send one queued message through the configured gateway. */
export async function deliver(id: string) {
  const m = await prisma.message.findUniqueOrThrow({ where: { id } });
  if (m.status === "SENT") return m;
  const configured = m.channel === "SMS" ? !!process.env.SMS_URL_TEMPLATE : !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
  if (!configured) return prisma.message.update({ where: { id }, data: { status: "LOGGED" } });
  try {
    if (m.channel === "SMS") await sendSms(m.to, m.body);
    else await sendEmail(m.to, m.subject ?? "Mayaleen", m.body);
    return prisma.message.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), error: null } });
  } catch (e) {
    return prisma.message.update({ where: { id }, data: { status: "FAILED", error: String((e as Error).message).slice(0, 500) } });
  }
}

function toIntl(mobile: string) {
  const d = mobile.replace(/[^0-9]/g, "");
  return d.startsWith("880") ? d : d.startsWith("0") ? `88${d}` : d;
}

async function sendSms(to: string, text: string) {
  const url = process.env.SMS_URL_TEMPLATE!.replace("{to}", encodeURIComponent(toIntl(to))).replace("{text}", encodeURIComponent(text));
  const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`SMS gateway ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function sendEmail(to: string, subject: string, text: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Email ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

/** Retry queued/failed messages (cron). */
export async function retryOutbox(limit = 50) {
  const due = await prisma.message.findMany({ where: { status: { in: ["QUEUED", "FAILED"] } }, take: limit, orderBy: { createdAt: "asc" } });
  for (const m of due) await deliver(m.id);
  return due.length;
}

/** Time-based reminders N-05, N-11, N-12, N-14 (cron; duplicates are skipped by the outbox). */
export async function sendReminders(now = new Date()) {
  const soon = (h: number) => addHours(now, h);
  const today = toDhakaDate(now);
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000);
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000);
  const [pay, bal, dayBefore, thanks] = await Promise.all([
    prisma.booking.findMany({ where: { status: "AWAITING_PAYMENT", paymentDueAt: { gt: now, lte: soon(6) } }, select: { id: true } }),
    prisma.booking.findMany({ where: { status: "CONFIRMED_BALANCE_DUE", balanceDueAt: { gt: now, lte: soon(48) } }, select: { id: true } }),
    prisma.booking.findMany({ where: { tripDate: tomorrow, status: { in: ["CONFIRMED_BALANCE_DUE", "CONFIRMED_PAID"] } }, select: { id: true } }),
    prisma.booking.findMany({ where: { tripDate: yesterday, status: "COMPLETED" }, select: { id: true } }),
  ]);
  for (const b of pay) await notify("N-05", b.id);
  for (const b of bal) await notify("N-11", b.id);
  for (const b of dayBefore) await notify("N-12", b.id);
  for (const b of thanks) await notify("N-14", b.id);
  return { paymentReminders: pay.length, balanceReminders: bal.length, dayBefore: dayBefore.length, thanks: thanks.length };
}

export const CHANNELS: Channel[] = ["SMS", "EMAIL"];
