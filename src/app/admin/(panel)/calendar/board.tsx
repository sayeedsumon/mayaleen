"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  RuleError, availabilityFor, checkBookingWindow, dayTypeOf, quoteFullBoat, quoteShared, rateFor, splitPayment,
  validateFullBoat, validateShared, weekday, type GuestCount, type PricingConfig, type Quote,
} from "@/domain";
import { Icon } from "@/components/ui";
import type { CalendarData } from "@/server/queries";
import { blockDateAction, createBookingAction } from "../../_actions/booking";

const tk = (n: number) => `Tk ${Math.round(n).toLocaleString("en-US")}`;
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DT_LABEL: Record<string, string> = { SUN_WED: "Sun–Wed rate", THU_SAT: "Thu / Sat rate", FRIDAY: "Friday rate", HOLIDAY: "Holiday rate" };
const STATUS: Record<string, [string, string]> = {
  PENDING_APPROVAL: ["Needs approval", "bg-amber-soft text-amber-ink"],
  AWAITING_PAYMENT: ["Awaiting payment", "bg-amber-soft text-amber-ink"],
  PAYMENT_SUBMITTED: ["Proof to verify", "bg-sky-soft text-sky-ink"],
  CONFIRMED_BALANCE_DUE: ["Balance due", "bg-lake-soft text-lake-dark"],
  CONFIRMED_PAID: ["Paid", "bg-leaf-soft text-leaf-ink"],
  CHECKED_IN: ["On board", "bg-lake-soft text-lake-dark"],
};
const HELD = ["PENDING_APPROVAL", "AWAITING_PAYMENT", "PAYMENT_SUBMITTED"];
const REASONS = ["Repeat guest", "Corporate rate", "Promotion", "Long-time partner", "Service recovery", "Other"];

interface Props {
  data: CalendarData; today: string; initialDay: string; initialCabins: string[]; prevMonth: string; nextMonth: string; canManage: boolean; canCreate: boolean;
}

/** Short price for narrow phone cells: 7800 → "7.8k", 55000 → "55k". */
function shortTk(n: number) {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`;
}

export function CalendarBoard({ data, today, initialDay, initialCabins, prevMonth, nextMonth, canManage, canCreate }: Props) {
  const cfg: PricingConfig = useMemo(() => ({ ...data.pricing, holidays: new Set(data.pricing.holidays) }), [data]);
  const active = data.cabins.filter((c) => c.active);
  const bands = cfg.ageBands;
  const adultBand = bands.find((b) => b.isAdult)?.name ?? "Adult";

  const [day, setDay] = useState(initialDay);
  const [mode, setMode] = useState<"SHARED" | "FULL_BOAT">("SHARED");
  const [picked, setPicked] = useState<string[]>(initialCabins);
  const [counts, setCounts] = useState<Record<string, number>>({ [adultBand]: 2 });
  const [food, setFood] = useState<Record<string, number>>({});
  const [adjOpen, setAdjOpen] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [reason, setReason] = useState(REASONS[0]);
  const [approve, setApprove] = useState(canManage);
  const [blockOpen, setBlockOpen] = useState(false);

  const info = (date: string) => {
    const d = data.days.find((x) => x.date === date)!;
    const live = d.bookings.filter((b) => b.status !== "CANCELLED");
    const av = availabilityFor(active, live.map((b) => ({ type: b.type, cabinIds: b.cabinIds })), !!d.blockReason);
    let windowError = "";
    try { checkBookingWindow(date, today, cfg.settings, "STAFF"); } catch (e) { windowError = (e as Error).message; }
    return { d, av, past: date < today, windowError };
  };

  const pick = (date: string) => {
    const i = info(date);
    setDay(date);
    setMode(i.av.canBookShared ? "SHARED" : "FULL_BOAT");
    setPicked([]);
    setBlockOpen(false);
    if (typeof window !== "undefined") window.history.replaceState(null, "", `?month=${data.month}&day=${date}`);
  };

  // ---------- month grid ----------
  const [y, m] = data.month.split("-").map(Number);
  const lead = weekday(`${data.month}-01`);
  const cells = data.days.map((d) => {
    const i = info(d.date);
    const taken = new Map<string, string>();
    for (const b of d.bookings) for (const c of b.cabinIds) taken.set(c, b.status);
    let label = "Open"; let tone = "text-leaf-ink"; let bg = "bg-white";
    if (i.past) { label = "Past"; tone = "text-ink-muted"; bg = "bg-sand"; }
    else if (d.blockReason) { label = "Blocked"; tone = "text-[#5B3A1E]"; bg = "bg-[#EEEAE2]"; }
    else if (i.av.mode === "FULL_BOAT") { label = "Full boat"; tone = "text-lake-dark"; bg = "bg-[#EEF5F3]"; }
    else if (i.av.freeCabinIds.length === active.length) { label = "Open"; }
    else if (i.av.canBookShared) { label = `${i.av.freeCabinIds.length} of ${active.length} free`; tone = "text-lake-dark"; }
    else { label = "Sold out"; tone = "text-rose-ink"; bg = "bg-[#FBF6F4]"; }
    const dt = dayTypeOf(d.date, cfg.holidays);
    return { d, i, label, tone, bg, taken, price: rateFor(cfg, d.date, "SHARED"), dt };
  });

  // ---------- selected day ----------
  const sel = info(day);
  const dt = dayTypeOf(day, cfg.holidays);
  const isShared = mode === "SHARED" && sel.av.canBookShared;
  const effectiveMode = isShared ? "SHARED" : "FULL_BOAT";
  const open = !sel.past && !sel.d.blockReason && (sel.av.canBookShared || sel.av.canBookFullBoat);
  const guests: GuestCount[] = bands.map((b) => ({ band: b.name, count: counts[b.name] ?? 0 }));
  const totalGuests = guests.reduce((n, g) => n + g.count, 0);
  const foodGuests: GuestCount[] = bands.map((b) => ({ band: b.name, count: food[b.name] ?? 0 }));

  // spread guests across picked cabins, filling each up to its capacity in turn
  const chosen = active.filter((c) => picked.includes(c.id));
  const perCabin: Record<string, number> = {};
  {
    let left = totalGuests;
    const caps = chosen.map((c) => ({ id: c.id, cap: c.capacity }));
    caps.forEach((c) => { perCabin[c.id] = 0; });
    while (left > 0 && caps.some((c) => perCabin[c.id] < c.cap)) {
      for (const c of caps) { if (left > 0 && perCabin[c.id] < c.cap) { perCabin[c.id]++; left--; } }
    }
    if (left > 0 && caps[0]) perCabin[caps[0].id] += left; // over capacity: validation reports it
  }

  let quote: Quote | null = null;
  let problem = "";
  try {
    if (!open) throw new RuleError("CLOSED", "");
    const disc = discount > 0 ? { amount: discount, reason } : undefined;
    if (isShared) {
      validateShared(active, sel.av, { cabinIds: picked, guestsPerCabin: perCabin, guests: guests.filter((g) => g.count > 0) }, cfg.settings);
      quote = quoteShared(cfg, { date: day, cabins: chosen.map((c) => ({ ...c, guests: perCabin[c.id] })), guests, discount: disc });
    } else {
      validateFullBoat(active, sel.av, { guests: guests.filter((g) => g.count > 0), foodGuests: foodGuests.filter((g) => g.count > 0) }, cfg.settings);
      quote = quoteFullBoat(cfg, { date: day, foodGuests, discount: disc });
    }
  } catch (e) {
    problem = (e as Error).message;
    // still show a price while the form is incomplete
    try {
      quote = isShared
        ? quoteShared(cfg, { date: day, cabins: chosen.map((c) => ({ ...c, guests: perCabin[c.id] ?? 0 })), guests })
        : quoteFullBoat(cfg, { date: day, foodGuests });
    } catch { quote = null; }
  }
  if (isShared && picked.length < 2) problem = "Pick at least 2 cabins. A shared booking needs 2 or more.";
  const total = quote?.total ?? 0;
  const advance = splitPayment(total, "ADVANCE", cfg.settings.advancePct);

  const payload = JSON.stringify({
    tripDate: day, type: effectiveMode, cabinIds: isShared ? picked : [], guestsPerCabin: perCabin,
    guests, foodGuests, discount, discountReason: reason, approve: canManage && approve,
  });

  const step = (k: string, by: number, which: "g" | "f") => {
    const set = which === "g" ? setCounts : setFood;
    set((c) => ({ ...c, [k]: Math.max(0, (c[k] ?? 0) + by) }));
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center gap-4">
        <div className="min-w-[260px] flex-1">
          <div className="eyebrow">Availability</div>
          <h1 className="h1 mt-0.5">{MONTHS[m - 1]} {y}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`?month=${prevMonth}`} aria-label="Previous month" className="btn-ghost w-10 px-0"><Icon name="left" size={16} /></Link>
          <Link href={`?month=${today.slice(0, 7)}&day=${today}`} className="btn-ghost">Today</Link>
          <Link href={`?month=${nextMonth}`} aria-label="Next month" className="btn-ghost w-10 px-0"><Icon name="right" size={16} /></Link>
        </div>
        <div role="tablist" aria-label="View" className="flex gap-1 rounded-[10px] bg-sand-3 p-1">
          <span role="tab" aria-selected="true" className="rounded-[7px] bg-white px-3.5 py-2 text-sm font-semibold">Month</span>
          <Link role="tab" aria-selected="false" href={`/admin/timeline?from=${day}`} className="rounded-[7px] px-3.5 py-2 text-sm font-medium text-ink-2 no-underline">Timeline</Link>
        </div>
      </header>

      <div className="flex flex-wrap items-start gap-5">
        <section aria-label="Month calendar" className="card min-w-0 flex-[999_1_560px] p-4">
          <div className="flex flex-wrap items-center gap-4 px-1 pb-3.5 text-[13px] text-ink-2">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-lake" />Confirmed</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-amber" />Held, not paid</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] border-[1.5px] border-[#9AA4A1]" />Free cabin</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#B03A2E]" />Holiday</span>
            <span className="ml-auto text-ink-muted">Price shown per guest, shared cabins</span>
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {WD.map((w) => <div key={w} className="min-w-0 px-1 pb-1.5 text-xs font-semibold text-ink-muted sm:px-1.5">{w}</div>)}
            {Array.from({ length: lead }, (_, k) => <div key={`b${k}`} />)}
            {cells.map((c) => {
              const on = c.d.date === day;
              return (
                <button
                  key={c.d.date}
                  type="button"
                  onClick={() => pick(c.d.date)}
                  aria-pressed={on}
                  aria-label={`${Number(c.d.date.slice(8))} ${MONTHS[m - 1]}, ${c.label}${c.d.holiday ? `, ${c.d.holiday}` : ""}`}
                  className={`flex min-h-[84px] min-w-0 flex-col gap-0.5 overflow-hidden rounded-[10px] p-1.5 text-left text-ink hover:border-[#9DB9B4] sm:min-h-[96px] sm:gap-1 sm:p-2 ${c.bg} ${on ? "border-2 border-lake" : "border border-line"}`}
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold leading-tight">{Number(c.d.date.slice(8))}</span>
                    {!c.i.past && (
                      <span className="truncate text-[10px] leading-tight text-ink-muted sm:text-[11px]">
                        <span className="xl:hidden">{shortTk(c.price)}</span>
                        <span className="hidden whitespace-nowrap xl:inline">{tk(c.price)}</span>
                      </span>
                    )}
                  </span>
                  <span className={`flex min-w-0 items-center gap-1 text-[11px] font-medium sm:text-xs ${c.tone}`}>
                    {c.d.holiday && <span title={c.d.holiday} className="h-2 w-2 flex-none rounded-full bg-[#B03A2E]" />}
                    <span className="truncate">{c.label}</span>
                  </span>
                  <span className="mt-auto flex gap-1">
                    {active.map((cab) => {
                      const st = c.taken.get(cab.id);
                      const cls = c.d.blockReason ? "bg-[#CFC9BD]" : st ? (HELD.includes(st) ? "bg-amber" : "bg-lake") : "border-[1.5px] border-[#9AA4A1]";
                      return <span key={cab.id} className={`h-1.5 w-full rounded-[3px] ${cls}`} />;
                    })}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section id="new" aria-label="Selected date" className="card flex min-w-0 max-w-full flex-[1_1_380px] flex-col xl:max-w-[460px]">
          <div className="border-b border-hair p-5 pb-4">
            <div className="eyebrow">{open && canCreate ? "New booking for" : "Selected date"}</div>
            <h2 className="mb-2 mt-0.5 font-display text-2xl font-semibold">{WEEKDAY[weekday(day)]}, {Number(day.slice(8))} {MONTHS[Number(day.slice(5, 7)) - 1]}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-lake-soft px-2.5 py-1 text-xs font-semibold text-lake-dark">
                {DT_LABEL[dt]} · {effectiveMode === "SHARED" ? `${tk(rateFor(cfg, day, "SHARED"))} per guest` : `${tk(rateFor(cfg, day, "FULL_BOAT"))} boat`}
              </span>
              {sel.d.holiday && <span className="rounded-full bg-rose-soft px-2.5 py-1 text-xs font-semibold text-rose-ink">{sel.d.holiday}</span>}
              {canManage && !sel.past && (
                <button type="button" onClick={() => setBlockOpen((v) => !v)} className="ml-auto h-7 rounded-full border border-field bg-white px-2.5 text-xs font-semibold text-ink-2">
                  {sel.d.blockReason ? "Unblock date" : "Block date"}
                </button>
              )}
            </div>
            {blockOpen && (
              <form action={blockDateAction} className="mt-3 flex flex-col gap-2 rounded-xl bg-sand p-3">
                <input type="hidden" name="date" value={day} />
                {sel.d.blockReason ? (
                  <>
                    <p className="text-sm">Blocked because: <strong>{sel.d.blockReason}</strong></p>
                    <button name="unblock" value="1" className="btn btn-sm self-start">Unblock this date</button>
                  </>
                ) : (
                  <>
                    <label className="label">Reason (maintenance, weather, private use…)<input name="reason" required className="input" /></label>
                    {sel.d.bookings.length > 0 && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" />Block anyway. {sel.d.bookings.length} booking(s) on this date stay as they are.</label>}
                    <button className="btn btn-sm self-start">Block date</button>
                  </>
                )}
              </form>
            )}
            {sel.d.bookings.map((b) => (
              <a key={b.id} href={`/admin/bookings/${b.id}`} className="mt-3 flex items-center gap-2.5 rounded-[10px] bg-sand px-3 py-2.5 text-ink no-underline hover:text-ink">
                <span className="text-[13px] font-semibold">{b.reference}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{b.lead} · {b.type === "FULL_BOAT" ? "Full boat" : `${b.cabinIds.length} cabins`}, {b.guests} guests</span>
                <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[b.status]?.[1] ?? "bg-sand-2"}`}>{STATUS[b.status]?.[0] ?? b.status}</span>
              </a>
            ))}
          </div>

          {!open && (
            <div className="flex flex-col gap-2 p-5">
              <div className="text-base font-semibold">
                {sel.past ? "This date has passed" : sel.d.blockReason ? `Blocked · ${sel.d.blockReason}` : "Fully booked"}
              </div>
              <p className="text-sm leading-[21px] text-ink-2">
                {sel.past ? "Pick today or a later date to start a booking."
                  : sel.d.blockReason ? "Nothing can be booked on this date. Unblock it if plans change."
                  : `Only ${sel.av.freeCabinIds.length} cabin is left, and a booking needs at least 2 cabins, so the date is closed.`}
              </p>
            </div>
          )}

          {open && !canCreate && <p className="p-5 text-sm text-ink-2">You can view availability. Ask a manager to create bookings.</p>}

          {open && canCreate && (
            <form action={createBookingAction} className="flex flex-col gap-[18px] p-5">
              <input type="hidden" name="payload" value={payload} />
              <div role="radiogroup" aria-label="Package" className="grid grid-cols-2 gap-2">
                {(["SHARED", "FULL_BOAT"] as const).map((k) => {
                  const enabled = k === "SHARED" ? sel.av.canBookShared : sel.av.canBookFullBoat;
                  const on = effectiveMode === k;
                  return (
                    <button key={k} type="button" role="radio" aria-checked={on} disabled={!enabled} onClick={() => setMode(k)}
                      className={`flex flex-col items-start gap-0.5 rounded-[10px] px-3 py-2.5 text-left text-ink disabled:cursor-not-allowed disabled:opacity-55 ${on ? "border-2 border-lake bg-lake-faint" : "border border-field bg-white"}`}>
                      <span className="text-sm font-semibold">{k === "SHARED" ? "Shared cabins" : "Full boat"}</span>
                      <span className="text-xs text-ink-muted">
                        {k === "SHARED" ? (enabled ? `${sel.av.freeCabinIds.length} cabins free` : "Not available") : enabled ? `${tk(rateFor(cfg, day, "FULL_BOAT"))} + food` : "Cabins already sold"}
                      </span>
                    </button>
                  );
                })}
              </div>

              {isShared && (
                <div className="flex flex-col gap-2">
                  <div className="text-[13px] font-semibold text-ink-2">Cabins · pick 2 or more</div>
                  <div className="grid grid-cols-2 gap-2">
                    {active.map((c) => {
                      const b = sel.d.bookings.find((x) => x.cabinIds.includes(c.id));
                      const on = picked.includes(c.id);
                      return (
                        <button key={c.id} type="button" disabled={!!b} aria-pressed={on}
                          onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                          className={`flex flex-col gap-0.5 rounded-[10px] px-3 py-2.5 text-left text-ink ${b ? "cursor-not-allowed border border-dashed border-[#CFC9BD] bg-sand" : on ? "border-2 border-lake bg-lake-faint" : "border border-field bg-white"}`}>
                          <span className="flex items-center justify-between">
                            <span className="text-sm font-semibold">{c.name}</span>
                            <span className={`flex h-5 w-5 items-center justify-center rounded-md ${on ? "bg-lake text-white" : "border-[1.5px] border-[#B7BFBC]"}`}>{on && <Icon name="check" size={12} />}</span>
                          </span>
                          <span className="text-xs text-ink-muted">{c.type} · sleeps {c.capacity}{c.surcharge ? ` · +${tk(c.surcharge)}` : ""}</span>
                          <span className={`text-xs font-medium ${b ? "text-amber-ink" : on ? "text-lake-dark" : "text-leaf-ink"}`}>
                            {b ? `Booked · ${b.lead}` : on ? `Selected · ${perCabin[c.id] ?? 0} guests` : "Free"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                <div className="text-[13px] font-semibold text-ink-2">Guests</div>
                {bands.map((b) => (
                  <Stepper key={b.name} label={b.name} hint={b.pctOfAdult === 100 ? "Full price" : b.pctOfAdult === 0 ? "Free" : `${b.pctOfAdult}% of the price`}
                    value={counts[b.name] ?? 0} onDec={() => step(b.name, -1, "g")} onInc={() => step(b.name, 1, "g")} />
                ))}
                {!isShared && (
                  <>
                    <div className="mt-1 text-[13px] font-semibold text-ink-2">Food packages · {tk(rateFor(cfg, day, "FULL_BOAT_FOOD"))} per guest</div>
                    {bands.map((b) => (
                      <Stepper key={b.name} label={`${b.name} meals`} hint={b.pctOfAdult === 100 ? "" : b.pctOfAdult === 0 ? "Free" : `${b.pctOfAdult}%`}
                        value={food[b.name] ?? 0} onDec={() => step(b.name, -1, "f")} onInc={() => step(b.name, 1, "f")} />
                    ))}
                  </>
                )}
              </div>

              <div className="flex flex-col gap-2 rounded-xl bg-sand px-4 py-3.5">
                {quote?.lines.filter((l) => l.kind !== "DISCOUNT").map((l, k) => (
                  <div key={k} className="flex justify-between gap-3 text-sm text-ink-2"><span>{l.qty} × {l.description.replace(/^Shared package, |^Food package, /, "")}{l.kind === "FOOD" ? " meals" : ""} · {tk(l.unitPrice)}</span><span className="tabnum">{tk(l.total)}</span></div>
                ))}
                {quote?.lines.filter((l) => l.kind === "DISCOUNT").map((l, k) => (
                  <div key={`d${k}`} className="flex justify-between gap-3 text-sm text-rose-ink"><span>{l.description}</span><span className="tabnum">− {tk(-l.total)}</span></div>
                ))}
                <div className="flex items-baseline justify-between border-t border-line pt-2">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="tabnum font-display text-2xl font-semibold">{tk(total)}</span>
                </div>
                <div className="text-xs text-ink-muted">Advance {cfg.settings.advancePct}% now: {tk(advance.dueNow)}. Balance due {cfg.settings.balanceLeadHours} h before boarding.</div>
              </div>

              {canManage && (
                <div className="flex flex-col gap-2.5">
                  <button type="button" onClick={() => setAdjOpen((v) => !v)} aria-expanded={adjOpen} className="btn-ghost btn-sm self-start">
                    <Icon name="pencil" size={14} />{adjOpen ? "Hide price adjustment" : discount > 0 ? "Edit discount" : "Adjust price"}
                  </button>
                  {adjOpen && (
                    <div className="flex flex-col gap-2.5 rounded-xl border border-field p-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {[["Tk 2,000 off", 2000], ["5% off", Math.round(((quote?.total ?? 0) + discount) * 0.05)], ["10% off", Math.round(((quote?.total ?? 0) + discount) * 0.1)], ["Clear", 0]].map(([l, v]) => (
                          <button key={String(l)} type="button" onClick={() => setDiscount(Number(v))} className="h-8 rounded-full border border-field bg-sand px-3 text-[13px] font-medium">{l}</button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <label className="label">Discount (Tk)<input className="input" inputMode="numeric" value={discount || ""} placeholder="0"
                          onChange={(e) => setDiscount(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)} /></label>
                        <label className="label">Reason<select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r}>{r}</option>)}</select></label>
                      </div>
                      <p className="text-xs text-ink-muted">The reason prints on the invoice and is logged with your name. To change a whole day&apos;s price, add a special price in Settings.</p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="label col-span-2">Lead guest name<input name="name" required className="input h-[42px]" placeholder="Full name as on NID" /></label>
                <label className="label">Mobile<input name="mobile" required inputMode="tel" className="input h-[42px]" placeholder="01XXXXXXXXX" /></label>
                <label className="label">NID number<input name="nid" required inputMode="numeric" className="input h-[42px]" placeholder="10, 13 or 17 digits" /></label>
                <label className="label">Source<select name="source" className="input h-[42px]"><option value="PHONE">Phone</option><option value="FACEBOOK">Facebook</option><option value="WALK_IN">Walk-in</option><option value="OTHER">Other</option></select></label>
                <label className="label">Payment<select name="paymentOption" className="input h-[42px]"><option value="ADVANCE">Advance {cfg.settings.advancePct}%</option><option value="FULL">Full payment</option></select></label>
                <label className="label">Email (optional)<input name="email" type="email" className="input h-[42px]" /></label>
                <label className="label">Notes (optional)<input name="notes" className="input h-[42px]" placeholder="Dietary needs, occasion…" /></label>
              </div>

              <div role="status" className={`rounded-[10px] px-3 py-2.5 text-[13px] leading-[19px] ${problem ? "bg-amber-soft text-amber-ink" : "bg-lake-soft text-lake-dark"}`}>
                {problem || sel.windowError || (approve && canManage ? "Creates the booking and sends the invoice. The guest then has 24 hours to pay." : `Holds the cabins for ${cfg.settings.approvalWindowHours} hours while it waits for approval.`)}
              </div>

              {canManage && (
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={approve} onChange={(e) => setApprove(e.target.checked)} className="h-[18px] w-[18px] accent-lake" />Approve now and issue the invoice</label>
              )}
              <button disabled={!!problem} className="btn h-11">{approve && canManage ? "Create & approve" : "Create & hold"}</button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

function Stepper({ label, hint, value, onDec, onInc }: { label: string; hint: string; value: number; onDec: () => void; onInc: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-ink-muted">{hint}</div>}
      </div>
      <button type="button" onClick={onDec} aria-label={`Fewer ${label.toLowerCase()}`} className="h-9 w-9 rounded-lg border border-field bg-white text-lg leading-none hover:bg-ground">−</button>
      <span className="w-7 text-center text-base font-semibold">{value}</span>
      <button type="button" onClick={onInc} aria-label={`More ${label.toLowerCase()}`} className="h-9 w-9 rounded-lg border border-field bg-white text-lg leading-none hover:bg-ground">+</button>
    </div>
  );
}
