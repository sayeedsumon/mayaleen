import type { Metadata } from "next";
import { DICT } from "@/lib/i18n";
import { getContent, getLang } from "@/server/site-content";
import { findBookingAction } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const c = await getContent(await getLang());
  return { title: `${c.findTitle} · ${c.siteName}` };
}

const COPY = {
  en: { title: "Find my booking", lead: "Enter your booking reference and mobile number. We'll text the private link to that number.", ref: "Booking reference", mobile: "Mobile number", send: "Text me the link", sent: "If the details match a booking, we've sent the link by SMS. It can take a minute.", help: "No SMS? Call us" },
  bn: { title: "আমার বুকিং খুঁজুন", lead: "বুকিং রেফারেন্স ও মোবাইল নম্বর দিন। ওই নম্বরে আমরা ব্যক্তিগত লিংক এসএমএস করব।", ref: "বুকিং রেফারেন্স", mobile: "মোবাইল নম্বর", send: "লিংক এসএমএস করুন", sent: "তথ্য মিললে আমরা এসএমএসে লিংক পাঠিয়েছি। এক মিনিট লাগতে পারে।", help: "এসএমএস পাননি? কল করুন" },
};

export default async function FindBooking({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const sp = await searchParams;
  const lang = await getLang();
  const k = COPY[lang];
  const c = await getContent(lang);
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-10 pt-12 md:pt-16">
      <h1 className={`text-[32px] font-light leading-tight tracking-[-0.5px] md:text-[48px] ${lang === "bn" ? "font-bnDisplay" : "font-display"}`}>{c.findTitle}</h1>
      {c.findLead && <p className="text-[15px] text-ink-2">{c.findLead}</p>}
      {sp.sent && <p role="status" className="rounded-xl bg-lake-soft px-4 py-3 text-sm text-lake-dark">{k.sent}</p>}
      {sp.error && <p role="alert" className="rounded-xl bg-rose-soft px-4 py-3 text-sm text-rose-ink">{sp.error}</p>}
      <form action={findBookingAction} className="rounded-3xl border border-dune-line bg-white flex flex-col gap-3 p-5">
        <div className="absolute left-[-9999px]" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <label className="label">{k.ref}<input name="reference" required placeholder="MYL-261121-02" className="input h-12 uppercase" /></label>
        <label className="label">{k.mobile}<input name="mobile" required inputMode="tel" placeholder="01XXXXXXXXX" className="input h-12" /></label>
        <button className="s-s-btn h-12">{k.send}</button>
      </form>
      {c.phone && <a href={`tel:${c.phone}`} className="text-sm font-semibold">{k.help} {c.phone}</a>}
      <p className="text-xs text-ink-muted">{DICT[lang].book.holdNote.replace("{h}", "12")}</p>
    </main>
  );
}
