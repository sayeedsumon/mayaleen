import { Icon } from "@/components/ui";
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

export default async function BoatPage() {
  const lang = await getLang();
  const t = DICT[lang];
  const k = COPY[lang];
  const [cfg, types] = await Promise.all([
    loadPricingConfig(prisma),
    prisma.cabinType.findMany({ include: { cabins: { where: { active: true } } }, orderBy: { name: "asc" } }),
  ]);
  const r = cfg.rates;
  const display = lang === "bn" ? "font-bnDisplay" : "font-display";
  const eyebrow = "text-[13px] font-semibold uppercase tracking-[1.2px] text-lake";
  const h2 = `mt-1.5 text-[32px] font-medium leading-tight md:text-[40px] ${display}`;
  const cap = Math.min(cfg.settings.capacityCap, types.flatMap((x) => x.cabins).reduce((n, c) => n + c.capacity, 0));
  const panel = (dark = false) => ({ background: dark ? "repeating-linear-gradient(135deg,#123E3A 0 12px,#0F3633 12px 24px)" : "repeating-linear-gradient(135deg,#E9E5DC 0 12px,#E2DDD2 12px 24px)" });
  const tl = (items: [string, string][]) => items.map(([time, what], i) => (
    <div key={i} className="grid grid-cols-[64px_16px_minmax(0,1fr)] gap-x-3.5">
      <span className="pb-3.5 pt-0.5 text-sm font-semibold text-lake">{time}</span>
      <span className="flex flex-col items-center"><span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-lake" /><span className="w-0.5 flex-1 bg-[#D7E6E3]" /></span>
      <span className="pb-3.5 text-[15px]">{what}</span>
    </div>
  ));

  return (
    <main>
      <section aria-labelledby="boat-h" className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-10 px-4 pt-12 md:px-8">
        <div className="min-w-[300px] flex-[1_1_440px]">
          <div className={eyebrow}>{k.eyebrow}</div>
          <h1 id="boat-h" className={`mt-2 text-[38px] font-medium leading-[1.08] md:text-[54px] ${display}`}>{k.title}</h1>
          <p className="mt-4 text-[17px] leading-[27px] text-ink-2">{k.lead}</p>
        </div>
        <div aria-hidden="true" className="flex min-h-[280px] min-w-[300px] flex-[1_1_520px] items-center justify-center rounded-2xl text-[#C9C2B4] md:min-h-[380px]" style={panel()}><Icon name="boat" size={56} /></div>
      </section>

      <section aria-labelledby="cab-h" className="mx-auto mt-20 max-w-[1200px] px-4 md:px-8">
        <div className={eyebrow}>{k.cabins}</div>
        <h2 id="cab-h" className={h2}>{k.cabinsTitle}</h2>
        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-3">
          {types.filter((x) => x.cabins.length).map((ty) => (
            <article key={ty.id} className="card overflow-hidden">
              <div aria-hidden="true" className="h-[200px]" style={panel()} />
              <div className="p-5">
                <h3 className="text-[19px] font-semibold">{ty.name}</h3>
                <p className="mt-1.5 text-sm leading-[21px] text-ink-2">
                  {k.sleeps.replace("{n}", num(Math.max(...ty.cabins.map((c) => c.capacity)), lang))} · {num(ty.cabins.length, lang)} × {lang === "bn" ? "কেবিন" : ty.cabins.length > 1 ? "cabins" : "cabin"}
                  {ty.surcharge > 0 ? ` · +${money(ty.surcharge, lang)}` : ""}
                </p>
                {(lang === "bn" ? ty.descriptionBn : ty.descriptionEn) && <p className="mt-1.5 text-sm text-ink-2">{lang === "bn" ? ty.descriptionBn : ty.descriptionEn}</p>}
              </div>
            </article>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
          {k.amenities.map(([h, p]) => <div key={h} className="card p-[18px]"><div className="font-semibold">{h}</div><div className="mt-1 text-sm text-ink-2">{p}</div></div>)}
        </div>
      </section>

      <section id="packages" aria-labelledby="pk-h" className="mx-auto mt-24 max-w-[1200px] scroll-mt-4 px-4 md:px-8">
        <div className={eyebrow}>{t.nav.packages}</div>
        <h2 id="pk-h" className={h2}>{k.pkTitle}</h2>
        <div className="card mt-7 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[15px]">
            <thead><tr className="text-left text-[13px] text-ink-muted">
              <th className="border-b border-line px-6 py-4 font-semibold">{k.pkg}</th>
              <th className="border-b border-line px-3 py-4 font-semibold">{t.packages.sunWed}</th>
              <th className="border-b border-line px-3 py-4 font-semibold">{t.packages.thuSat}</th>
              <th className="border-b border-line px-3 py-4 font-semibold">{t.packages.fri}</th>
              <th className="border-b border-line px-6 py-4 font-semibold">{k.food}</th>
            </tr></thead>
            <tbody>
              <tr>
                <td className="border-b border-hair px-6 py-[18px]"><div className="font-semibold">{k.sharedRow}</div><div className="text-[13px] text-ink-muted">{k.sharedSub}</div></td>
                <td className="border-b border-hair px-3 py-[18px] font-semibold">{money(r.SHARED.SUN_WED, lang)}</td>
                <td className="border-b border-hair px-3 py-[18px] font-semibold">{money(r.SHARED.THU_SAT, lang)}</td>
                <td className="border-b border-hair px-3 py-[18px] font-semibold">{money(r.SHARED.FRIDAY, lang)}</td>
                <td className="border-b border-hair px-6 py-[18px]">{k.foodIncl}</td>
              </tr>
              <tr>
                <td className="border-b border-hair px-6 py-[18px]"><div className="font-semibold">{k.fullRow}</div><div className="text-[13px] text-ink-muted">{k.fullSub.replace("{n}", num(cap, lang))}</div></td>
                <td className="border-b border-hair px-3 py-[18px] font-semibold">{money(r.FULL_BOAT.SUN_WED, lang)}</td>
                <td className="border-b border-hair px-3 py-[18px] font-semibold">{money(r.FULL_BOAT.THU_SAT, lang)}</td>
                <td className="border-b border-hair px-3 py-[18px] font-semibold">{money(r.FULL_BOAT.FRIDAY, lang)}</td>
                <td className="border-b border-hair px-6 py-[18px]">{k.foodOpt.replace("{price}", money(r.FULL_BOAT_FOOD.SUN_WED, lang))}</td>
              </tr>
            </tbody>
          </table>
          <div className="flex flex-wrap gap-6 px-6 py-[18px] text-sm text-ink-2">
            {cfg.ageBands.map((b) => <span key={b.name}><strong className="text-ink">{b.name}:</strong> {b.pctOfAdult === 0 ? (lang === "bn" ? "ফ্রি" : "free") : b.pctOfAdult === 100 ? (lang === "bn" ? "পুরো দাম" : "full price") : `${num(b.pctOfAdult, lang)}%`}</span>)}
            <span>{k.payNote.replace("{pct}", num(cfg.settings.advancePct, lang)).replace("{h}", num(cfg.settings.balanceLeadHours, lang))}</span>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="card p-6"><h3 className="mb-2.5 text-[17px] font-semibold">{k.inc}</h3><ul className="list-disc pl-5 text-[15px] leading-[26px] text-ink-2">{k.incList.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div className="card p-6"><h3 className="mb-2.5 text-[17px] font-semibold">{k.notInc}</h3><ul className="list-disc pl-5 text-[15px] leading-[26px] text-ink-2">{k.notIncList.map((x) => <li key={x}>{x}</li>)}</ul></div>
        </div>
      </section>

      <section id="itinerary" aria-labelledby="it-h" className="mx-auto mt-24 max-w-[1200px] scroll-mt-4 px-4 md:px-8">
        <div className={eyebrow}>{k.itEyebrow}</div>
        <h2 id="it-h" className={h2}>{k.itTitle}</h2>
        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2">
          <article className="card p-7"><h3 className={`mb-[18px] text-[26px] font-medium ${display}`}>{k.day1}</h3>{tl(k.d1)}</article>
          <article className="card p-7"><h3 className={`mb-[18px] text-[26px] font-medium ${display}`}>{k.day2}</h3>{tl(k.d2)}</article>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-5 rounded-2xl bg-lake-deep p-8 text-white">
          <div className="min-w-[280px] flex-[1_1_400px]"><h3 className={`text-[30px] font-medium text-white ${display}`}>{k.ready}</h3><p className="mt-2 text-[#D4E6E2]">{k.readyText}</p></div>
          <a href="/book" className="btn h-12 bg-white text-lake-dark hover:bg-[#E2EEEB] hover:text-lake-dark">{t.hero.cta}</a>
        </div>
      </section>
    </main>
  );
}
