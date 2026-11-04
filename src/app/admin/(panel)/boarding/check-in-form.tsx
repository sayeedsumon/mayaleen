"use client";

import { useState } from "react";

interface Props {
  action: (f: FormData) => void | Promise<void>;
  back: string;
  paid: string;
  adultsBooked: number;
  cabins: string[];
  lead: { name: string; nid: string };
  emergency: string;
}

/** NID: 10, 13 or 17 digits. A foreign guest's passport (letters and digits) is accepted in the same box. */
function idOk(v: string) {
  const s = v.replace(/[\s-]/g, "");
  return /^(\d{10}|\d{13}|\d{17})$/.test(s) || /^[A-Za-z]{1,3}\d{6,9}$/.test(s);
}

export function CheckInForm({ action, back, paid, adultsBooked, cabins, lead, emergency }: Props) {
  const initial = Math.max(1, adultsBooked);
  const [count, setCount] = useState(initial);
  const [rows, setRows] = useState(() =>
    Array.from({ length: initial }, (_, i) => ({
      name: i === 0 ? lead.name : "", nid: i === 0 ? lead.nid : "",
      cabin: cabins[Math.min(cabins.length - 1, Math.floor((i * cabins.length) / initial))] ?? "",
    })),
  );
  const resize = (n: number) => {
    const next = Math.max(1, n);
    setCount(next);
    setRows((r) => (next > r.length ? [...r, ...Array.from({ length: next - r.length }, () => ({ name: "", nid: "", cabin: cabins.at(-1) ?? "" }))] : r.slice(0, next)));
  };
  const set = (i: number, k: "name" | "nid" | "cabin", v: string) => setRows((r) => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const missing = rows.filter((r) => !r.name.trim() || !idOk(r.nid)).length;
  const more = count > adultsBooked;

  return (
    <form action={action} className="flex flex-col gap-[18px] p-5">
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="count" value={count} />
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <li className="rounded-[10px] bg-leaf-soft px-3 py-2.5 text-[13px] font-semibold text-leaf-ink">1 · Paid in full<br /><span className="font-medium">{paid} verified</span></li>
        <li className={`rounded-[10px] px-3 py-2.5 text-[13px] font-semibold ${more ? "bg-amber-soft text-amber-ink" : "bg-leaf-soft text-leaf-ink"}`}>2 · Adults arrived<br /><span className="font-medium">{count} of {adultsBooked} booked</span></li>
        <li className={`rounded-[10px] px-3 py-2.5 text-[13px] font-semibold ${missing ? "bg-amber-soft text-amber-ink" : "bg-leaf-soft text-leaf-ink"}`}>3 · Adult NIDs<br /><span className="font-medium">{missing ? `${missing} still missing` : "All recorded"}</span></li>
      </ol>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-sm font-semibold">Adults who actually came</div>
          <div className="text-xs text-ink-muted">More than booked? Change the booking first so the bill is right.</div>
        </div>
        <button type="button" onClick={() => resize(count - 1)} aria-label="Fewer adults" className="h-9 w-9 rounded-lg border border-field bg-white text-lg">−</button>
        <span className="w-7 text-center text-base font-semibold">{count}</span>
        <button type="button" onClick={() => resize(count + 1)} aria-label="More adults" className="h-9 w-9 rounded-lg border border-field bg-white text-lg">+</button>
      </div>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-[28px_minmax(0,2fr)_minmax(0,2fr)_110px] gap-2 text-xs font-semibold text-ink-muted">
          <span /><span>Full name</span><span>NID number</span><span>Cabin</span>
        </div>
        {rows.map((r, i) => {
          const ok = idOk(r.nid);
          return (
            <div key={i} className="grid grid-cols-[28px_minmax(0,2fr)_minmax(0,2fr)_110px] items-center gap-2">
              <span className={`flex h-[26px] w-[26px] items-center justify-center rounded-full text-xs font-semibold ${ok && r.name ? "bg-lake text-white" : "bg-sand-3 text-ink-2"}`}>{i + 1}</span>
              <input name={`name${i}`} value={r.name} onChange={(e) => set(i, "name", e.target.value)} required aria-label={`Adult ${i + 1} name`} placeholder="Name as on NID" className="input" />
              <input name={`nid${i}`} value={r.nid} onChange={(e) => set(i, "nid", e.target.value)} required aria-label={`Adult ${i + 1} NID number`} inputMode="numeric"
                placeholder="10, 13 or 17 digits" aria-invalid={!!r.nid && !ok}
                className={`input ${!r.nid ? "border-[#D9A548] bg-[#FFFDF8]" : !ok ? "border-rose-ink" : ""}`} />
              <select name={`cabin${i}`} value={r.cabin} onChange={(e) => set(i, "cabin", e.target.value)} aria-label={`Adult ${i + 1} cabin`} className="input">
                {cabins.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          );
        })}
        <p className="text-xs text-ink-muted">Only the number is saved, encrypted. Foreign guest? Type the passport number in the same box.</p>
      </div>

      <label className="label">Emergency contact<input name="emergency" defaultValue={emergency} placeholder="Name · mobile" className="input" /></label>

      <div role="status" className={`rounded-[10px] px-3 py-2.5 text-[13px] ${missing ? "bg-amber-soft text-amber-ink" : "bg-lake-soft text-lake-dark"}`}>
        {missing ? "Enter a name and a valid NID number for every adult to finish check-in." : "Everything is recorded. Completing check-in updates the manifest."}
      </div>
      <button disabled={missing > 0} className="btn h-[46px] text-[15px]">
        {missing ? `Complete check-in · ${missing} missing` : "Complete check-in"}
      </button>
    </form>
  );
}
