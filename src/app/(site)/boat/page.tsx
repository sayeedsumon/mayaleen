import type { Metadata } from "next";
import Image from "next/image";
import { money, num } from "@/lib/i18n";
import { plain, rich } from "@/lib/rich";
import { loadPricingConfig } from "@/server/config";
import { prisma } from "@/server/db";
import { getSitePhotos } from "@/server/photos";
import { getContent, getLang, type ContentRow } from "@/server/site-content";

export async function generateMetadata(): Promise<Metadata> {
  const c = await getContent(await getLang());
  return { title: plain(c.boatSeoTitle), openGraph: { title: plain(c.boatSeoTitle) } };
}

const ICONS: string[] = [
  "M3 18h18M5 18v-5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5M8 11V8h8v3",
  "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5",
  "M3 14h18v2a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-2zM7 10c0-1 1-1.5 1-2.5S7 6 7 5M12 10c0-1 1-1.5 1-2.5S12 6 12 5M17 10c0-1 1-1.5 1-2.5S17 6 17 5",
  "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6",
];

export default async function BoatPage() {
  const lang = await getLang();
  const [c, cfg, types, photos] = await Promise.all([
    getContent(lang),
    loadPricingConfig(prisma),
    prisma.cabinType.findMany({ include: { cabins: { where: { active: true } } }, orderBy: { name: "asc" } }),
    getSitePhotos(),
  ]);
  const r = cfg.rates;
  const display = lang === "bn" ? "font-bnDisplay" : "font-display";
  const h2 = `s-h2 mt-3 md:mt-3.5 ${display}`;
  const allCabins = types.flatMap((ty) => ty.cabins);
  const cap = Math.min(cfg.settings.capacityCap, allCabins.reduce((n, cb) => n + cb.capacity, 0));
  const vars = { n: num(cap, lang), guests: num(cap, lang), place: c.meetingPoint };
  const shown = types.filter((ty) => ty.cabins.length);
  const facts = ([[c.factGuests, num(cap, lang)], [c.factCabins, num(allCabins.length, lang)], [c.factTrip, c.factTripValue], [c.factBoarding, c.factBoardingValue]] as [string, string][]).filter(([a, b]) => a && b);
  const amenities = c.list("amenities");
  const inc = c.list("incList");
  const notInc = c.list("notIncList");
  const day1 = c.list("day1");
  const day2 = c.list("day2");
  const day = (title: string, items: ContentRow[]) => {
    const [a, ...b] = title.split(" · ");
    return (
      <article className="rounded-3xl border border-dune-rule bg-white p-6 md:p-9">
        <h3 className={`text-[26px] md:text-[28px] ${display}`}>{a}{b.length > 0 && <span className="italic text-ink-muted"> · {b.join(" · ")}</span>}</h3>
        <ol className="mt-5 flex flex-col md:mt-6">
          {items.map((it, i) => (
            <li key={i} className="grid grid-cols-[84px_minmax(0,1fr)] gap-2 border-t border-[#EFE9DE] py-3 text-[15px] md:grid-cols-[96px_minmax(0,1fr)]">
              <b className="text-pine">{it.time}</b><span>{it.what}</span>
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
            {c.boatEyebrow && <div className="s-eyebrow-light">{c.boatEyebrow}</div>}
            <h1 id="boat-h" className={`mt-3.5 max-w-[900px] text-[46px] font-light leading-none tracking-[-1px] md:mt-4 md:text-[88px] md:tracking-[-2px] ${display}`}>{rich(c.boatTitle, vars)}</h1>
          </div>
        </div>
      </section>

      {(c.boatLead || facts.length > 0) && (
        <section aria-label={plain(c.boatTitle)} className="s-wrap grid grid-cols-1 gap-10 pt-14 md:grid-cols-12 md:gap-6 md:pt-[110px]">
          <p className={`whitespace-pre-line text-[26px] font-light leading-[1.35] md:col-span-7 md:text-[36px] md:leading-[1.3] ${display}`}>{plain(c.boatLead, vars)}</p>
          {facts.length > 0 && (
            <dl className="md:col-span-4 md:col-start-9">
              {facts.map(([a, b], i) => (
                <div key={a} className={`flex justify-between gap-4 border-t border-dune-rule py-[18px] ${i === facts.length - 1 ? "border-b" : ""}`}><dt className="text-ink-muted">{a}</dt><dd className="text-right font-semibold">{b}</dd></div>
              ))}
            </dl>
          )}
        </section>
      )}

      <section aria-labelledby="cab-h" className="s-wrap pt-20 md:pt-[130px]">
        {c.cabinsEyebrow && <div className="s-eyebrow">{c.cabinsEyebrow}</div>}
        <h2 id="cab-h" className={h2}>{rich(c.cabinsTitle, vars)}</h2>
        <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 md:mt-12 md:gap-6 lg:grid-cols-3">
          {shown.map((ty, i) => {
            const pic = photos.cabins[i % photos.cabins.length];
            const desc = lang === "bn" ? ty.descriptionBn || ty.descriptionEn : ty.descriptionEn;
            return (
              <article key={ty.id} className="flex flex-col gap-4">
                <div className="relative h-[320px] overflow-hidden rounded-3xl bg-dune md:h-[420px]">
                  <Image src={pic.src} alt={pic.alt} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover" style={{ objectPosition: pic.pos ?? "50% 40%" }} />
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className={`text-[28px] md:text-[30px] ${display}`}>{ty.name}</h3>
                  <span className="text-sm text-ink-muted">
                    {plain(c.cabinSleeps, { n: num(Math.max(...ty.cabins.map((cb) => cb.capacity)), lang) })} · {plain(c.cabinCount, { n: num(ty.cabins.length, lang) })}
                    {ty.surcharge > 0 ? ` · +${money(ty.surcharge, lang)}` : ""}
                  </span>
                </div>
                {desc && <p className="whitespace-pre-line text-[15px] leading-[23px] text-ink-2">{desc}</p>}
              </article>
            );
          })}
        </div>
        {c.on("showAmenities") && amenities.length > 0 && (
          <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {amenities.map((a, i) => (
              <div key={i} className="rounded-[20px] bg-dune p-5 md:p-6">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0F3B36" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[i % ICONS.length]} /></svg>
                <div className="mt-3.5 text-[17px] font-semibold">{a.title}</div>
                {a.text && <div className="mt-1 text-sm text-ink-2">{a.text}</div>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="packages" aria-labelledby="pk-h" className="s-wrap scroll-mt-4 pt-20 md:pt-[130px]">
        {c.boatPkEyebrow && <div className="s-eyebrow">{c.boatPkEyebrow}</div>}
        <h2 id="pk-h" className={h2}>{rich(c.boatPkTitle, vars)}</h2>
        <div className="mt-8 overflow-x-auto rounded-3xl border border-dune-rule bg-white md:mt-11">
          <table className="w-full min-w-[760px] border-collapse text-base">
            <thead><tr className="text-left text-xs uppercase tracking-[1.4px] text-ink-muted">
              <th className="border-b border-dune-rule px-7 py-5 font-semibold">{c.colPackage}</th>
              <th className="border-b border-dune-rule px-4 py-5 font-semibold">{c.daySunWed}</th>
              <th className="border-b border-dune-rule px-4 py-5 font-semibold">{c.dayThuSat}</th>
              <th className="border-b border-dune-rule px-4 py-5 font-semibold">{c.dayFri}</th>
              <th className="border-b border-dune-rule px-7 py-5 font-semibold">{c.colFood}</th>
            </tr></thead>
            <tbody>
              <tr>
                <td className="border-b border-[#EFE9DE] px-7 py-6"><div className={`text-2xl ${display}`}>{c.sharedRow}</div><div className="text-[13px] text-ink-muted">{plain(c.sharedSub, vars)}</div></td>
                <td className="border-b border-[#EFE9DE] px-4 py-6 font-semibold">{money(r.SHARED.SUN_WED, lang)}</td>
                <td className="border-b border-[#EFE9DE] px-4 py-6 font-semibold">{money(r.SHARED.THU_SAT, lang)}</td>
                <td className="border-b border-[#EFE9DE] px-4 py-6 font-semibold">{money(r.SHARED.FRIDAY, lang)}</td>
                <td className="border-b border-[#EFE9DE] px-7 py-6 text-ink-2">{c.foodIncl}</td>
              </tr>
              <tr>
                <td className="px-7 py-6"><div className={`text-2xl ${display}`}>{c.fullRow}</div><div className="text-[13px] text-ink-muted">{plain(c.fullSub, vars)}</div></td>
                <td className="px-4 py-6 font-semibold">{money(r.FULL_BOAT.SUN_WED, lang)}</td>
                <td className="px-4 py-6 font-semibold">{money(r.FULL_BOAT.THU_SAT, lang)}</td>
                <td className="px-4 py-6 font-semibold">{money(r.FULL_BOAT.FRIDAY, lang)}</td>
                <td className="px-7 py-6 text-ink-2">{plain(c.foodOpt, { price: money(r.FULL_BOAT_FOOD.SUN_WED, lang) })}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
          {inc.length > 0 && (
            <div className="rounded-3xl bg-pine p-7 text-white md:p-8">
              <div className="s-eyebrow-light">{c.incTitle}</div>
              <ul className="mt-4 flex flex-col gap-3 text-base">{inc.map((x, i) => <li key={i}>{x.item}</li>)}</ul>
            </div>
          )}
          <div className="rounded-3xl bg-dune p-7 md:p-8">
            {notInc.length > 0 && (
              <>
                <div className="text-xs font-semibold uppercase tracking-[2.6px] text-ink-muted md:text-[13px]">{c.notIncTitle}</div>
                <ul className="mb-6 mt-4 flex flex-col gap-3 text-base">{notInc.map((x, i) => <li key={i}>{x.item}</li>)}</ul>
              </>
            )}
            <p className="text-sm leading-[22px] text-ink-2">
              {cfg.ageBands.map((b) => `${b.name}: ${b.pctOfAdult === 0 ? c.ageFree : b.pctOfAdult === 100 ? c.ageFull : `${num(b.pctOfAdult, lang)}%`}`).join(" · ")}.{" "}
              {plain(c.payNote, { pct: num(cfg.settings.advancePct, lang), h: num(cfg.settings.balanceLeadHours, lang) })}
            </p>
          </div>
        </div>
      </section>

      {c.on("showItinerary") && (day1.length > 0 || day2.length > 0) && (
        <section id="itinerary" aria-labelledby="it-h" className="s-wrap scroll-mt-4 pt-20 md:pt-[130px]">
          {c.itEyebrow && <div className="s-eyebrow">{c.itEyebrow}</div>}
          <h2 id="it-h" className={h2}>{rich(c.itTitle, vars)}</h2>
          <div className="mt-8 grid grid-cols-1 gap-5 md:mt-12 md:grid-cols-2 md:gap-6">
            {day1.length > 0 && day(c.day1Title, day1)}
            {day2.length > 0 && day(c.day2Title, day2)}
          </div>
        </section>
      )}

      {c.on("showReady") && (
        <section aria-labelledby="ready-h" className="s-wrap pt-20 md:pt-[130px]">
          <div className="s-dark flex flex-wrap items-center justify-between gap-8 rounded-3xl bg-pine p-8 text-white md:rounded-[32px] md:p-[72px]">
            <div>
              <h2 id="ready-h" className={`s-h2 ${display}`}>{rich(c.readyTitle, vars)}</h2>
              {c.readyText && <p className="mt-3.5 text-[17px] text-white/85">{c.readyText}</p>}
            </div>
            {c.readyButton && <a href="/book" className="s-btn-light h-14 px-[30px] text-base">{c.readyButton}</a>}
          </div>
        </section>
      )}
    </main>
  );
}
