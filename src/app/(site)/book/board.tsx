"use client";

import { useMemo, useState } from "react";
import {
  availabilityFor, checkBookingWindow, quoteFullBoat, quoteShared, rateFor, splitPayment, validateFullBoat, validateShared,
  weekday, type GuestCount, type PricingConfig, type Quote,
} from "@/domain";
import Image from "next/image";
import { Icon } from "@/components/ui";
import { DICT, dayShort, fill, money, monthName, num, tripDate, type Lang } from "@/lib/i18n";
import type { PublicMonth } from "@/server/queries";
import { requestBookingAction } from "../actions";

interface Props {
  lang: Lang;
  data: PublicMonth;
  today: string;
  prevMonth: string | null;
  nextMonth: string;
  initial: { date: string | null; type: "SHARED" | "FULL_BOAT"; adults: number; children: number };
  error?: string;
  taken: string[] | null;
  phone: string;
  cabinPics: { src: string; alt: string; pos?: string }[];
  summaryPic: { src: string; alt: string; pos?: string };
}

export function BookBoard({ lang, data, today, prevMonth, nextMonth, initial, error, taken, phone, cabinPics, summaryPic }: Props) {
  const t = DICT[lang].book;
  const cfg: PricingConfig = useMemo(() => ({ ...data.pricing, holidays: new Set(data.pricing.holidays) }), [data]);
  const display = lang === "bn" ? "font-bnDisplay" : "font-display";
  const bands = cfg.ageBands;
  const adultBand = bands.find((b) => b.isAdult)?.name ?? "Adult";
  const childBand = bands.find((b) => !b.isAdult && b.pctOfAdult > 0)?.name;
  const infantBand = bands.find((b) => !b.isAdult && b.pctOfAdult === 0)?.name;

  const [mode, setMode] = useState<"SHARED" | "FULL_BOAT">(initial.type);
  const [day, setDay] = useState<string | null>(initial.date);
  const [picked, setPicked] = useState<string[]>([]);
  const [adults, setAdults] = useState(initial.adults);
  const [children, setChildren] = useState(initial.children);
  const [infants, setInfants] = useState(0);
  const [meals, setMeals] = useState(true);

  const info = (date: string) => {
    const d = data.days.find((x) => x.date === date)!;
    const av = availabilityFor(data.cabins, d.bookings, d.blocked);
    let windowOk = true;
    try { checkBookingWindow(date, today, cfg.settings, "ONLINE"); } catch { windowOk = false; }
    return { d, av, windowOk };
  };

  const [y, m] = data.month.split("-").map(Number);
  const lead = weekday(`${data.month}-01`);
  const isShared = mode === "SHARED";

  const guests: GuestCount[] = [
    { band: adultBand, count: adults },
    ...(childBand ? [{ band: childBand, count: children }] : []),
    ...(infantBand ? [{ band: infantBand, count: infants }] : []),
  ];
  const total = guests.reduce((n, g) => n + g.count, 0);
  const foodGuests: GuestCount[] = meals ? guests : [];
  const sel = day ? info(day) : null;
  const chosen = data.cabins.filter((c) => picked.includes(c.id));
  const perCabin: Record<string, number> = {};
  {
    let left = total;
    chosen.forEach((c) => { perCabin[c.id] = 0; });
    while (left > 0 && chosen.some((c) => perCabin[c.id] < c.capacity)) {
      for (const c of chosen) if (left > 0 && perCabin[c.id] < c.capacity) { perCabin[c.id]++; left--; }
    }
    if (left > 0 && chosen[0]) perCabin[chosen[0].id] += left;
  }

  let quote: Quote | null = null;
  let problem = "";
  if (!day || !sel) problem = t.pickDate;
  else {
    try {
      if (total < 2) throw new Error(t.needGuests);
      if (isShared) {
        if (picked.length < 2) throw new Error(t.needCabins);
        validateShared(data.cabins, sel.av, { cabinIds: picked, guestsPerCabin: perCabin, guests: guests.filter((g) => g.count > 0) }, cfg.settings);
      } else {
        validateFullBoat(data.cabins, sel.av, { guests: guests.filter((g) => g.count > 0), foodGuests: foodGuests.filter((g) => g.count > 0) }, cfg.settings);
      }
    } catch (e) {
      const msg = (e as Error).message;
      problem = /capacity|holds/i.test(msg)
        ? (isShared ? fill(t.tooMany, { n: num(total, lang) }) : fill(t.boatCap, { n: num(cfg.settings.capacityCap, lang) }))
        : msg;
    }
    quote = isShared
      ? quoteShared(cfg, { date: day, cabins: chosen.map((c) => ({ ...c, guests: perCabin[c.id] ?? 0 })), guests })
      : quoteFullBoat(cfg, { date: day, foodGuests });
  }
  const amount = quote?.total ?? 0;
  const adv = splitPayment(amount, "ADVANCE", cfg.settings.advancePct);

  const payload = JSON.stringify({
    tripDate: day, type: mode, cabinIds: isShared ? picked : [], guestsPerCabin: perCabin, guests, foodGuests,
  });

  const stepper = (label: string, hint: string, v: number, set: (n: number) => void, lo: number) => (
    <div className="flex items-center justify-between gap-3">
      <div><div className="text-[15px]">{label}</div><div className="text-xs text-white/70">{hint}</div></div>
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => set(Math.max(lo, v - 1))} aria-label={`− ${label}`} className="h-10 w-10 rounded-full border border-white/40 text-lg text-white hover:bg-white/10">−</button>
        <span className="w-[26px] text-center text-[17px] font-semibold">{num(v, lang)}</span>
        <button type="button" onClick={() => set(Math.min(16, v + 1))} aria-label={`+ ${label}`} className="h-10 w-10 rounded-full border border-white/40 text-lg text-white hover:bg-white/10">+</button>
      </div>
    </div>
  );
  const card = "rounded-3xl border border-dune-line bg-white p-5 md:p-7";
  const legend = (cls: string, label: string) => <span className="flex items-center gap-2"><span className={`h-3.5 w-3.5 rounded ${cls}`} />{label}</span>;
  const qs = `type=${mode}&adults=${adults}&children=${children}`;

  return (
    <form action={requestBookingAction} aria-label={t.yourTrip} className="mt-8 flex flex-wrap items-start gap-6 md:mt-11 md:gap-8">
      <input type="hidden" name="payload" value={payload} />
      <div className="absolute left-[-9999px]" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>

      <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-5 md:gap-6">
        {(error || taken) && (
          <div role="alert" className="rounded-2xl bg-amber-soft px-5 py-4 text-sm text-amber-ink">
            {taken ? (
              <>
                {t.taken}{" "}
                {taken.length ? taken.map((d, i) => (
                  <a key={d} href={`/book?date=${d}&${qs}`} className="font-semibold text-amber-ink underline">{tripDate(d, lang)}{i < taken.length - 1 ? ", " : ""}</a>
                )) : t.noneSoon}
              </>
            ) : error}
          </div>
        )}

        <div role="radiogroup" aria-label={DICT[lang].search.package} className="inline-flex self-start rounded-full bg-dune p-[5px]">
          {(["SHARED", "FULL_BOAT"] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => { setMode(k); setPicked([]); }}
              className={`h-11 rounded-full px-5 text-[15px] font-semibold md:px-[22px] ${mode === k ? "bg-white text-pine shadow-[0_2px_8px_rgba(8,30,28,0.08)]" : "text-ink-2"}`}>
              {k === "SHARED" ? DICT[lang].search.shared : DICT[lang].search.full}
            </button>
          ))}
        </div>

        <section aria-labelledby="cal-h" className={card}>
          <div className="flex items-center justify-between gap-4">
            <h2 id="cal-h" className={`text-[26px] md:text-[30px] ${display}`}>{monthName(m - 1, lang)} {num(y, lang)}</h2>
            <div className="flex gap-2">
              {prevMonth
                ? <a href={`/book?month=${prevMonth}&${qs}`} aria-label="Previous month" className="flex h-11 w-11 items-center justify-center rounded-full border border-dune-rule text-ink hover:text-ink"><Icon name="left" size={16} /></a>
                : <span className="h-11 w-11" />}
              <a href={`/book?month=${nextMonth}&${qs}`} aria-label="Next month" className="flex h-11 w-11 items-center justify-center rounded-full border border-dune-rule text-ink hover:text-ink"><Icon name="right" size={16} /></a>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-[1px] text-ink-muted sm:gap-2 md:text-xs">
            {Array.from({ length: 7 }, (_, w) => <div key={w}>{dayShort(w, lang)}</div>)}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
            {Array.from({ length: lead }, (_, k) => <div key={`b${k}`} />)}
            {data.days.map((d) => {
              const i = info(d.date);
              const can = isShared ? i.av.canBookShared : i.av.canBookFullBoat;
              const closed = !i.windowOk || d.blocked;
              const ok = !closed && can;
              const free = i.av.freeCabinIds.length;
              const on = d.date === day;
              const few = ok && free < data.cabins.length;
              const label = closed ? (d.date < today || !i.windowOk ? t.callUs : t.closed) : !can ? t.full : few ? fill(t.someLeft, { n: num(free, lang) }) : t.available;
              const tone = on ? "border-pine bg-pine text-white"
                : !ok ? (closed ? "border-transparent bg-transparent text-[#6F7A77]" : "border-dune-rule bg-[#F1EEE8] text-ink-muted")
                : few ? "border-[#E2BE7E] bg-amber-soft text-[#6B4614] hover:border-amber"
                : "border-[#A9CFC3] bg-[#E4F0EC] text-pine hover:border-pine-2";
              return (
                <button key={d.date} type="button" disabled={!ok} aria-pressed={on} onClick={() => { setDay(d.date); setPicked([]); }}
                  aria-label={`${tripDate(d.date, lang)}, ${label}`}
                  className={`flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-[12px] border sm:min-h-[64px] sm:rounded-[14px] ${tone} ${ok ? "" : "cursor-not-allowed"}`}>
                  <span className={`text-[15px] font-semibold sm:text-[17px] ${!ok && !closed ? "line-through" : ""}`}>{num(Number(d.date.slice(8)), lang)}</span>
                  {ok && <span className="hidden text-xs sm:block">{money(rateFor(cfg, d.date, isShared ? "SHARED" : "FULL_BOAT"), lang)}</span>}
                  {!ok && !closed && <span className="hidden text-xs sm:block">{t.full}</span>}
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-ink-2">
            {legend("border border-[#A9CFC3] bg-[#E4F0EC]", t.available)}
            {legend("border border-[#E2BE7E] bg-amber-soft", lang === "bn" ? "কয়েকটি কেবিন বাকি" : "Few cabins left")}
            {legend("border border-dune-rule bg-[#F1EEE8]", t.full)}
            {legend("bg-pine", lang === "bn" ? "আপনার তারিখ" : "Your date")}
            <span className="ml-auto">{isShared ? t.pricePer : t.pricePerBoat}</span>
          </div>
          <p className="mt-3 text-[13px] text-ink-muted">{fill(t.cutoff, { n: num(cfg.settings.cutoffDays, lang) })}{phone ? ` ${phone}` : ""}</p>
        </section>

        {day && sel && isShared && (
          <section aria-labelledby="cb-h" className={card}>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="cb-h" className={`text-[26px] md:text-[30px] ${display}`}>{t.chooseCabins}</h2>
              <span className="text-sm text-ink-muted">{tripDate(day, lang)} · {t.atLeast2}</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-3.5">
              {data.cabins.map((c, ci) => {
                const isTaken = !sel.av.freeCabinIds.includes(c.id);
                const on = picked.includes(c.id);
                const pic = cabinPics[ci % cabinPics.length];
                return (
                  <button key={c.id} type="button" disabled={isTaken} aria-pressed={on} onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                    className={`flex flex-col overflow-hidden rounded-[18px] text-left text-ink ${isTaken ? "cursor-not-allowed border border-dune-rule bg-[#F1EEE8] text-ink-muted" : on ? "border-2 border-pine bg-white" : "border border-dune-rule bg-white hover:border-pine-2"}`}>
                    <span className="relative block h-[96px] w-full bg-dune md:h-[120px]">
                      {isTaken
                        ? <span className="flex h-full items-center justify-center text-xs font-semibold uppercase tracking-[1px]">{t.booked}</span>
                        : pic && <Image src={pic.src} alt="" fill sizes="(min-width: 1024px) 15vw, 45vw" className="object-cover" style={{ objectPosition: pic.pos ?? "center" }} />}
                    </span>
                    <span className="flex flex-col gap-0.5 px-3.5 py-3">
                      <span className="flex items-center justify-between gap-2">
                        <b className="text-[15px]">{c.name}</b>
                        {!isTaken && <span aria-hidden="true" className={`flex h-5 w-5 items-center justify-center rounded-md border ${on ? "border-pine bg-pine text-white" : "border-[#B9B1A2] bg-white"}`}>{on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>}</span>}
                      </span>
                      <span className="text-[13px] text-ink-muted">{c.type} · {fill(t.sleeps, { n: num(c.capacity, lang) })}{c.surcharge ? ` · +${money(c.surcharge, lang)}` : ""}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section aria-labelledby="you-h" className={card}>
          <h2 id="you-h" className={`text-[26px] md:text-[30px] ${display}`}>{lang === "bn" ? "আপনার তথ্য" : "About you"}</h2>
          <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-semibold">{t.name}<input name="name" required autoComplete="name" placeholder={t.namePh} className="s-input font-normal" /></label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">{t.mobile}<input name="mobile" required inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" pattern="(\+?88)?01[3-9][0-9]{8}" className="s-input font-normal" /></label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">{t.nid}<input name="nid" required inputMode="numeric" placeholder={t.nidPh} className="s-input font-normal" /></label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">{t.email} <span className="-mt-1.5 font-normal text-ink-muted">({t.optional})</span><input name="email" type="email" autoComplete="email" placeholder={t.emailPh} className="s-input font-normal" /></label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold sm:col-span-2">{t.notes} <span className="-mt-1.5 font-normal text-ink-muted">({t.optional})</span><textarea name="notes" maxLength={500} placeholder={t.notesPh} className="s-input h-[88px] py-3 font-normal" /></label>
          </div>
          <label className="mt-4 flex items-start gap-2.5 text-[13px] leading-[19px] text-ink-2">
            <input type="checkbox" name="agree" required className="mt-px h-[18px] w-[18px] accent-pine" />
            <span><a href="/terms" target="_blank">{DICT[lang].footer.terms}</a> · {t.agree}</span>
          </label>
        </section>
      </div>

      <aside aria-labelledby="sum-h" className="s-dark min-w-0 flex-[1_1_360px] overflow-hidden rounded-3xl bg-pine text-white lg:sticky lg:top-6">
        <div className="relative h-[150px] bg-pine-night md:h-[180px]">
          <Image src={summaryPic.src} alt="" fill sizes="(min-width: 1024px) 30vw, 100vw" className="object-cover" style={{ objectPosition: summaryPic.pos ?? "50% 30%" }} />
        </div>
        <div className="flex flex-col gap-5 p-6 md:p-7">
          <div>
            <h2 id="sum-h" className={`text-[28px] ${display}`}>{t.yourTrip}</h2>
            <div className="mt-1.5 text-[15px] text-white/80">{day ? tripDate(day, lang) : t.pickDate} · {isShared ? DICT[lang].search.shared : DICT[lang].search.full}</div>
            <div className="mt-0.5 text-[13px] text-white/70">{t.boardTimes}</div>
          </div>

          <div className="flex flex-col gap-3">
            {isShared && day && (
              <div className="flex justify-between gap-3 text-[15px]"><span className="text-white/80">{lang === "bn" ? "কেবিন" : "Cabins"}</span><span className="text-right">{chosen.length ? chosen.map((c) => c.name).join(", ") : "–"}</span></div>
            )}
            {stepper(DICT[lang].search.adults, t.adultsHint, adults, setAdults, 1)}
            {childBand && stepper(DICT[lang].search.children, t.childrenHint, children, setChildren, 0)}
            {infantBand && stepper(DICT[lang].search.infants, t.infantsHint, infants, setInfants, 0)}
          </div>

          {day && !isShared && (
            <label className="flex items-center gap-2.5 text-sm"><input type="checkbox" checked={meals} onChange={(e) => setMeals(e.target.checked)} className="h-[18px] w-[18px] accent-gold" />
              {t.meals} · {fill(t.mealsNote, { price: money(rateFor(cfg, day, "FULL_BOAT_FOOD"), lang) })}</label>
          )}

          {quote && (
            <div className="flex flex-col gap-2.5 border-t border-white/20 pt-4">
              {quote.lines.map((l, i) => (
                <div key={i} className="flex justify-between gap-3 text-sm">
                  <span className="text-white/80">{num(l.qty, lang)} × {l.description.replace(/^Shared package, |^Food package, /, "")} · {money(l.unitPrice, lang)}</span>
                  <span>{money(l.total, lang)}</span>
                </div>
              ))}
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <span className="text-[15px]">{t.total}</span>
                <span className={`text-[36px] md:text-[40px] ${display}`}>{money(amount, lang)}</span>
              </div>
              <div className="text-[13px] text-white/75">{fill(t.advance, { pct: num(cfg.settings.advancePct, lang), amount: money(adv.dueNow, lang) })}</div>
            </div>
          )}

          <div role="status" className={`rounded-xl px-3.5 py-2.5 text-[13px] ${problem ? "bg-amber-soft text-amber-ink" : "bg-white/10 text-white"}`}>{problem || t.ok}</div>
          <button disabled={!!problem} className="h-14 w-full rounded-2xl bg-white text-base font-semibold text-pine hover:bg-dune disabled:cursor-not-allowed disabled:opacity-60">{t.send}</button>
          <div className="flex items-start gap-2.5 text-[13px] leading-5 text-white/80">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F2D9A9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-px flex-none"><path d="M12 3l7 3v6c0 4-3 7.5-7 9-4-1.5-7-5-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" /></svg>
            <span>{fill(t.holdNote, { h: num(cfg.settings.approvalWindowHours, lang) })}</span>
          </div>
        </div>
      </aside>
    </form>
  );
}
