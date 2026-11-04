"use client";

import { useState } from "react";

export type TLCell =
  | { date: string; kind: "free" | "past" | "blocked" }
  | { date: string; kind: "booked"; bookingId: string; held: boolean; label: string; ref: string };

interface Row { id: string; name: string; type: string; capacity: number; cells: TLCell[] }
interface DateCol { date: string; wd: string; n: number; price: string; blocked: boolean }

export function TimelineGrid({ today, dates, rows }: { today: string; dates: DateCol[]; rows: Row[] }) {
  const [sel, setSel] = useState<{ date: string; cabins: string[] } | null>(null);
  const toggle = (date: string, cabin: string) =>
    setSel((s) => {
      if (!s || s.date !== date) return { date, cabins: [cabin] };
      const cabins = s.cabins.includes(cabin) ? s.cabins.filter((c) => c !== cabin) : [...s.cabins, cabin];
      return cabins.length ? { date, cabins } : null;
    });
  const picked = sel ? rows.filter((r) => sel.cabins.includes(r.id)) : [];
  const cap = picked.reduce((n, r) => n + r.capacity, 0);
  const selDate = sel ? new Date(`${sel.date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) : "";

  return (
    <>
      <section aria-label="Cabin timeline" className="card overflow-x-auto">
        <div className="grid min-w-[1040px]" style={{ gridTemplateColumns: `168px repeat(${dates.length}, minmax(0, 1fr))` }}>
          <div className="border-b border-line px-4 py-3.5 text-xs font-semibold text-ink-muted">Cabin</div>
          {dates.map((d) => (
            <div key={d.date} className={`border-b border-l border-line border-l-hair px-1.5 py-2.5 text-center ${d.date === today ? "bg-lake-faint shadow-[inset_0_3px_0_#0E5C56]" : ""}`}>
              <div className="text-[11px] font-semibold text-ink-muted">{d.wd}</div>
              <div className="text-[15px] font-semibold">{d.n}</div>
              <div className={`text-[11px] ${d.blocked ? "text-[#5B3A1E]" : "text-ink-muted"}`}>{d.blocked ? "Blocked" : d.price}</div>
            </div>
          ))}
          {rows.map((r) => (
            <div key={r.id} className="contents">
              <div className="flex min-h-[64px] flex-col justify-center border-b border-hair px-4 py-3">
                <div className="text-sm font-semibold">{r.name}</div>
                <div className="text-xs text-ink-muted">{r.type} · sleeps {r.capacity}</div>
              </div>
              {r.cells.map((c) => (
                <div key={c.date} className="border-b border-l border-hair px-1 py-1.5">
                  {c.kind === "booked" && (
                    <a href={`/admin/bookings/${c.bookingId}`} title={`${c.ref} · ${c.label}`}
                      className={`flex h-11 items-center overflow-hidden whitespace-nowrap rounded-lg px-2 text-xs font-semibold no-underline ${c.held ? "border border-amber-line bg-amber-soft text-amber-ink hover:text-amber-ink" : "bg-lake text-white hover:text-white"}`}>
                      {c.label}
                    </a>
                  )}
                  {c.kind === "free" && (() => {
                    const on = sel?.date === c.date && sel.cabins.includes(r.id);
                    return (
                      <button type="button" onClick={() => toggle(c.date, r.id)} aria-pressed={on} aria-label={`${on ? "Selected" : "Select"} ${r.name} on ${c.date}`}
                        className={`h-11 w-full rounded-lg text-base font-semibold ${on ? "border-2 border-lake bg-lake-soft text-lake-dark" : "border border-dashed border-field bg-white text-ink-muted hover:bg-lake-faint"}`}>
                        {on ? "✓" : ""}
                      </button>
                    );
                  })()}
                  {c.kind === "blocked" && <div className="h-11 rounded-lg" style={{ background: "repeating-linear-gradient(135deg, #EEEAE2 0 6px, #E4DFD4 6px 12px)" }} title="Blocked" />}
                  {c.kind === "past" && <div className="h-11 rounded-lg bg-sand" />}
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {sel && (
        <section aria-label="Selection" className="flex flex-wrap items-center gap-4 rounded-2xl bg-ink px-5 py-4 text-white">
          <div className="min-w-[300px] flex-1">
            <div className="text-[15px] font-semibold">{picked.map((p) => p.name).join(" + ")} · {selDate}</div>
            <div className="text-[13px] text-[#C9D3D0]">
              {picked.length < 2 ? "Pick one more cabin. Shared bookings need at least 2." : `Shared · up to ${cap} guests`}
            </div>
          </div>
          <button type="button" onClick={() => setSel(null)} className="h-[42px] rounded-[10px] border border-ink-muted px-4 text-sm font-medium text-white">Clear</button>
          <a href={`/admin/calendar?month=${sel.date.slice(0, 7)}&day=${sel.date}&cabins=${sel.cabins.join(",")}`}
            aria-disabled={picked.length < 2}
            className={`flex h-[42px] items-center rounded-[10px] px-[18px] text-sm font-semibold no-underline ${picked.length < 2 ? "pointer-events-none bg-[#5B6663] text-[#C9D3D0]" : "bg-white text-lake-dark hover:text-lake-dark"}`}>
            Book {picked.length} cabins
          </a>
        </section>
      )}
    </>
  );
}
