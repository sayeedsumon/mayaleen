"use client";

import { useMemo, useState } from "react";
import {
  availabilityFor, checkBookingWindow, quoteFullBoat, quoteShared, rateFor, splitPayment, validateFullBoat, validateShared,
  weekday, type GuestCount, type PricingConfig, type Quote,
} from "@/domain";
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
}

export function BookBoard({ lang, data, today, prevMonth, nextMonth, initial, error, taken, phone }: Props) {
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
    <div className="flex items-center gap-2.5">
      <div><div className="text-sm font-semibold">{label}</div><div className="text-xs text-ink-muted">{hint}</div></div>
      <button type="button" onClick={() => set(Math.max(lo, v - 1))} aria-label={`− ${label}`} className="h-10 w-10 rounded-[10px] border border-field bg-white text-lg">−</button>
      <span className="w-[26px] text-center text-[17px] font-semibold">{num(v, lang)}</span>
      <button type="button" onClick={() => set(Math.min(16, v + 1))} aria-label={`+ ${label}`} className="h-10 w-10 rounded-[10px] border border-field bg-white text-lg">+</button>
    </div>
  );

  return (
    <div className="mt-6 flex flex-wrap items-start gap-6">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
        {(error || taken) && (
          <div role="alert" className="rounded-xl bg-amber-soft px-4 py-3 text-sm text-amber-ink">
            {taken ? (
              <>
                {t.taken}{" "}
                {taken.length ? taken.map((d, i) => (
                  <a key={d} href={`/book?date=${d}&type=${mode}&adults=${adults}&children=${children}`} className="font-semibold text-amber-ink underline">{tripDate(d, lang)}{i < taken.length - 1 ? ", " : ""}</a>
                )) : t.noneSoon}
              </>
            ) : error}
          </div>
        )}

        <section aria-label={t.yourTrip} className="card flex flex-wrap items-center gap-5 p-5">
          {stepper(DICT[lang].search.adults, t.adultsHint, adults, setAdults, 1)}
          {childBand && stepper(DICT[lang].search.children, t.childrenHint, children, setChildren, 0)}
          {infantBand && stepper(DICT[lang].search.infants, t.infantsHint, infants, setInfants, 0)}
          <div role="radiogroup" aria-label={DICT[lang].search.package} className="flex gap-1 rounded-xl bg-sand-3 p-1 md:ml-auto">
            {(["SHARED", "FULL_BOAT"] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => { setMode(k); setPicked([]); }}
                className={`h-10 rounded-[9px] px-4 text-sm font-semibold ${mode === k ? "bg-white text-ink" : "text-ink-2"}`}>
                {k === "SHARED" ? DICT[lang].search.shared : DICT[lang].search.full}
              </button>
            ))}
          </div>
        </section>

        <section aria-label="Calendar" className="card p-5">
          <div className="mb-3.5 flex items-center gap-2.5">
            <h2 className={`flex-1 text-[26px] font-medium ${display}`}>{monthName(m - 1, lang)} {num(y, lang)}</h2>
            {prevMonth ? <a href={`/book?month=${prevMonth}&type=${mode}&adults=${adults}&children=${children}`} aria-label="Previous month" className="btn-ghost w-10 px-0"><Icon name="left" size={16} /></a> : <span className="w-10" />}
            <a href={`/book?month=${nextMonth}&type=${mode}&adults=${adults}&children=${children}`} aria-label="Next month" className="btn-ghost w-10 px-0"><Icon name="right" size={16} /></a>
          </div>
          <div className="mb-3 flex flex-wrap gap-4 text-[13px] text-ink-2">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#1E7A4F]" />{t.available}</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber" />{lang === "bn" ? "কয়েকটি কেবিন বাকি" : "Few cabins left"}</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#9AA4A1]" />{t.full}</span>
            <span className="ml-auto">{isShared ? t.pricePer : t.pricePerBoat}</span>
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {Array.from({ length: 7 }, (_, w) => <div key={w} className="px-1.5 pb-1.5 text-xs font-semibold text-ink-muted">{dayShort(w, lang)}</div>)}
            {Array.from({ length: lead }, (_, k) => <div key={`b${k}`} />)}
            {data.days.map((d) => {
              const i = info(d.date);
              const can = isShared ? i.av.canBookShared : i.av.canBookFullBoat;
              const closed = !i.windowOk || d.blocked;
              const ok = !closed && can;
              const free = i.av.freeCabinIds.length;
              const on = d.date === day;
              const [label, dot, ink] = closed
                ? [d.date < today || !i.windowOk ? t.callUs : t.closed, "bg-[#9AA4A1]", "text-ink-muted"]
                : !can ? [t.full, "bg-[#9AA4A1]", "text-ink-muted"]
                : free < data.cabins.length ? [fill(t.someLeft, { n: num(free, lang) }), "bg-amber", "text-amber-ink"]
                : [t.available, "bg-[#1E7A4F]", "text-leaf-ink"];
              return (
                <button key={d.date} type="button" disabled={!ok} aria-pressed={on} onClick={() => { setDay(d.date); setPicked([]); }}
                  aria-label={`${tripDate(d.date, lang)}, ${label}`}
                  className={`flex min-h-[64px] flex-col items-start gap-0.5 rounded-xl p-1.5 text-left text-ink sm:min-h-[84px] sm:p-2.5 ${on ? "border-2 border-lake bg-lake-faint" : ok ? "border border-line bg-white hover:border-[#9DB9B4]" : "cursor-not-allowed border border-hair bg-sand opacity-70"}`}>
                  <span className="text-base font-semibold">{num(Number(d.date.slice(8)), lang)}</span>
                  {!closed && <span className="hidden text-xs text-ink-2 sm:block">{money(rateFor(cfg, d.date, isShared ? "SHARED" : "FULL_BOAT"), lang)}</span>}
                  <span className={`flex items-center gap-1 text-[11px] font-semibold ${ink}`}><span className={`h-[7px] w-[7px] flex-none rounded-full ${dot}`} /><span className="hidden sm:inline">{label}</span></span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[13px] text-ink-muted">{fill(t.cutoff, { n: num(cfg.settings.cutoffDays, lang) })}{phone ? ` ${phone}` : ""}</p>
        </section>
      </div>

      <form action={requestBookingAction} aria-label={t.yourTrip} className="card flex min-w-0 max-w-full flex-[1_1_360px] flex-col gap-[18px] p-[22px] lg:max-w-[460px]">
        <input type="hidden" name="payload" value={payload} />
        <div className="absolute left-[-9999px]" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <div>
          <div className="text-[13px] font-medium text-ink-muted">{t.yourTrip}</div>
          <h2 className={`mt-0.5 text-[26px] font-medium ${display}`}>{day ? tripDate(day, lang) : t.pickDate}</h2>
          <div className="mt-1 text-sm text-ink-2">{t.boardTimes}</div>
        </div>

        {day && sel && isShared && (
          <div className="flex flex-col gap-2">
            <div className="text-sm font-semibold">{t.chooseCabins} <span className="font-normal text-ink-muted">· {t.atLeast2}</span></div>
            <div className="grid grid-cols-2 gap-2">
              {data.cabins.map((c) => {
                const isTaken = !sel.av.freeCabinIds.includes(c.id);
                const on = picked.includes(c.id);
                return (
                  <button key={c.id} type="button" disabled={isTaken} aria-pressed={on} onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                    className={`flex flex-col items-start gap-0.5 rounded-xl px-3 py-2.5 text-left text-ink ${isTaken ? "cursor-not-allowed border border-dashed border-[#CFC9BD] bg-sand" : on ? "border-2 border-lake bg-lake-faint" : "border border-field bg-white"}`}>
                    <span className="text-sm font-semibold">{c.name}</span>
                    <span className="text-xs text-ink-muted">{c.type} · {fill(t.sleeps, { n: num(c.capacity, lang) })}{c.surcharge ? ` · +${money(c.surcharge, lang)}` : ""}</span>
                    <span className={`text-xs font-semibold ${isTaken ? "text-ink-muted" : on ? "text-lake-dark" : "text-leaf-ink"}`}>{isTaken ? t.booked : on ? t.selected : t.free}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {day && !isShared && (
          <label className="flex items-center gap-2.5 text-sm"><input type="checkbox" checked={meals} onChange={(e) => setMeals(e.target.checked)} className="h-[18px] w-[18px] accent-lake" />
            {t.meals} · {fill(t.mealsNote, { price: money(rateFor(cfg, day, "FULL_BOAT_FOOD"), lang) })}</label>
        )}

        {quote && (
          <div className="flex flex-col gap-2 rounded-2xl bg-sand p-4">
            {quote.lines.map((l, i) => (
              <div key={i} className="flex justify-between gap-3 text-sm text-ink-2">
                <span>{num(l.qty, lang)} × {l.description.replace(/^Shared package, |^Food package, /, "")} · {money(l.unitPrice, lang)}</span>
                <span>{money(l.total, lang)}</span>
              </div>
            ))}
            <div className="flex items-baseline justify-between border-t border-line pt-2.5">
              <span className="text-[15px] font-semibold">{t.total}</span>
              <span className={`text-[30px] font-medium ${display}`}>{money(amount, lang)}</span>
            </div>
            <div className="text-[13px] text-ink-2">{fill(t.advance, { pct: num(cfg.settings.advancePct, lang), amount: money(adv.dueNow, lang) })}</div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="label col-span-2">{t.name}<input name="name" required autoComplete="name" placeholder={t.namePh} className="input h-[46px] text-[15px]" /></label>
          <label className="label col-span-2 sm:col-span-1">{t.mobile}<input name="mobile" required inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" pattern="(\+?88)?01[3-9][0-9]{8}" className="input h-[46px] text-[15px]" /></label>
          <label className="label col-span-2 sm:col-span-1">{t.nid}<input name="nid" required inputMode="numeric" placeholder={t.nidPh} className="input h-[46px] text-[15px]" /></label>
          <label className="label col-span-2">{t.email} <span className="font-normal text-ink-muted">({t.optional})</span><input name="email" type="email" autoComplete="email" placeholder={t.emailPh} className="input h-[46px] text-[15px]" /></label>
          <label className="label col-span-2">{t.notes} <span className="font-normal text-ink-muted">({t.optional})</span><textarea name="notes" maxLength={500} placeholder={t.notesPh} className="input h-[72px] py-2.5 text-[15px]" /></label>
        </div>
        <label className="flex items-start gap-2.5 text-[13px] leading-[19px] text-ink-2">
          <input type="checkbox" name="agree" required className="mt-px h-[18px] w-[18px] accent-lake" />
          <span><a href="/terms" target="_blank">{DICT[lang].footer.terms}</a> · {t.agree}</span>
        </label>
        <div role="status" className={`rounded-[10px] px-3 py-2.5 text-[13px] ${problem ? "bg-amber-soft text-amber-ink" : "bg-lake-soft text-lake-dark"}`}>{problem || t.ok}</div>
        <button disabled={!!problem} className="btn h-[52px] text-base">{t.send}</button>
        <p className="text-center text-xs text-ink-muted">{fill(t.holdNote, { h: num(cfg.settings.approvalWindowHours, lang) })}</p>
      </form>
    </div>
  );
}
