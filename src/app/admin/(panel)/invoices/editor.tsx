"use client";

import { useState } from "react";
import { Icon } from "@/components/ui";

type Kind = "PACKAGE" | "FOOD" | "SURCHARGE" | "DISCOUNT";
interface Line { kind: Kind; description: string; qty: number; unitPrice: number }

interface Props {
  action: (f: FormData) => void | Promise<void>;
  back: string;
  isFullBoat: boolean;
  lines: Line[];
  paymentOption: "FULL" | "ADVANCE";
  advancePct: number;
  foodRate: number;
  dueNowAt: string;
  balanceAt: string;
  prevTotal: number;
  paid: number;
  revision: number;
}

const tk = (n: number) => `Tk ${Math.round(n).toLocaleString("en-US")}`;
const REASONS = ["Corporate rate", "Repeat guest", "Promotion", "Service recovery", "Long-time partner", "Other"];

export function InvoiceEditor(p: Props) {
  const [lines, setLines] = useState<Line[]>(p.lines);
  const [option, setOption] = useState(p.paymentOption);
  const set = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const remove = (i: number) => setLines((ls) => ls.filter((_, j) => j !== i));
  const add = (l: Line) => setLines((ls) => [...ls, l]);
  const total = lines.reduce((n, l) => n + (l.kind === "DISCOUNT" ? -1 : 1) * l.qty * l.unitPrice, 0);
  const dueNow = option === "FULL" ? total : Math.round((total * p.advancePct) / 100);
  const changed = JSON.stringify(lines) !== JSON.stringify(p.lines) || option !== p.paymentOption;
  const badDiscount = lines.some((l) => l.kind === "DISCOUNT" && !l.description.replace(/^discount:?/i, "").trim());

  return (
    <form action={p.action} className="flex flex-col gap-3.5 p-5">
      <input type="hidden" name="back" value={p.back} />
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <input type="hidden" name="paymentOption" value={option} />

      <div className="hidden grid-cols-[minmax(0,3fr)_72px_120px_110px_40px] gap-2 text-xs font-semibold text-ink-muted sm:grid">
        <span>Item</span><span className="text-right">Qty</span><span className="text-right">Unit price</span><span className="text-right">Amount</span><span />
      </div>
      {lines.map((l, i) => {
        const amount = (l.kind === "DISCOUNT" ? -1 : 1) * l.qty * l.unitPrice;
        return (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_72px_110px_40px] items-center gap-2 sm:grid-cols-[minmax(0,3fr)_72px_120px_110px_40px]">
            {l.kind === "DISCOUNT" ? (
              <select aria-label="Discount reason" value={l.description.replace(/^Discount:\s*/i, "")} onChange={(e) => set(i, { description: `Discount: ${e.target.value}` })} className="input border-rose-ink/40">
                {[...new Set([l.description.replace(/^Discount:\s*/i, ""), ...REASONS])].filter(Boolean).map((r) => <option key={r}>{r}</option>)}
              </select>
            ) : (
              <input aria-label="Item" value={l.description} onChange={(e) => set(i, { description: e.target.value })} className="input" />
            )}
            <input aria-label="Quantity" inputMode="numeric" value={l.qty} onChange={(e) => set(i, { qty: Number(e.target.value.replace(/\D/g, "")) || 0 })} className="input text-right" />
            <input aria-label="Unit price" inputMode="numeric" value={l.unitPrice} onChange={(e) => set(i, { unitPrice: Number(e.target.value.replace(/\D/g, "")) || 0 })} className="input text-right" />
            <span className={`tabnum hidden text-right text-sm font-semibold sm:block ${amount < 0 ? "text-rose-ink" : ""}`}>{amount < 0 ? `− ${tk(-amount)}` : tk(amount)}</span>
            <button type="button" onClick={() => remove(i)} aria-label="Remove line" className="h-9 w-9 rounded-lg border border-line bg-white text-ink-muted hover:text-rose-ink"><Icon name="x" size={14} className="mx-auto" /></button>
          </div>
        );
      })}

      <div className="flex flex-wrap gap-2">
        {p.isFullBoat && <button type="button" className="btn-ghost btn-sm" onClick={() => add({ kind: "FOOD", description: "Food package, Adult", qty: 1, unitPrice: p.foodRate })}>+ Food package</button>}
        <button type="button" className="btn-ghost btn-sm" onClick={() => add({ kind: "SURCHARGE", description: "Extra charge", qty: 1, unitPrice: 0 })}>+ Extra charge</button>
        <button type="button" className="btn-ghost btn-sm" onClick={() => add({ kind: "DISCOUNT", description: `Discount: ${REASONS[0]}`, qty: 1, unitPrice: 0 })}>+ Discount</button>
      </div>
      <p className="text-xs text-ink-muted">A discount needs a reason; it prints on the invoice and is logged with your name.</p>

      <div className="flex flex-wrap gap-4 border-t border-hair pt-3.5">
        <div className="flex min-w-[240px] flex-1 flex-col gap-2">
          <div className="text-[13px] font-semibold text-ink-2">Payment terms</div>
          <div role="radiogroup" aria-label="Payment option" className="flex gap-2">
            {(["ADVANCE", "FULL"] as const).map((o) => (
              <label key={o} className={`flex flex-1 items-center gap-2 rounded-[10px] px-3 py-2.5 text-sm ${option === o ? "border-2 border-lake bg-lake-faint font-semibold" : "border border-field font-medium"}`}>
                <input type="radio" name="opt" checked={option === o} onChange={() => setOption(o)} className="accent-lake" />
                {o === "ADVANCE" ? `Advance ${p.advancePct}%` : "Full payment"}
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="label text-xs font-semibold text-ink-muted">Due now by<input type="datetime-local" name="dueNowAt" defaultValue={p.dueNowAt} className="input" /></label>
            <label className="label text-xs font-semibold text-ink-muted">Balance by<input type="datetime-local" name="balanceAt" defaultValue={p.balanceAt} disabled={option === "FULL"} className="input disabled:opacity-50" /></label>
          </div>
          <label className="label text-xs font-semibold text-ink-muted">Note for the history (optional)<input name="note" className="input" placeholder="e.g. agreed with guest by phone" /></label>
        </div>
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5 rounded-xl bg-ink px-4 py-3.5 text-white">
          {changed && <div className="flex justify-between text-[13px] text-[#C9D3D0]"><span>Was (revision {p.revision})</span><span className="line-through">{tk(p.prevTotal)}</span></div>}
          <div className="flex items-baseline justify-between"><span className="text-sm font-semibold">{changed ? "New total" : "Total"}</span><span className="font-display text-[26px] font-semibold">{tk(total)}</span></div>
          <div className="flex justify-between text-[13px] text-[#E3E8E6]"><span>{option === "FULL" ? "Due now" : "Advance due now"}</span><span>{tk(dueNow)}</span></div>
          {option === "ADVANCE" && <div className="flex justify-between text-[13px] text-[#E3E8E6]"><span>Balance</span><span>{tk(total - dueNow)}</span></div>}
          <div className="flex justify-between text-[13px] text-[#E3E8E6]"><span>Already paid</span><span>{tk(p.paid)}</span></div>
        </div>
      </div>

      {total < 0 && <p role="alert" className="rounded-[10px] bg-rose-soft px-3 py-2 text-sm text-rose-ink">Discounts cannot be more than the total.</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" disabled={!changed} onClick={() => { setLines(p.lines); setOption(p.paymentOption); }} className="btn-ghost">Undo changes</button>
        <button disabled={total < 0 || badDiscount || lines.length === 0} className="btn">{changed ? `Issue revision ${p.revision + 1}` : "Re-issue with new deadlines"}</button>
      </div>
    </form>
  );
}
