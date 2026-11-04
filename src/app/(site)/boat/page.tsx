import Image from "next/image";
import { getSitePhotos } from "@/server/photos";
import { DICT, money, num, type Lang } from "@/lib/i18n";
import { loadPricingConfig } from "@/server/config";
import { prisma } from "@/server/db";
import { getLang } from "@/server/site-content";

export const metadata = { title: "The boat, packages and itinerary · Mayaleen" };

const COPY: Record<Lang, {
  eyebrow: string; title: string; lead: string; cabins: string; cabinsTitle: string; sleeps: string; amenities: [string, string][];
  pkTitle: string; pkg: string; food: string; sharedRow: string; sharedSub: string; fullRow: string; fullSub: string; included: string; foodIncl: string; foodOpt: string;
  childNote: string; payNote: string; inc: string; incList: string[]; notInc: string; notIncList: string[]; itEyebrow: string; itTitle: string;
  day1: string; day2: string; d1: [string, string][]; d2: [string, string][]; ready: string; readyText: string;
}> = {
  en: {
    eyebrow: "The boat", title: "A catamaran villa built for the lake",
    lead: "Mayaleen is a fibreglass catamaran: steady on the water, quiet at anchor. Glass-walled AC cabins below, a lounge in the middle and a rooftop deck with a jacuzzi on top.",
    cabins: "Cabins", cabinsTitle: "Wake up to the water", sleeps: "Sleeps up to {n}",
    amenities: [["Lounge", "Sofas, dining table, music."], ["Rooftop deck", "Sunset, stars, the moon watch."], ["Jacuzzi", "On the roof, open in the evening."], ["Safety", "Life jackets for everyone and a trained crew."]],
    pkTitle: "One trip, two ways to book", pkg: "Package", food: "Food", sharedRow: "Shared cabins", sharedSub: "per guest · book 2 or more cabins",
    fullRow: "Whole boat", fullSub: "per trip · up to {n} guests", included: "Included", foodIncl: "Included, fixed menu", foodOpt: "{price} per guest, optional",
    childNote: "Age bands", payNote: "Pay in full, or {pct}% advance and the rest {h} hours before boarding.",
    inc: "Included", incList: ["Cabin for the night, AC", "Lunch, snacks, dinner and breakfast (shared trips)", "Kayaks, fishing gear and life jackets", "Sunset cruise and the day-two tourist boat"],
    notInc: "Not included", notIncList: ["Travel to Rangamati", "Entry tickets at tourist spots"],
    itEyebrow: "Itinerary", itTitle: "Two days on Kaptai Lake", day1: "Day 1 · on the boat", day2: "Day 2 · around Rangamati",
    d1: [["13:00", "Check in and settle into your cabin"], ["", "Tree plantation"], ["", "Lunch on board"], ["", "Swimming and kayaking"], ["", "Fishing"], ["Evening", "Sunset cruise"], ["", "Snacks on deck"], ["Night", "Moon watch on the rooftop"], ["", "Dinner"]],
    d2: [["Morning", "Breakfast"], ["11:00", "Check out"], ["", "Tourist boat to Hanging Bridge"], ["", "Shuvolong Fountain"], ["", "Buddha Temple"], ["", "Lunch at Shorgo-chera"], ["", "Adivasi village"], ["18:00", "Trip ends"]],
    ready: "Ready for the lake?", readyText: "See which dates are free and what your group pays.",
  },
  bn: {
    eyebrow: "বোট", title: "হ্রদের জন্য তৈরি একটি ক্যাটামারান ভিলা",
    lead: "মায়ালীন একটি ফাইবারগ্লাস ক্যাটামারান: পানিতে স্থির, নোঙরে নিঃশব্দ। নিচে কাঁচঘেরা এসি কেবিন, মাঝে লাউঞ্জ আর ছাদে জাকুজিসহ ডেক।",
    cabins: "কেবিন", cabinsTitle: "পানির দিকে তাকিয়ে ঘুম ভাঙবে", sleeps: "{n} জন পর্যন্ত",
    amenities: [["লাউঞ্জ", "সোফা, খাবার টেবিল, গান।"], ["ছাদের ডেক", "সূর্যাস্ত, তারা, চাঁদ দেখা।"], ["জাকুজি", "ছাদে, সন্ধ্যায় খোলা।"], ["নিরাপত্তা", "সবার জন্য লাইফ জ্যাকেট ও প্রশিক্ষিত ক্রু।"]],
    pkTitle: "এক ট্রিপ, বুকিংয়ের দুই উপায়", pkg: "প্যাকেজ", food: "খাবার", sharedRow: "শেয়ার্ড কেবিন", sharedSub: "জনপ্রতি · ২ বা তার বেশি কেবিন",
    fullRow: "পুরো বোট", fullSub: "প্রতি ট্রিপ · {n} জন পর্যন্ত", included: "অন্তর্ভুক্ত", foodIncl: "অন্তর্ভুক্ত, নির্দিষ্ট মেনু", foodOpt: "জনপ্রতি {price}, ঐচ্ছিক",
    childNote: "বয়সভিত্তিক দাম", payNote: "পুরো টাকা দিন, অথবা {pct}% অগ্রিম আর বাকিটা ওঠার {h} ঘণ্টা আগে।",
    inc: "অন্তর্ভুক্ত", incList: ["এক রাতের কেবিন, এসি", "দুপুর, নাশতা, রাত ও সকালের খাবার (শেয়ার্ড ট্রিপ)", "কায়াক, মাছ ধরার সরঞ্জাম ও লাইফ জ্যাকেট", "সূর্যাস্ত ক্রুজ ও দ্বিতীয় দিনের ট্যুরিস্ট বোট"],
    notInc: "অন্তর্ভুক্ত নয়", notIncList: ["রাঙামাটি পর্যন্ত যাতায়াত", "দর্শনীয় স্থানের টিকিট"],
    itEyebrow: "ভ্রমণসূচি", itTitle: "কাপ্তাই হ্রদে দুই দিন", day1: "প্রথম দিন · বোটে", day2: "দ্বিতীয় দিন · রাঙামাটি ঘোরা",
    d1: [["১:০০", "চেক ইন ও কেবিনে ওঠা"], ["", "বৃক্ষরোপণ"], ["", "বোটে দুপুরের খাবার"], ["", "সাঁতার ও কায়াকিং"], ["", "মাছ ধরা"], ["সন্ধ্যা", "সূর্যাস্ত ক্রুজ"], ["", "ডেকে নাশতা"], ["রাত", "ছাদে চাঁদ দেখা"], ["", "রাতের খাবার"]],
    d2: [["সকাল", "নাশতা"], ["১১:০০", "চেক আউট"], ["", "ঝুলন্ত সেতুতে ট্যুরিস্ট বোট"], ["", "শুভলং ঝর্ণা"], ["", "বৌদ্ধ মন্দির"], ["", "স্বর্গছেড়ায় দুপুরের খাবার"], ["", "আদিবাসী গ্রাম"], ["৬:০০", "ট্রিপ শেষ"]],
    ready: "হ্রদে যেতে প্রস্তুত?", readyText: "কোন তারিখ খালি আর আপনার দলের খরচ কত, দেখুন।",
  },
};

const EXTRA: Record<Lang, { guests: string; cabins: string; trip: string; boarding: string; boardingV: string; tripV: string; free: string; full: string }> = {
  en: { guests: "Guests", cabins: "Cabins", trip: "Trip", boarding: "Boarding", boardingV: "13:00, Rangamati", tripV: "2 days · 1 night", free: "free", full: "full price" },
  bn: { guests: "অতিথি", cabins: "কেবিন", trip: "ট্রিপ", boarding: "ওঠা", boardingV: "দুপুর ১টা, রাঙামাটি", tripV: "২ দিন · ১ রাত", free: "ফ্রি", full: "পুরো দাম" },
};

const ICONS: string[] = [
  "M3 18h18M5 18v-5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5M8 11V8h8v3",
  "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5",
  "M3 14h18v2a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-2zM7 10c0-1 1-1.5 1-2.5S7 6 7 5M12 10c0-1 1-1.5 1-2.5S12 6 12 5M17 10c0-1 1-1.5 1-2.5S17 6 17 5",
  "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6",
];

export default async function BoatPage() {
  const lang = await getLang();
  const t = DICT[lang];
  const k = COPY[lang];
  const x = EXTRA[lang];
  const [cfg, types, photos] = await Promise.all([
    loadPricingConfig(prisma),
    prisma.cabinType.findMany({ include: { cabins: { where: { active: true } } }, orderBy: { name: "asc" } }),
    getSitePhotos(),
  ]);
  const r = cfg.rates;
  const display = lang === "bn" ? "font-bnDisplay" : "font-display";
  const h2 = `s-h2 mt-3 md:mt-3.5 ${display}`;
  const allCabins = types.flatMap((ty) => ty.cabins);
  const cap = Math.min(cfg.settings.capacityCap, allCabins.reduce((n, c) => n + c.capacity, 0));
  const shown = types.filter((ty) => ty.cabins.length);
  const facts: [string, string][] = [[x.guests, num(cap, lang)], [x.cabins, num(allCabins.length, lang)], [x.trip, x.tripV], [x.boarding, x.boardingV]];
  const day = (title: string, items: [string, string][]) => {
    const [a, ...b] = title.split(" · ");
    return (
      <article className="rounded-3xl border border-dune-rule bg-white p-6 md:p-9">
        <h3 className={`text-[26px] md:text-[28px] ${display}`}>{a}{b.length > 0 && <span className="italic text-ink-muted"> · {b.join(" · ")}</span>}</h3>
        <ol className="mt-5 flex flex-col md:mt-6">
          {items.map(([time, what], i) => (
            <li key={i} className="grid grid-cols-[84px_minmax(0,1fr)] gap-2 border-t border-[#EFE9DE] py-3 text-[15px] md:grid-cols-[96px_minmax(0,1fr)]">
              <b className="text-pine">{time}</b><span>{what}</span>
            </li>
          ))}
        </ol>
      </article>
    );
  };

  return (
    <main>
      <section aria-labelledby="boat-h" className="s-dark relative h-[560px] bg-pine-night text-white md:h-[700px]">
        <Image src={photos.boat.src} alt={photos.boat.alt} fill priority sizes="100vw" className="object-cover" style={{ objectPosition: photos.boat.pos ?? "50% 60%" }} />
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,22,20,0.55)_0%,rgba(6,22,20,0.1)_35%,rgba(6,22,20,0.7)_100%)]" />
        <div className="absolute inset-x-0 bottom-12 md:bottom-20">
          <div className="s-wrap">
            <div className="s-eyebrow-light">{k.eyebrow}</div>
            <h1 id="boat-h" className={`mt-3.5 max-w-[900px] text-[46px] font-light leading-none tracking-[-1px] md:mt-4 md:text-[88px] md:tracking-[-2px] ${display}`}>{k.title}</h1>
          </div>
        </div>
      </section>

      <section aria-label={k.eyebrow} className="s-wrap grid grid-cols-1 gap-10 pt-14 md:grid-cols-12 md:gap-6 md:pt-[110px]">
        <p className={`text-[26px] font-light leading-[1.35] md:col-span-7 md:text-[36px] md:leading-[1.3] ${display}`}>{k.lead}</p>
        <dl className="md:col-span-4 md:col-start-9">
          {facts.map(([a, b], i) => (
            <div key={a} className={`flex justify-between gap-4 border-t border-dune-rule py-[18px] ${i === facts.length - 1 ? "border-b" : ""}`}><dt className="text-ink-muted">{a}</dt><dd className="font-semibold">{b}</dd></div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="cab-h" className="s-wrap pt-20 md:pt-[130px]">
        <div className="s-eyebrow">{k.cabins}</div>
        <h2 id="cab-h" className={h2}>{k.cabinsTitle}</h2>
        <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 md:mt-12 md:gap-6 lg:grid-cols-3">
          {shown.map((ty, i) => {
            const pic = photos.cabins[i % photos.cabins.length];
            const desc = lang === "bn" ? ty.descriptionBn : ty.descriptionEn;
            return (
              <article key={ty.id} className="flex flex-col gap-4">
                <div className="relative h-[320px] overflow-hidden rounded-3xl bg-dune md:h-[420px]">
                  <Image src={pic.src} alt={pic.alt} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" style={{ objectPosition: pic.pos ?? "50% 40%" }} />
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className={`text-[28px] md:text-[30px] ${display}`}>{ty.name}</h3>
                  <span className="text-sm text-ink-muted">
                    {k.sleeps.replace("{n}", num(Math.max(...ty.cabins.map((c) => c.capacity)), lang))} · {num(ty.cabins.length, lang)} × {lang === "bn" ? "কেবিন" : ty.cabins.length > 1 ? "cabins" : "cabin"}
                    {ty.surcharge > 0 ? ` · +${money(ty.surcharge, lang)}` : ""}
                  </span>
                </div>
                {desc && <p className="text-[15px] leading-[23px] text-ink-2">{desc}</p>}
              </article>
            );
          })}
        </div>
        <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {k.amenities.map(([h, p], i) => (
            <div key={h} className="rounded-[20px] bg-dune p-5 md:p-6">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0F3B36" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[i % ICONS.length]} /></svg>
              <div className="mt-3.5 text-[17px] font-semibold">{h}</div>
              <div className="mt-1 text-sm text-ink-2">{p}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="packages" aria-labelledby="pk-h" className="s-wrap scroll-mt-4 pt-20 md:pt-[130px]">
        <div className="s-eyebrow">{t.nav.packages}</div>
        <h2 id="pk-h" className={h2}>{k.pkTitle}</h2>
        <div className="mt-8 overflow-x-auto rounded-3xl border border-dune-rule bg-white md:mt-11">
          <table className="w-full min-w-[760px] border-collapse text-base">
            <thead><tr className="text-left text-xs uppercase tracking-[1.4px] text-ink-muted">
              <th className="border-b border-dune-rule px-7 py-5 font-semibold">{k.pkg}</th>
              <th className="border-b border-dune-rule px-4 py-5 font-semibold">{t.packages.sunWed}</th>
              <th className="border-b border-dune-rule px-4 py-5 font-semibold">{t.packages.thuSat}</th>
              <th className="border-b border-dune-rule px-4 py-5 font-semibold">{t.packages.fri}</th>
              <th className="border-b border-dune-rule px-7 py-5 font-semibold">{k.food}</th>
            </tr></thead>
            <tbody>
              <tr>
                <td className="border-b border-[#EFE9DE] px-7 py-6"><div className={`text-2xl ${display}`}>{k.sharedRow}</div><div className="text-[13px] text-ink-muted">{k.sharedSub}</div></td>
                <td className="border-b border-[#EFE9DE] px-4 py-6 font-semibold">{money(r.SHARED.SUN_WED, lang)}</td>
                <td className="border-b border-[#EFE9DE] px-4 py-6 font-semibold">{money(r.SHARED.THU_SAT, lang)}</td>
                <td className="border-b border-[#EFE9DE] px-4 py-6 font-semibold">{money(r.SHARED.FRIDAY, lang)}</td>
                <td className="border-b border-[#EFE9DE] px-7 py-6 text-ink-2">{k.foodIncl}</td>
              </tr>
              <tr>
                <td className="px-7 py-6"><div className={`text-2xl ${display}`}>{k.fullRow}</div><div className="text-[13px] text-ink-muted">{k.fullSub.replace("{n}", num(cap, lang))}</div></td>
                <td className="px-4 py-6 font-semibold">{money(r.FULL_BOAT.SUN_WED, lang)}</td>
                <td className="px-4 py-6 font-semibold">{money(r.FULL_BOAT.THU_SAT, lang)}</td>
                <td className="px-4 py-6 font-semibold">{money(r.FULL_BOAT.FRIDAY, lang)}</td>
                <td className="px-7 py-6 text-ink-2">{k.foodOpt.replace("{price}", money(r.FULL_BOAT_FOOD.SUN_WED, lang))}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
          <div className="rounded-3xl bg-pine p-7 text-white md:p-8">
            <div className="s-eyebrow-light">{k.inc}</div>
            <ul className="mt-4 flex flex-col gap-3 text-base">{k.incList.map((i) => <li key={i}>{i}</li>)}</ul>
          </div>
          <div className="rounded-3xl bg-dune p-7 md:p-8">
            <div className="text-xs font-semibold uppercase tracking-[2.6px] text-ink-muted md:text-[13px]">{k.notInc}</div>
            <ul className="mt-4 flex flex-col gap-3 text-base">{k.notIncList.map((i) => <li key={i}>{i}</li>)}</ul>
            <p className="mt-6 text-sm leading-[22px] text-ink-2">
              {cfg.ageBands.map((b) => `${b.name}: ${b.pctOfAdult === 0 ? x.free : b.pctOfAdult === 100 ? x.full : `${num(b.pctOfAdult, lang)}%`}`).join(" · ")}.{" "}
              {k.payNote.replace("{pct}", num(cfg.settings.advancePct, lang)).replace("{h}", num(cfg.settings.balanceLeadHours, lang))}
            </p>
          </div>
        </div>
      </section>

      <section id="itinerary" aria-labelledby="it-h" className="s-wrap scroll-mt-4 pt-20 md:pt-[130px]">
        <div className="s-eyebrow">{k.itEyebrow}</div>
        <h2 id="it-h" className={h2}>{k.itTitle}</h2>
        <div className="mt-8 grid grid-cols-1 gap-5 md:mt-12 md:grid-cols-2 md:gap-6">
          {day(k.day1, k.d1)}
          {day(k.day2, k.d2)}
        </div>
      </section>

      <section aria-labelledby="ready-h" className="s-wrap pt-20 md:pt-[130px]">
        <div className="s-dark flex flex-wrap items-center justify-between gap-8 rounded-3xl bg-pine p-8 text-white md:rounded-[32px] md:p-[72px]">
          <div>
            <h2 id="ready-h" className={`s-h2 ${display}`}>{k.ready}</h2>
            <p className="mt-3.5 text-[17px] text-white/85">{k.readyText}</p>
          </div>
          <a href="/book" className="s-btn-light h-14 px-[30px] text-base">{t.hero.cta}</a>
        </div>
      </section>
    </main>
  );
}
