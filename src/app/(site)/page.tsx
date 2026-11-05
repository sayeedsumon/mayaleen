import Image from "next/image";
import { addDays, toDhakaDate } from "@/domain";
import { money, num } from "@/lib/i18n";
import { plain, rich } from "@/lib/rich";
import { loadPricingConfig } from "@/server/config";
import { prisma } from "@/server/db";
import { getSitePhotos, type SitePic } from "@/server/photos";
import { getContent, getLang } from "@/server/site-content";

function Pic({ pic, className = "", priority = false, sizes = "(min-width: 768px) 50vw, 100vw" }: { pic: SitePic; className?: string; priority?: boolean; sizes?: string }) {
  return (
    <div className={`${/\babsolute\b/.test(className) ? "" : "relative"} overflow-hidden bg-dune ${className}`}>
      <Image src={pic.src} alt={pic.alt} fill priority={priority} sizes={sizes} className="object-cover" style={{ objectPosition: pic.pos ?? "center" }} />
    </div>
  );
}

export default async function Home() {
  const lang = await getLang();
  const [c, cfg, photos] = await Promise.all([getContent(lang), loadPricingConfig(prisma), getSitePhotos()]);
  const r = cfg.rates;
  const display = lang === "bn" ? "font-bnDisplay" : "font-display";
  const h2 = `s-h2 ${display}`;
  const min = toDhakaDate(new Date());
  const defaultDate = addDays(min, cfg.settings.cutoffDays + 1);
  const wa = c.whatsapp.replace(/[^0-9]/g, "");
  const vars = { guests: num(cfg.settings.capacityCap, lang), n: num(cfg.settings.capacityCap, lang), place: c.meetingPoint, food: money(r.FULL_BOAT_FOOD.SUN_WED, lang) };
  const marquee = c.list("marquee");
  const stats = c.list("introStats");
  const onboard = c.list("onboardList");
  const days = c.list("daysList");
  const reviews = c.list("reviews");
  const faq = c.list("faqList");
  const g = photos.gallery;
  const field = "flex flex-col gap-1 px-4 py-3 text-[11px] font-semibold uppercase tracking-[1px] text-ink-muted md:px-[22px] md:py-3.5 md:text-xs";
  const fieldInput = "w-full border-0 bg-transparent p-0 text-base font-medium normal-case tracking-normal text-ink focus:outline-none md:text-[17px]";
  const priceDays = [
    [c.daySunWed, r.SHARED.SUN_WED, r.FULL_BOAT.SUN_WED],
    [c.dayThuSat, r.SHARED.THU_SAT, r.FULL_BOAT.THU_SAT],
    [c.dayFri, r.SHARED.FRIDAY, r.FULL_BOAT.FRIDAY],
  ] as const;
  const link = "text-[15px] font-semibold underline-offset-[5px]";

  return (
    <main>
      {/* TOP */}
      <section aria-labelledby="hero-h" className="s-dark relative h-[720px] bg-pine-night text-white md:h-[880px]">
        <Pic pic={photos.hero} priority sizes="100vw" className="absolute inset-0" />
        <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,22,20,0.55)_0%,rgba(6,22,20,0.05)_30%,rgba(6,22,20,0.15)_55%,rgba(6,22,20,0.7)_100%)]" />
        <div className="absolute inset-x-0 bottom-[110px] md:bottom-[150px]">
          <div className="s-wrap flex flex-wrap items-end justify-between gap-8">
            <div className="max-w-[820px]">
              {c.heroEyebrow && <div className="s-eyebrow-light">{c.heroEyebrow}</div>}
              <h1 id="hero-h" className={`mt-3.5 text-[52px] font-light leading-none tracking-[-1px] md:mt-[18px] md:text-[104px] md:leading-[0.98] md:tracking-[-2px] ${display}`}>{rich(c.heroTitle, vars)}</h1>
              {c.heroText && <p className="mt-4 max-w-[520px] text-base leading-6 text-white/90 md:mt-[26px] md:text-lg md:leading-7">{plain(c.heroText, vars)}</p>}
            </div>
            {c.on("showHeroCard") && (
              <div className="hidden min-w-[230px] flex-col gap-1.5 rounded-[18px] border border-white/30 bg-white/15 px-6 py-5 backdrop-blur-md md:flex">
                <div className="text-xs uppercase tracking-[1.6px] text-white/85">{c.heroCardLabel}</div>
                <div className={`text-[30px] ${display}`}>{c.heroCardTitle}</div>
                <div className="text-sm text-white/90">{c.heroCardText}</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SEARCH */}
      <div className="s-wrap relative -mt-[84px] md:-mt-[78px]">
        <form action="/book" aria-label={c.searchButton} className="grid grid-cols-2 gap-2.5 rounded-[20px] bg-white p-4 shadow-[0_24px_60px_rgba(8,30,28,0.16)] md:grid-cols-[repeat(4,minmax(0,1fr))_auto] md:gap-0 md:rounded-[22px] md:p-2.5">
          <label className={`${field} col-span-2 rounded-xl bg-dune md:col-span-1 md:rounded-none md:border-r md:border-dune-line md:bg-transparent`}>{c.searchDate}
            <input type="date" name="date" min={min} defaultValue={defaultDate} className={fieldInput} /></label>
          <label className={`${field} rounded-xl bg-dune md:rounded-none md:border-r md:border-dune-line md:bg-transparent`}>{c.searchAdults}
            <select name="adults" defaultValue="4" className={fieldInput}>{Array.from({ length: 16 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{num(n, lang)}</option>)}</select></label>
          <label className={`${field} rounded-xl bg-dune md:rounded-none md:border-r md:border-dune-line md:bg-transparent`}>{c.searchChildren}
            <select name="children" defaultValue="0" className={fieldInput}>{Array.from({ length: 9 }, (_, i) => i).map((n) => <option key={n} value={n}>{num(n, lang)}</option>)}</select></label>
          <label className={`${field} col-span-2 rounded-xl bg-dune md:col-span-1 md:rounded-none md:bg-transparent`}>{c.searchPackage}
            <select name="type" className={fieldInput}><option value="SHARED">{c.searchShared}</option><option value="FULL_BOAT">{c.searchFull}</option></select></label>
          <button className="col-span-2 h-[52px] rounded-[14px] bg-pine px-8 text-base font-semibold text-white hover:bg-pine-2 md:col-span-1 md:h-auto md:min-h-[64px] md:rounded-2xl">{c.searchButton}</button>
        </form>
        {c.searchNote && <p className="mx-1 mt-3.5 text-[13px] text-ink-muted">{c.searchNote}</p>}
      </div>

      {/* HIGHLIGHTS STRIP */}
      {c.on("showMarquee") && marquee.length > 0 && (
        <div aria-hidden="true" className={`mt-12 overflow-hidden border-y border-dune-line py-4 text-2xl font-light text-pine md:mt-24 md:py-[22px] md:text-[34px] ${display}`}>
          <div className="flex w-max animate-marquee whitespace-nowrap motion-reduce:animate-none">
            {[0, 1].map((rep) => (
              <div key={rep} className="flex">
                {marquee.map((m, i) => (
                  <span key={i} className="flex items-center">
                    <span className={`px-4 md:px-7 ${i % 2 ? "italic" : ""}`}>{m.word}</span><span className="text-gold-spark">✳</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* WELCOME */}
      {c.on("showIntro") && (
        <section aria-labelledby="intro-h" className="s-wrap flex flex-wrap items-center gap-10 pt-14 md:gap-20 md:pt-[130px]">
          <div className="min-w-0 flex-[1_1_480px]">
            {c.introEyebrow && <div className="s-eyebrow">{c.introEyebrow}</div>}
            <h2 id="intro-h" className={`mt-3 md:mt-[18px] md:text-[60px] ${h2}`}>{rich(c.introTitle, vars)}</h2>
            {c.introText && <p className="mt-6 max-w-[520px] whitespace-pre-line text-[17px] leading-7 text-ink-2 md:mt-7">{plain(c.introText, vars)}</p>}
            {stats.length > 0 && (
              <div className="mt-8 grid max-w-[560px] grid-cols-3 gap-4 md:mt-10 md:gap-6">
                {stats.slice(0, 3).map((s, i) => (
                  <div key={i}><div className={`text-[32px] font-light leading-none text-pine md:text-5xl ${display}`}>{plain(s.value, vars)}</div><div className="mt-2 text-[13px] text-ink-muted md:text-sm">{plain(s.label, vars)}</div></div>
                ))}
              </div>
            )}
          </div>
          <div className="relative h-[380px] min-w-0 flex-[1_1_520px] md:h-[640px]">
            <Pic pic={photos.intro[0]} className="absolute right-0 top-0 h-[300px] w-[82%] rounded-[22px] md:h-[520px] md:w-[78%] md:rounded-[28px]" />
            <Pic pic={photos.intro[1]} sizes="(min-width: 768px) 25vw, 50vw" className="absolute bottom-0 left-0 h-[190px] w-[46%] rounded-[18px] border-[6px] border-mist md:h-[330px] md:w-[42%] md:rounded-3xl md:border-8" />
          </div>
        </section>
      )}

      {/* PACKAGES */}
      {c.on("showPackages") && (
        <section id="packages" aria-labelledby="stay-h" className="s-wrap scroll-mt-4 pt-20 md:pt-[150px]">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              {c.pkEyebrow && <div className="s-eyebrow">{c.pkEyebrow}</div>}
              <h2 id="stay-h" className={`mt-3 md:mt-3.5 ${h2}`}>{rich(c.pkTitle, vars)}</h2>
            </div>
            {c.pkLink && <a href="/book" className={link}>{c.pkLink}</a>}
          </div>
          <div className="mt-8 grid grid-cols-1 gap-5 md:mt-12 md:grid-cols-2 md:gap-7">
            {([
              [photos.shared, c.sharedTag, c.sharedTitle, c.sharedText, r.SHARED.SUN_WED, c.perGuest, "/book?type=SHARED", c.sharedButton],
              [photos.whole, c.fullTag, c.fullTitle, c.fullText, r.FULL_BOAT.SUN_WED, c.perTrip, "/book?type=FULL_BOAT", c.fullButton],
            ] as const).map(([pic, tag, title, text, price, per, href, cta]) => (
              <article key={href} className="s-dark relative h-[460px] overflow-hidden rounded-3xl bg-pine-night text-white md:h-[620px] md:rounded-[28px]">
                <Pic pic={pic} className="absolute inset-0" />
                <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,22,20,0)_35%,rgba(6,22,20,0.82)_100%)]" />
                {tag && <div className="absolute left-5 top-5 rounded-full bg-white/90 px-3.5 py-[7px] text-[13px] font-semibold text-pine md:left-6 md:top-6">{plain(tag, vars)}</div>}
                <div className="absolute inset-x-5 bottom-5 md:inset-x-9 md:bottom-[34px]">
                  <h3 className={`text-[30px] md:text-[40px] ${display}`}>{rich(title, vars)}</h3>
                  {text && <p className="mt-2.5 max-w-[440px] text-[15px] leading-[23px] text-white/90">{plain(text, vars)}</p>}
                  <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
                    <div><span className="text-sm text-white/85">{c.priceFrom} </span><span className={`text-[34px] md:text-[44px] ${display}`}>{money(price, lang)}</span><span className="text-sm text-white/85"> {per}</span></div>
                    {cta && <a href={href} className="s-btn-light">{cta}</a>}
                  </div>
                </div>
              </article>
            ))}
          </div>
          {c.priceStrip && (
            <div className="mt-5 grid grid-cols-1 gap-3 text-sm text-ink-2 md:grid-cols-3">
              {priceDays.map(([label, s, f]) => (
                <div key={label} className="rounded-[14px] bg-dune px-5 py-4"><b className="text-ink">{label}</b> · {plain(c.priceStrip, { shared: money(s, lang), full: money(f, lang) })}</div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ON BOARD */}
      {c.on("showOnboard") && (
        <section aria-labelledby="exp-h" className="s-dark mt-20 bg-pine text-white md:mt-[150px]">
          <div className="s-wrap flex flex-wrap items-stretch gap-10 py-16 md:gap-20 md:py-[120px]">
            <Pic pic={photos.onboard} className="min-h-[260px] min-w-0 flex-[1_1_420px] rounded-[20px] md:min-h-[560px] md:rounded-[28px]" />
            <div className="min-w-0 flex-[1_1_520px]">
              {c.onboardEyebrow && <div className="s-eyebrow-light">{c.onboardEyebrow}</div>}
              <h2 id="exp-h" className={`mt-3 md:mt-3.5 ${h2}`}>{rich(c.onboardTitle, vars)}</h2>
              <ol className="mt-8 flex flex-col md:mt-11">
                {onboard.map((o, i) => (
                  <li key={i} className={`grid grid-cols-[48px_minmax(0,1fr)] gap-4 border-t border-white/20 py-5 md:grid-cols-[72px_minmax(0,1fr)] md:py-6 ${i === onboard.length - 1 ? "border-b" : ""}`}>
                    <span className={`text-[22px] text-gold ${display}`}>{num(i + 1, lang).padStart(2, lang === "bn" ? "০" : "0")}</span>
                    <div><div className="text-lg font-semibold md:text-xl">{o.title}</div>{o.text && <div className="mt-1.5 text-[15px] leading-[23px] text-white/80">{plain(o.text, vars)}</div>}</div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      )}

      {/* YOUR TWO DAYS */}
      {c.on("showDays") && days.length > 0 && (
        <section id="days" aria-labelledby="days-h" className="s-wrap pt-20 md:pt-[140px]">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              {c.daysEyebrow && <div className="s-eyebrow">{c.daysEyebrow}</div>}
              <h2 id="days-h" className={`mt-3 md:mt-3.5 ${h2}`}>{rich(c.daysTitle, vars)}</h2>
            </div>
            {c.daysLink && <a href="/boat#itinerary" className={link}>{c.daysLink}</a>}
          </div>
          <ol className="mt-10 grid grid-cols-1 border-t-2 border-pine sm:grid-cols-2 md:mt-14 lg:grid-cols-4">
            {days.map((d, i) => (
              <li key={i} className="pb-6 pr-6 pt-6 md:pt-[26px]">
                <div className="text-[13px] font-semibold uppercase tracking-[1.4px] text-ink-muted">{d.when}</div>
                <div className={`mt-2.5 text-[26px] ${display}`}>{d.title}</div>
                {d.text && <p className="mt-2 text-[15px] leading-[23px] text-ink-2">{plain(d.text, vars)}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* GALLERY */}
      {c.on("showGallery") && g.length > 0 && (
        <section id="gallery" aria-labelledby="gal-h" className="s-wrap scroll-mt-4 pt-20 md:pt-[150px]">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 id="gal-h" className={h2}>{rich(c.galleryTitle, vars)}</h2>
            {c.facebook && c.galleryLink && <a href={c.facebook} className={link}>{c.galleryLink}</a>}
          </div>
          <div className="mt-8 grid auto-rows-[170px] grid-cols-2 gap-2.5 md:mt-11 md:auto-rows-[300px] md:grid-cols-4 md:gap-4">
            {g.map((pic, i) => {
              const big = i === 0 && g.length >= 5;
              return <Pic key={pic.src} pic={pic} sizes={big ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 25vw, 50vw"} className={`rounded-[18px] md:rounded-3xl ${big ? "col-span-2 row-span-2" : ""}`} />;
            })}
          </div>
        </section>
      )}

      {/* REVIEWS */}
      {c.on("showReviews") && reviews.length > 0 && (
        <section aria-labelledby="rev-h" className="s-wrap pt-20 md:pt-[150px]">
          <figure className="mx-auto max-w-[940px] text-center">
            <h2 id="rev-h" className="s-eyebrow">{c.reviewsEyebrow}</h2>
            <blockquote className={`mt-5 text-[26px] font-light italic leading-[1.3] md:mt-[26px] md:text-[42px] md:leading-[1.25] ${display}`}>“{reviews[0].quote}”</blockquote>
            {reviews[0].name && <figcaption className="mt-4 text-[15px] text-ink-muted md:mt-6">{reviews[0].name}</figcaption>}
          </figure>
          {reviews.length > 1 && (
            <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
              {reviews.slice(1, 4).map((rv, i) => (
                <figure key={i} className="rounded-3xl bg-dune p-6">
                  <blockquote className={`text-[19px] leading-7 ${display}`}>“{rv.quote}”</blockquote>
                  {rv.name && <figcaption className="mt-3 text-[13px] text-ink-muted">{rv.name}</figcaption>}
                </figure>
              ))}
            </div>
          )}
        </section>
      )}

      {/* FAQ */}
      {c.on("showFaq") && faq.length > 0 && (
        <section id="faq" aria-labelledby="faq-h" className="s-wrap flex flex-wrap gap-10 pt-20 md:gap-20 md:pt-[150px]">
          <div className="min-w-0 flex-[1_1_320px]">
            {c.faqEyebrow && <div className="s-eyebrow">{c.faqEyebrow}</div>}
            <h2 id="faq-h" className={`mt-3 md:mt-3.5 ${h2}`}>{rich(c.faqTitle, vars)}</h2>
            {c.faqLead && <p className="mt-4 text-[15px] leading-[23px] text-ink-2">{c.faqLead}</p>}
          </div>
          <div className="flex min-w-0 flex-[2_1_560px] flex-col">
            {faq.map((f, i) => (
              <details key={i} open={i === 0} className={`group border-t border-dune-rule py-5 ${i === faq.length - 1 ? "border-b" : ""}`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
                  {f.q}<span aria-hidden="true" className="text-2xl font-light text-pine transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 max-w-[640px] whitespace-pre-line text-[15px] leading-[23px] text-ink-2">{plain(f.a, vars)}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* HOW TO REACH */}
      {c.on("showReach") && (
        <section id="reach" aria-labelledby="reach-h" className="s-wrap scroll-mt-4 pt-20 md:pt-[150px]">
          <div className="s-dark relative flex min-h-[420px] overflow-hidden rounded-3xl bg-pine-night text-white md:min-h-[520px] md:rounded-[32px]">
            <Pic pic={photos.reach} sizes="100vw" className="absolute inset-0" />
            <div aria-hidden="true" className="absolute inset-0 bg-[rgba(8,34,31,0.78)] md:bg-[linear-gradient(90deg,rgba(8,34,31,0.95)_0%,rgba(8,34,31,0.85)_45%,rgba(8,34,31,0.15)_100%)]" />
            <div className="relative flex max-w-[620px] flex-col justify-center gap-4 p-7 md:gap-5 md:p-[72px]">
              {c.reachEyebrow && <div className="s-eyebrow-light">{c.reachEyebrow}</div>}
              <h2 id="reach-h" className={h2}>{rich(c.reachTitle, vars)}</h2>
              {c.travelNote && <p className="whitespace-pre-line text-[15px] leading-[23px] text-white/90 md:text-[17px] md:leading-[27px]">{c.travelNote}</p>}
              <div className="mt-2 flex flex-wrap gap-3">
                {c.reachButton && <a href="/book" className="s-btn-light">{c.reachButton}</a>}
                {wa && c.reachWhatsapp && <a href={`https://wa.me/${wa}`} className="s-btn-outline">{c.reachWhatsapp}</a>}
                {c.phone && <a href={`tel:${c.phone}`} className="s-btn-outline">{c.navCall} {c.phone}</a>}
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
