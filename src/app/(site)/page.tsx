import Image from "next/image";
import { addDays, toDhakaDate } from "@/domain";
import { DICT, fill, money, num, type Lang } from "@/lib/i18n";
import { loadPricingConfig } from "@/server/config";
import { prisma } from "@/server/db";
import { getSitePhotos, type SitePic } from "@/server/photos";
import { getContent, getLang } from "@/server/site-content";

const COPY: Record<Lang, {
  every: string; nights: string; times: string; marquee: string[];
  welcome: string; introA: string; introEm: string; introB: string; introText: string;
  statGuests: string; statBoard: string; statOut: string;
  waysA: string; waysEm: string; seePrices: string; foodTag: string; upTo: string;
  onBoard: string; doA: string; doEm: string; todo: [string, string][];
  daysEyebrow: string; daysA: string; daysEm: string; days: [string, string, string][]; fullItinerary: string;
  galA: string; galEm: string; follow: string; guestsSay: string; freeDates: string;
}> = {
  en: {
    every: "Every trip", nights: "2 days · 1 night", times: "Board 13:00 · check out 11:00",
    marquee: ["Glass cabins", "Rooftop jacuzzi", "Swim & kayak", "Moonrise on the lake", "Meals cooked on board", "Hanging Bridge"],
    welcome: "Welcome aboard", introA: "Glass walls, open water, and ", introEm: "nothing on the schedule", introB: " but the lake.",
    introText: "Mayaleen is a houseboat that leaves Rangamati at lunchtime and anchors in the quiet of Kaptai Lake for the night. Share it with other travellers cabin by cabin, or take the whole boat for your family, friends or team.",
    statGuests: "guests at most, so it never feels crowded", statBoard: "boarding in Rangamati", statOut: "check-out on day two",
    waysA: "Share the boat, or ", waysEm: "have it to yourselves", seePrices: "See prices for your date →", foodTag: "Food included", upTo: "Up to {n} guests",
    onBoard: "On board", doA: "What you will ", doEm: "actually do",
    todo: [["Swim, kayak and fish", "Life rings and jackets on board. Jump in straight from the deck."], ["Sunset on the rooftop deck", "Loungers, the jacuzzi, and the hills turning gold."], ["Moonrise and stargazing", "No city lights out here. Dinner cooked on board, then the sky."], ["Hanging Bridge & Shuvolong", "A tourist boat takes you there on day two."]],
    daysEyebrow: "Your two days", daysA: "A night on the water, ", daysEm: "a day around Rangamati",
    days: [["Day 1 · 13:00", "Board in Rangamati", "Settle into your cabin, plant a tree, lunch on board."], ["Day 1 · afternoon", "Swim, kayak, fish", "Then a sunset cruise with snacks on deck."], ["Day 1 · night", "Moon watch & dinner", "On the rooftop, with the lake outside the glass."], ["Day 2 · 11:00", "Check out, explore", "Hanging Bridge, Shuvolong and an Adivasi village. Trip ends 18:00."]],
    fullItinerary: "Full itinerary →", galA: "Moments ", galEm: "from the lake", follow: "Follow us on Facebook →", guestsSay: "Guests say",
    freeDates: "Check free dates",
  },
  bn: {
    every: "প্রতিটি ট্রিপ", nights: "২ দিন · ১ রাত", times: "দুপুর ১টায় ওঠা · ১১টায় চেক আউট",
    marquee: ["কাঁচঘেরা কেবিন", "ছাদে জাকুজি", "সাঁতার ও কায়াক", "হ্রদে চাঁদ ওঠা", "বোটে রান্না করা খাবার", "ঝুলন্ত সেতু"],
    welcome: "স্বাগতম", introA: "কাঁচের দেয়াল, খোলা পানি, আর ", introEm: "হ্রদ ছাড়া কোনো তাড়া নেই", introB: "।",
    introText: "মায়ালীন একটি হাউসবোট, যা দুপুরে রাঙামাটি থেকে ছেড়ে রাতটা কাপ্তাই হ্রদের নিরিবিলিতে নোঙর করে। অন্য অতিথিদের সাথে কেবিন শেয়ার করুন, অথবা পরিবার, বন্ধু বা অফিসের জন্য পুরো বোট নিন।",
    statGuests: "জন পর্যন্ত, তাই কখনো ভিড় লাগে না", statBoard: "রাঙামাটিতে ওঠা", statOut: "দ্বিতীয় দিন চেক আউট",
    waysA: "কেবিন শেয়ার করুন, অথবা ", waysEm: "পুরো বোট নিজেদের", seePrices: "আপনার তারিখের দাম দেখুন →", foodTag: "খাবারসহ", upTo: "{n} জন পর্যন্ত",
    onBoard: "বোটে", doA: "যা যা ", doEm: "করবেন",
    todo: [["সাঁতার, কায়াক ও মাছ ধরা", "বোটে লাইফ রিং ও জ্যাকেট আছে। ডেক থেকেই পানিতে নামুন।"], ["ছাদের ডেকে সূর্যাস্ত", "লাউঞ্জার, জাকুজি আর সোনালি পাহাড়।"], ["চাঁদ ওঠা ও তারা দেখা", "শহরের আলো নেই। বোটে রাতের খাবার, তারপর আকাশ।"], ["ঝুলন্ত সেতু ও শুভলং", "দ্বিতীয় দিন ট্যুরিস্ট বোটে নিয়ে যাওয়া হয়।"]],
    daysEyebrow: "আপনার দুই দিন", daysA: "এক রাত পানিতে, ", daysEm: "এক দিন রাঙামাটি ঘোরা",
    days: [["১ম দিন · ১টা", "রাঙামাটিতে ওঠা", "কেবিনে উঠুন, গাছ লাগান, বোটে দুপুরের খাবার।"], ["১ম দিন · বিকেল", "সাঁতার, কায়াক, মাছ ধরা", "তারপর ডেকে নাশতাসহ সূর্যাস্ত ক্রুজ।"], ["১ম দিন · রাত", "চাঁদ দেখা ও রাতের খাবার", "ছাদে, কাঁচের বাইরে হ্রদ।"], ["২য় দিন · ১১টা", "চেক আউট, ঘোরাঘুরি", "ঝুলন্ত সেতু, শুভলং আর আদিবাসী গ্রাম। সন্ধ্যা ৬টায় শেষ।"]],
    fullItinerary: "পুরো ভ্রমণসূচি →", galA: "হ্রদের ", galEm: "কিছু মুহূর্ত", follow: "ফেসবুকে আমাদের দেখুন →", guestsSay: "অতিথিরা বলেন",
    freeDates: "খালি তারিখ দেখুন",
  },
};

function Pic({ pic, className = "", priority = false, sizes = "(min-width: 768px) 50vw, 100vw" }: { pic: SitePic; className?: string; priority?: boolean; sizes?: string }) {
  return (
    <div className={`${/\babsolute\b/.test(className) ? "" : "relative"} overflow-hidden bg-dune ${className}`}>
      <Image src={pic.src} alt={pic.alt} fill priority={priority} sizes={sizes} className="object-cover" style={{ objectPosition: pic.pos ?? "center" }} />
    </div>
  );
}

export default async function Home() {
  const lang = await getLang();
  const t = DICT[lang];
  const k = COPY[lang];
  const [c, cfg, photos] = await Promise.all([getContent(lang), loadPricingConfig(prisma), getSitePhotos()]);
  const r = cfg.rates;
  const display = lang === "bn" ? "font-bnDisplay" : "font-display";
  const h2 = `s-h2 ${display}`;
  const min = toDhakaDate(new Date());
  const defaultDate = addDays(min, cfg.settings.cutoffDays + 1);
  const reviews = c.reviews.split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((x) => x[0]);
  const wa = c.whatsapp.replace(/[^0-9]/g, "");
  const cap = num(cfg.settings.capacityCap, lang);
  const g = photos.gallery;
  const introBig = g[0] ?? photos.boat;
  const introSmall = photos.reach;
  const field = "flex flex-col gap-1 px-4 py-3 text-[11px] font-semibold uppercase tracking-[1px] text-ink-muted md:px-[22px] md:py-3.5 md:text-xs";
  const fieldInput = "w-full border-0 bg-transparent p-0 text-base font-medium normal-case tracking-normal text-ink focus:outline-none md:text-[17px]";
  const days = [
    [t.packages.sunWed, r.SHARED.SUN_WED, r.FULL_BOAT.SUN_WED],
    [t.packages.thuSat, r.SHARED.THU_SAT, r.FULL_BOAT.THU_SAT],
    [t.packages.fri, r.SHARED.FRIDAY, r.FULL_BOAT.FRIDAY],
  ] as const;

  return (
    <main>
      {/* HERO */}
      <section aria-labelledby="hero-h" className="s-dark relative h-[720px] bg-pine-night text-white md:h-[880px]">
        <Pic pic={photos.hero} priority sizes="100vw" className="absolute inset-0" />
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,22,20,0.55)_0%,rgba(6,22,20,0.05)_30%,rgba(6,22,20,0.15)_55%,rgba(6,22,20,0.7)_100%)]" />
        <div className="absolute inset-x-0 bottom-[110px] md:bottom-[150px]">
          <div className="s-wrap flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-[820px]">
              <div className="s-eyebrow-light">{t.place}</div>
              <h1 id="hero-h" className={`mt-3.5 text-[52px] font-light leading-none tracking-[-1px] md:mt-[18px] md:text-[104px] md:leading-[0.98] md:tracking-[-2px] ${display}`}>{c.heroTitle}</h1>
              <p className="mt-4 max-w-[520px] text-base leading-6 text-white/90 md:mt-[26px] md:text-lg md:leading-7">{c.heroText}</p>
            </div>
            <div className="hidden min-w-[230px] flex-col gap-1.5 rounded-[18px] border border-white/30 bg-white/15 px-6 py-5 backdrop-blur-md md:flex">
              <div className="text-xs uppercase tracking-[1.6px] text-white/85">{k.every}</div>
              <div className={`text-[30px] ${display}`}>{k.nights}</div>
              <div className="text-sm text-white/90">{k.times}</div>
            </div>
          </div>
        </div>
      </section>

      {/* SEARCH */}
      <div className="s-wrap relative -mt-[84px] md:-mt-[78px]">
        <form action="/book" aria-label={t.search.title} className="grid grid-cols-2 gap-2.5 rounded-[20px] bg-white p-4 shadow-[0_24px_60px_rgba(8,30,28,0.16)] md:grid-cols-[repeat(4,minmax(0,1fr))_auto] md:gap-0 md:rounded-[22px] md:p-2.5">
          <label className={`${field} col-span-2 rounded-xl bg-dune md:col-span-1 md:rounded-none md:border-r md:border-dune-line md:bg-transparent`}>{t.search.date}
            <input type="date" name="date" min={min} defaultValue={defaultDate} className={fieldInput} /></label>
          <label className={`${field} rounded-xl bg-dune md:rounded-none md:border-r md:border-dune-line md:bg-transparent`}>{t.search.adults}
            <select name="adults" defaultValue="4" className={fieldInput}>{Array.from({ length: 16 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{num(n, lang)}</option>)}</select></label>
          <label className={`${field} rounded-xl bg-dune md:rounded-none md:border-r md:border-dune-line md:bg-transparent`}>{t.search.children}
            <select name="children" defaultValue="0" className={fieldInput}>{Array.from({ length: 9 }, (_, i) => i).map((n) => <option key={n} value={n}>{num(n, lang)}</option>)}</select></label>
          <label className={`${field} col-span-2 rounded-xl bg-dune md:col-span-1 md:rounded-none md:bg-transparent`}>{t.search.package}
            <select name="type" className={fieldInput}><option value="SHARED">{t.search.shared}</option><option value="FULL_BOAT">{t.search.full}</option></select></label>
          <button className="col-span-2 h-[52px] rounded-[14px] bg-pine px-8 text-base font-semibold text-white hover:bg-pine-2 md:col-span-1 md:h-auto md:min-h-[64px] md:rounded-2xl">{t.search.go}</button>
        </form>
        <p className="mx-1 mt-3.5 text-[13px] text-ink-muted">{t.search.note}</p>
      </div>

      {/* MARQUEE */}
      <div aria-hidden="true" className={`mt-12 overflow-hidden border-y border-dune-line py-4 text-2xl font-light text-pine md:mt-24 md:py-[22px] md:text-[34px] ${display}`}>
        <div className="flex w-max animate-marquee whitespace-nowrap motion-reduce:animate-none">
          {[0, 1].map((rep) => (
            <div key={rep} className="flex">
              {k.marquee.map((w, i) => (
                <span key={w} className="flex items-center">
                  <span className={`px-4 md:px-7 ${i % 2 ? "italic" : ""}`}>{w}</span><span className="text-gold-spark">✳</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* INTRO */}
      <section aria-labelledby="intro-h" className="s-wrap flex flex-wrap items-center gap-10 pt-14 md:gap-20 md:pt-[130px]">
        <div className="min-w-0 flex-[1_1_480px]">
          <div className="s-eyebrow">{k.welcome}</div>
          <h2 id="intro-h" className={`mt-3 md:mt-[18px] md:text-[60px] ${h2}`}>{k.introA}<em className="italic">{k.introEm}</em>{k.introB}</h2>
          <p className="mt-6 max-w-[520px] text-[17px] leading-7 text-ink-2 md:mt-7">{k.introText}</p>
          <div className="mt-8 grid max-w-[560px] grid-cols-3 gap-4 md:mt-10 md:gap-6">
            {([[cap, k.statGuests], [lang === "bn" ? "১:০০" : "13:00", k.statBoard], [lang === "bn" ? "১১:০০" : "11:00", k.statOut]] as const).map(([v, l]) => (
              <div key={l}><div className={`text-[32px] font-light leading-none text-pine md:text-5xl ${display}`}>{v}</div><div className="mt-2 text-[13px] text-ink-muted md:text-sm">{l}</div></div>
            ))}
          </div>
        </div>
        <div className="relative h-[380px] min-w-0 flex-[1_1_520px] md:h-[640px]">
          <Pic pic={introBig} className="absolute right-0 top-0 h-[300px] w-[82%] rounded-[22px] md:h-[520px] md:w-[78%] md:rounded-[28px]" />
          <Pic pic={introSmall} sizes="(min-width: 768px) 25vw, 50vw" className="absolute bottom-0 left-0 h-[190px] w-[46%] rounded-[18px] border-[6px] border-mist md:h-[330px] md:w-[42%] md:rounded-3xl md:border-8" />
        </div>
      </section>

      {/* TWO WAYS */}
      <section id="packages" aria-labelledby="stay-h" className="s-wrap scroll-mt-4 pt-20 md:pt-[150px]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="s-eyebrow">{t.packages.eyebrow}</div>
            <h2 id="stay-h" className={`mt-3 md:mt-3.5 ${h2}`}>{k.waysA}<em className="italic">{k.waysEm}</em></h2>
          </div>
          <a href="/book" className="text-[15px] font-semibold underline-offset-[5px]">{k.seePrices}</a>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-5 md:mt-12 md:grid-cols-2 md:gap-7">
          {([
            [photos.cabins[0], k.foodTag, t.packages.sharedTitle, t.packages.sharedText, r.SHARED.SUN_WED, t.packages.perGuest, "/book?type=SHARED", t.packages.sharedCta],
            [photos.boat, fill(k.upTo, { n: cap }), t.packages.fullTitle, fill(t.packages.fullText, { food: money(r.FULL_BOAT_FOOD.SUN_WED, lang) }), r.FULL_BOAT.SUN_WED, t.packages.perTrip, "/book?type=FULL_BOAT", t.packages.fullCta],
          ] as const).map(([pic, tag, title, text, price, per, href, cta]) => (
            <article key={href} className="s-dark relative h-[460px] overflow-hidden rounded-3xl bg-pine-night text-white md:h-[620px] md:rounded-[28px]">
              <Pic pic={pic} className="absolute inset-0" />
              <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,22,20,0)_35%,rgba(6,22,20,0.82)_100%)]" />
              <div className="absolute left-5 top-5 rounded-full bg-white/90 px-3.5 py-[7px] text-[13px] font-semibold text-pine md:left-6 md:top-6">{tag}</div>
              <div className="absolute inset-x-5 bottom-5 md:inset-x-9 md:bottom-[34px]">
                <h3 className={`text-[30px] md:text-[40px] ${display}`}>{title}</h3>
                <p className="mt-2.5 max-w-[440px] text-[15px] leading-[23px] text-white/90">{text}</p>
                <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
                  <div><span className="text-sm text-white/85">{t.packages.from} </span><span className={`text-[34px] md:text-[44px] ${display}`}>{money(price, lang)}</span><span className="text-sm text-white/85"> {per}</span></div>
                  <a href={href} className="s-btn-light">{cta}</a>
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-1 gap-3 text-sm text-ink-2 md:grid-cols-3">
          {days.map(([label, s, f]) => (
            <div key={label} className="rounded-[14px] bg-dune px-5 py-4"><b className="text-ink">{label}</b> · {money(s, lang)} {t.search.shared.toLowerCase()} · {money(f, lang)} {t.search.full.toLowerCase()}</div>
          ))}
        </div>
      </section>

      {/* ON BOARD */}
      <section aria-labelledby="exp-h" className="s-dark mt-20 bg-pine text-white md:mt-[150px]">
        <div className="s-wrap flex flex-wrap items-stretch gap-10 py-16 md:gap-20 md:py-[120px]">
          <Pic pic={photos.reach} className="min-h-[260px] min-w-0 flex-[1_1_420px] rounded-[20px] md:min-h-[560px] md:rounded-[28px]" />
          <div className="min-w-0 flex-[1_1_520px]">
            <div className="s-eyebrow-light">{k.onBoard}</div>
            <h2 id="exp-h" className={`mt-3 md:mt-3.5 ${h2}`}>{k.doA}<em className="italic">{k.doEm}</em></h2>
            <ol className="mt-8 flex flex-col md:mt-11">
              {k.todo.map(([h, p], i) => (
                <li key={h} className={`grid grid-cols-[48px_minmax(0,1fr)] gap-4 border-t border-white/20 py-5 md:grid-cols-[72px_minmax(0,1fr)] md:py-6 ${i === k.todo.length - 1 ? "border-b" : ""}`}>
                  <span className={`text-[22px] text-gold ${display}`}>{num(i + 1, lang).padStart(2, lang === "bn" ? "০" : "0")}</span>
                  <div><div className="text-lg font-semibold md:text-xl">{h}</div><div className="mt-1.5 text-[15px] leading-[23px] text-white/80">{p}</div></div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* TWO DAYS */}
      <section id="days" aria-labelledby="days-h" className="s-wrap pt-20 md:pt-[140px]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="s-eyebrow">{k.daysEyebrow}</div>
            <h2 id="days-h" className={`mt-3 md:mt-3.5 ${h2}`}>{k.daysA}<em className="italic">{k.daysEm}</em></h2>
          </div>
          <a href="/boat#itinerary" className="text-[15px] font-semibold underline-offset-[5px]">{k.fullItinerary}</a>
        </div>
        <ol className="mt-10 grid grid-cols-1 border-t-2 border-pine sm:grid-cols-2 md:mt-14 lg:grid-cols-4">
          {k.days.map(([when, h, p]) => (
            <li key={when} className="pb-6 pr-6 pt-6 md:pt-[26px]">
              <div className="text-[13px] font-semibold uppercase tracking-[1.4px] text-ink-muted">{when}</div>
              <div className={`mt-2.5 text-[26px] ${display}`}>{h}</div>
              <p className="mt-2 text-[15px] leading-[23px] text-ink-2">{p}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* GALLERY */}
      <section id="gallery" aria-labelledby="gal-h" className="s-wrap scroll-mt-4 pt-20 md:pt-[150px]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 id="gal-h" className={h2}>{k.galA}<em className="italic">{k.galEm}</em></h2>
          {c.facebook && <a href={c.facebook} className="text-[15px] font-semibold underline-offset-[5px]">{k.follow}</a>}
        </div>
        <div className="mt-8 grid auto-rows-[170px] grid-cols-2 gap-2.5 md:mt-11 md:auto-rows-[300px] md:grid-cols-4 md:gap-4">
          {g.map((pic, i) => {
            const big = i === 0 && g.length >= 5;
            return <Pic key={pic.src} pic={pic} sizes={big ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 25vw, 50vw"} className={`rounded-[18px] md:rounded-3xl ${big ? "col-span-2 row-span-2" : ""}`} />;
          })}
        </div>
      </section>

      {/* REVIEWS */}
      {reviews.length > 0 && (
        <section aria-labelledby="rev-h" className="s-wrap pt-20 md:pt-[150px]">
          <figure className="mx-auto max-w-[940px] text-center">
            <h2 id="rev-h" className="s-eyebrow">{k.guestsSay}</h2>
            <blockquote className={`mt-5 text-[26px] font-light italic leading-[1.3] md:mt-[26px] md:text-[42px] md:leading-[1.25] ${display}`}>“{reviews[0][0]}”</blockquote>
            {reviews[0][1] && <figcaption className="mt-4 text-[15px] text-ink-muted md:mt-6">{reviews[0][1]}</figcaption>}
          </figure>
          {reviews.length > 1 && (
            <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
              {reviews.slice(1, 4).map(([q, who], i) => (
                <figure key={i} className="rounded-3xl bg-dune p-6">
                  <blockquote className={`text-[19px] leading-7 ${display}`}>“{q}”</blockquote>
                  {who && <figcaption className="mt-3 text-[13px] text-ink-muted">{who}</figcaption>}
                </figure>
              ))}
            </div>
          )}
        </section>
      )}

      {/* FAQ */}
      <section id="faq" aria-labelledby="faq-h" className="s-wrap flex flex-wrap gap-10 pt-20 md:gap-20 md:pt-[150px]">
        <div className="min-w-0 flex-[1_1_320px]">
          <div className="s-eyebrow">{t.faq.eyebrow}</div>
          <h2 id="faq-h" className={`mt-3 md:mt-3.5 ${h2}`}>{t.faq.title}</h2>
          <p className="mt-4 text-[15px] leading-[23px] text-ink-2">{t.faq.lead}</p>
        </div>
        <div className="flex min-w-0 flex-[2_1_560px] flex-col">
          {[...t.faq.items, [t.faq.cancel, c.cancellation]].map(([q, a], i, arr) => (
            <details key={q} open={i === 0} className={`group border-t border-dune-rule py-5 ${i === arr.length - 1 ? "border-b" : ""}`}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
                {q}<span aria-hidden="true" className="text-2xl font-light text-pine transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 max-w-[640px] text-[15px] leading-[23px] text-ink-2">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* REACH */}
      <section id="reach" aria-labelledby="reach-h" className="s-wrap scroll-mt-4 pt-20 md:pt-[150px]">
        <div className="s-dark relative flex min-h-[420px] overflow-hidden rounded-3xl bg-pine-night text-white md:min-h-[520px] md:rounded-[32px]">
          <Pic pic={photos.boat} sizes="100vw" className="absolute inset-0" />
          <div aria-hidden="true" className="absolute inset-0 bg-[rgba(8,34,31,0.78)] md:bg-[linear-gradient(90deg,rgba(8,34,31,0.95)_0%,rgba(8,34,31,0.85)_45%,rgba(8,34,31,0.15)_100%)]" />
          <div className="relative flex max-w-[620px] flex-col justify-center gap-4 p-7 md:gap-5 md:p-[72px]">
            <div className="s-eyebrow-light">{t.reach.eyebrow}</div>
            <h2 id="reach-h" className={h2}>{fill(t.reach.title, { place: c.meetingPoint })}</h2>
            <p className="text-[15px] leading-[23px] text-white/90 md:text-[17px] md:leading-[27px]">{c.travelNote}</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <a href="/book" className="s-btn-light">{k.freeDates}</a>
              {wa && <a href={`https://wa.me/${wa}`} className="s-btn-outline">{t.reach.whatsapp}</a>}
              {c.phone && <a href={`tel:${c.phone}`} className="s-btn-outline">{t.nav.call} {c.phone}</a>}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
