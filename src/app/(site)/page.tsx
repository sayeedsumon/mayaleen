import Image from "next/image";
import { Icon } from "@/components/ui";
import { toDhakaDate, addDays } from "@/domain";
import { DICT, fill, money } from "@/lib/i18n";
import { loadPricingConfig } from "@/server/config";
import { prisma } from "@/server/db";
import { getSitePhotos, type SitePic } from "@/server/photos";
import { getContent, getLang } from "@/server/site-content";

function Photo({ pic, className = "", priority = false, sizes = "(min-width: 768px) 50vw, 100vw" }:
  { pic: SitePic; className?: string; priority?: boolean; sizes?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-[#E9E5DC] ${className}`}>
      <Image src={pic.src} alt={pic.alt} fill priority={priority} sizes={sizes} className="object-cover" style={{ objectPosition: pic.pos ?? "center" }} />
    </div>
  );
}

export default async function Home() {
  const lang = await getLang();
  const photos = await getSitePhotos();
  const t = DICT[lang];
  const [c, cfg] = await Promise.all([getContent(lang), loadPricingConfig(prisma)]);
  const r = cfg.rates;
  const display = lang === "bn" ? "font-bnDisplay" : "font-display";
  const min = toDhakaDate(new Date());
  const defaultDate = addDays(min, cfg.settings.cutoffDays + 1);
  const reviews = c.reviews.split("\n").map((l) => l.split("|").map((x) => x.trim())).filter((x) => x[0]);
  const wa = c.whatsapp.replace(/[^0-9]/g, "");
  const eyebrow = "text-[13px] font-semibold uppercase tracking-[1.2px] text-lake";
  const h2 = `mt-1.5 text-[32px] font-medium leading-tight md:text-[40px] ${display}`;
  const priceTile = (label: string, v: number, dark = false) => (
    <div className={`rounded-[10px] px-3 py-2.5 ${dark ? "bg-lake-dark" : "bg-sand"}`}>
      <div className={dark ? "text-[#C2DCD7]" : "text-ink-muted"}>{label}</div>
      <div className="font-semibold">{money(v, lang)}</div>
    </div>
  );

  return (
    <main>
      <section aria-labelledby="hero-h" className="bg-lake-deep pb-28 pt-10 text-white md:pb-32 md:pt-16">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-10 px-4 md:px-8">
          <div className="min-w-[300px] flex-[1_1_440px]">
            <div className="text-[13px] font-semibold uppercase tracking-[1.4px] text-[#9FD0C7]">{t.place}</div>
            <h1 id="hero-h" className={`mt-3.5 text-[40px] font-medium leading-[1.08] text-white md:text-[60px] ${display}`}>{c.heroTitle}</h1>
            <p className="mt-5 max-w-[520px] text-[17px] leading-7 text-[#D4E6E2] md:text-lg">{c.heroText}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="/book" className="btn h-12 bg-white px-5 text-[15px] text-lake-dark hover:bg-[#E2EEEB] hover:text-lake-dark">{t.hero.cta}</a>
              <a href="/boat" className="inline-flex h-12 items-center rounded-xl border border-[#3E6B66] px-5 text-[15px] font-semibold text-white no-underline hover:text-white">{t.hero.tour}</a>
            </div>
          </div>
          <Photo pic={photos.hero} priority className="min-h-[320px] min-w-[300px] flex-[1_1_480px] md:min-h-[460px]" />
        </div>
      </section>

      <div className="mx-auto -mt-[72px] max-w-[1200px] px-4 md:px-8">
        <form action="/book" aria-label={t.search.title} className="card grid grid-cols-2 items-end gap-3.5 p-4 shadow-[0_12px_32px_rgba(10,46,43,0.12)] md:grid-cols-5 md:p-5">
          <label className="label col-span-2 text-xs font-semibold uppercase tracking-wide text-ink-muted md:col-span-1">{t.search.date}
            <input type="date" name="date" min={min} defaultValue={defaultDate} className="input h-12 text-[15px]" /></label>
          <label className="label text-xs font-semibold uppercase tracking-wide text-ink-muted">{t.search.adults}
            <select name="adults" defaultValue="4" className="input h-12 text-[15px]">{Array.from({ length: 16 }, (_, i) => i + 1).map((n) => <option key={n}>{n}</option>)}</select></label>
          <label className="label text-xs font-semibold uppercase tracking-wide text-ink-muted">{t.search.children}
            <select name="children" defaultValue="0" className="input h-12 text-[15px]">{Array.from({ length: 9 }, (_, i) => i).map((n) => <option key={n}>{n}</option>)}</select></label>
          <label className="label col-span-2 text-xs font-semibold uppercase tracking-wide text-ink-muted md:col-span-1">{t.search.package}
            <select name="type" className="input h-12 text-[15px]"><option value="SHARED">{t.search.shared}</option><option value="FULL_BOAT">{t.search.full}</option></select></label>
          <button className="btn col-span-2 h-12 text-[15px] md:col-span-1">{t.search.go}</button>
        </form>
        <p className="mx-1 mt-3 text-[13px] text-ink-2">{t.search.note}</p>
      </div>

      <section aria-label="Highlights" className="mx-auto mt-16 max-w-[1200px] px-4 md:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.highlights.map(([h, p], i) => (
            <div key={h} className="card p-[22px]">
              <span className="text-lake"><Icon name={["calendar", "sun", "invoice", "timeline"][i]} size={28} /></span>
              <h3 className="mb-1.5 mt-3.5 text-[17px] font-semibold">{h}</h3>
              <p className="text-sm leading-[21px] text-ink-2">{p}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="packages" aria-labelledby="pk-h" className="mx-auto mt-24 max-w-[1200px] px-4 md:px-8">
        <div className={eyebrow}>{t.packages.eyebrow}</div>
        <h2 id="pk-h" className={h2}>{t.packages.title}</h2>
        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2">
          <article className="card flex flex-col gap-4 p-7">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className={`text-[28px] font-medium ${display}`}>{t.packages.sharedTitle}</h3>
              <span className="rounded-full bg-lake-soft px-2.5 py-1 text-xs font-semibold text-lake-dark">{t.packages.sharedTag}</span>
            </div>
            <div><span className="text-sm text-ink-2">{t.packages.from} </span><span className={`text-[40px] font-medium ${display}`}>{money(r.SHARED.SUN_WED, lang)}</span><span className="text-sm text-ink-2"> {t.packages.perGuest}</span></div>
            <div className="grid grid-cols-3 gap-2 text-[13px]">{priceTile(t.packages.sunWed, r.SHARED.SUN_WED)}{priceTile(t.packages.thuSat, r.SHARED.THU_SAT)}{priceTile(t.packages.fri, r.SHARED.FRIDAY)}</div>
            <p className="text-sm leading-[21px] text-ink-2">{t.packages.sharedText}</p>
            <a href="/book?type=SHARED" className="btn h-12 self-start">{t.packages.sharedCta}</a>
          </article>
          <article className="flex flex-col gap-4 rounded-2xl bg-lake p-7 text-white">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className={`text-[28px] font-medium text-white ${display}`}>{t.packages.fullTitle}</h3>
              <span className="rounded-full bg-lake-dark px-2.5 py-1 text-xs font-semibold text-[#D4E6E2]">{fill(t.packages.fullTag, {})}</span>
            </div>
            <div><span className="text-sm text-[#D4E6E2]">{t.packages.from} </span><span className={`text-[40px] font-medium ${display}`}>{money(r.FULL_BOAT.SUN_WED, lang)}</span><span className="text-sm text-[#D4E6E2]"> {t.packages.perTrip}</span></div>
            <div className="grid grid-cols-3 gap-2 text-[13px]">{priceTile(t.packages.sunWed, r.FULL_BOAT.SUN_WED, true)}{priceTile(t.packages.thuSat, r.FULL_BOAT.THU_SAT, true)}{priceTile(t.packages.fri, r.FULL_BOAT.FRIDAY, true)}</div>
            <p className="text-sm leading-[21px] text-[#E3EFEC]">{fill(t.packages.fullText, { food: money(r.FULL_BOAT_FOOD.SUN_WED, lang) })}</p>
            <a href="/book?type=FULL_BOAT" className="btn h-12 self-start bg-white text-lake-dark hover:bg-[#E2EEEB] hover:text-lake-dark">{t.packages.fullCta}</a>
          </article>
        </div>
      </section>

      <section aria-labelledby="how-h" className="mx-auto mt-24 max-w-[1200px] px-4 md:px-8">
        <div className={eyebrow}>{t.how.eyebrow}</div>
        <h2 id="how-h" className={h2}>{t.how.title}</h2>
        <ol className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.how.steps.map(([h, p], i) => (
            <li key={h} className="card p-[22px]">
              <div className={`text-[34px] text-lake ${display}`}>{lang === "bn" ? "১২৩৪"[i] : i + 1}</div>
              <h3 className="mb-1.5 mt-2 text-base font-semibold">{h}</h3>
              <p className="text-sm leading-[21px] text-ink-2">{p}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Photos" className="mx-auto mt-24 max-w-[1200px] px-4 md:px-8">
        <div className="grid auto-rows-[160px] grid-cols-2 gap-3 md:auto-rows-[180px] md:grid-cols-4">
          {photos.gallery.map((pic, i) => (
            <Photo key={pic.src} pic={pic} className={i === 0 && photos.gallery.length >= 5 ? "col-span-2 row-span-2" : ""} sizes={i === 0 && photos.gallery.length >= 5 ? "(min-width: 768px) 50vw, 100vw" : "(min-width: 768px) 25vw, 50vw"} />
          ))}
        </div>
      </section>

      {reviews.length > 0 && (
        <section aria-labelledby="rev-h" className="mx-auto mt-24 max-w-[1200px] px-4 md:px-8">
          <div className={eyebrow}>{t.reviews.eyebrow}</div>
          <h2 id="rev-h" className={h2}>{t.reviews.title}</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {reviews.slice(0, 6).map(([q, who], i) => (
              <figure key={i} className="card flex flex-col gap-3.5 p-6">
                <blockquote className={`text-[19px] leading-7 ${display}`}>“{q}”</blockquote>
                {who && <figcaption className="text-[13px] text-ink-muted">{who}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      )}

      <section id="faq" aria-labelledby="faq-h" className="mx-auto mt-24 flex max-w-[1200px] flex-wrap gap-10 px-4 md:px-8">
        <div className="min-w-[260px] flex-[1_1_300px]">
          <div className={eyebrow}>{t.faq.eyebrow}</div>
          <h2 id="faq-h" className={h2}>{t.faq.title}</h2>
          <p className="mt-3.5 text-[15px] leading-[23px] text-ink-2">{t.faq.lead}</p>
        </div>
        <div className="flex min-w-[300px] flex-[2_1_560px] flex-col">
          {[...t.faq.items, [t.faq.cancel, c.cancellation]].map(([q, a], i, arr) => (
            <details key={q} open={i === 0} className={`border-t border-line py-[18px] ${i === arr.length - 1 ? "border-b" : ""}`}>
              <summary className="cursor-pointer text-[17px] font-semibold">{q}</summary>
              <p className="mt-2.5 text-[15px] leading-[23px] text-ink-2">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section id="reach" aria-labelledby="reach-h" className="mx-auto mt-24 max-w-[1200px] px-4 md:px-8">
        <div className="card flex flex-wrap overflow-hidden">
          <div className="flex min-w-[300px] flex-[1_1_420px] flex-col gap-3.5 p-6 md:p-9">
            <div className={eyebrow}>{t.reach.eyebrow}</div>
            <h2 id="reach-h" className={`text-[28px] font-medium leading-tight md:text-[32px] ${display}`}>{fill(t.reach.title, { place: c.meetingPoint })}</h2>
            <p className="text-[15px] leading-[23px] text-ink-2">{c.travelNote}</p>
            <div className="flex flex-wrap gap-2.5">
              {c.phone && <a href={`tel:${c.phone}`} className="btn h-12">{t.nav.call} {c.phone}</a>}
              {wa && <a href={`https://wa.me/${wa}`} className="btn-ghost h-12">{t.reach.whatsapp}</a>}
            </div>
          </div>
          <Photo pic={photos.reach} className="min-h-[260px] min-w-[300px] flex-[1_1_420px] rounded-none" />
        </div>
      </section>
    </main>
  );
}
