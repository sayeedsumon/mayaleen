"use client";

import { useState } from "react";

type Col = { id: string; label: string; long?: boolean };
type Row = Record<string, string>;

/** Rows of a list (FAQ, reviews, itinerary…) with English and Bangla side by side. */
export function ListEditor({ name, label, help, cols, en, bn }: { name: string; label: string; help?: string; cols: Col[]; en: Row[]; bn: Row[] }) {
  const blank = () => Object.fromEntries(cols.map((c) => [c.id, ""]));
  const [rows, setRows] = useState(() => en.map((r, i) => ({ en: r, bn: bn[i] ?? blank() })));

  const set = (i: number, lang: "en" | "bn", col: string, v: string) =>
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, [lang]: { ...r[lang], [col]: v } } : r)));
  const move = (i: number, d: -1 | 1) =>
    setRows((rs) => {
      const j = i + d;
      if (j < 0 || j >= rs.length) return rs;
      const out = [...rs];
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });

  const input = (i: number, lang: "en" | "bn", c: Col) => {
    const common = {
      value: rows[i][lang][c.id] ?? "",
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(i, lang, c.id, e.target.value),
      "aria-label": `${c.label} (${lang === "en" ? "English" : "Bangla"}), row ${i + 1}`,
      lang,
      className: `input ${lang === "bn" ? "font-bn" : ""} ${c.long ? "min-h-[72px] py-2" : ""}`,
    };
    return c.long ? <textarea {...common} /> : <input {...common} />;
  };

  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border border-line p-4">
      <legend className="px-1 text-sm font-semibold text-ink">{label}</legend>
      {help && <p className="-mt-1 text-xs text-ink-muted">{help}</p>}
      <input type="hidden" name={`${name}_en`} value={JSON.stringify(rows.map((r) => r.en))} />
      <input type="hidden" name={`${name}_bn`} value={JSON.stringify(rows.map((r) => r.bn))} />
      {rows.length === 0 && <p className="text-sm text-ink-muted">Nothing yet. This part is hidden on the website until you add a row.</p>}
      <ol className="flex flex-col gap-3">
        {rows.map((_, i) => (
          <li key={i} className="rounded-lg bg-sand p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <span className="mr-auto text-xs font-semibold text-ink-muted">#{i + 1}</span>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move row ${i + 1} up`} className="btn-ghost btn-sm px-2.5 disabled:opacity-40">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={`Move row ${i + 1} down`} className="btn-ghost btn-sm px-2.5 disabled:opacity-40">↓</button>
              <button type="button" onClick={() => setRows((rs) => rs.filter((__, k) => k !== i))} className="btn-danger btn-sm">Remove</button>
            </div>
            <div className="grid grid-cols-1 gap-x-3 gap-y-2 md:grid-cols-2">
              {cols.map((c) => (
                <div key={c.id} className="contents">
                  <label className="label">{c.label} · English{input(i, "en", c)}</label>
                  <label className="label">{c.label} · বাংলা{input(i, "bn", c)}</label>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => setRows((rs) => [...rs, { en: blank(), bn: blank() }])} className="btn-ghost self-start">+ Add a row</button>
    </fieldset>
  );
}
