import { dayTypeOf, quoteFullBoat, quoteShared, toDhakaDate } from "@/domain";
import { Banner, Card, Chip, Empty } from "@/components/ui";
import { DAYTYPE_LABEL, fmtDate, tk } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { iso, loadPricingConfig } from "@/server/config";
import { prisma } from "@/server/db";
import { holidayAction, overrideAction, saveRatesAction } from "../../../_actions/settings";

const PKG = [["SHARED", "Shared", "per guest, food included"], ["FULL_BOAT", "Full boat", "per trip, no food"], ["FULL_BOAT_FOOD", "Food package", "per guest, full boat only"]] as const;
const DAYS = ["SUN_WED", "THU_SAT", "FRIDAY", "HOLIDAY"] as const;

export default async function RatesPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; qd?: string; qa?: string; qc?: string }> }) {
  await requireUser("ADMIN_SETTINGS");
  const sp = await searchParams;
  const today = toDhakaDate(new Date());
  const [cfg, holidays, overrides, bands, history] = await Promise.all([
    loadPricingConfig(prisma),
    prisma.holiday.findMany({ where: { date: { gte: new Date(`${today.slice(0, 4)}-01-01T00:00:00Z`) } }, orderBy: { date: "asc" } }),
    prisma.dateRateOverride.findMany({ where: { tripDate: { gte: new Date(`${today}T00:00:00Z`) } }, orderBy: { tripDate: "asc" } }),
    prisma.ageBand.findMany({ orderBy: { minAge: "desc" } }),
    prisma.rateRule.groupBy({ by: ["effectiveFrom"], orderBy: { effectiveFrom: "desc" }, take: 5 }),
  ]);
  const future = await prisma.rateRule.findMany({ where: { effectiveFrom: { gt: new Date() } }, orderBy: { effectiveFrom: "asc" } });

  // "Check a quote" uses the rates in force on that date.
  const qd = /^\d{4}-\d{2}-\d{2}$/.test(sp.qd ?? "") ? sp.qd! : today;
  const qa = Math.max(1, Number(sp.qa) || 6);
  const qc = Math.max(0, Number(sp.qc) || 0);
  const qcfg = await loadPricingConfig(prisma, new Date(`${qd}T00:00:00Z`));
  const adult = bands.find((b) => b.isAdult)?.name ?? "Adult";
  const child = bands.find((b) => !b.isAdult && b.pctOfAdult > 0)?.name;
  const guests = [{ band: adult, count: qa }, ...(child ? [{ band: child, count: qc }] : [])];
  const shared = quoteShared(qcfg, { date: qd, cabins: [], guests });
  const full = quoteFullBoat(qcfg, { date: qd, foodGuests: guests });
  const qHoliday = holidays.find((h) => iso(h.date) === qd);

  return (
    <div className="flex flex-col gap-5">
      <Banner tone="ok">{sp.ok}</Banner>
      <Banner>{sp.error}</Banner>
      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
          <Card title="Rates">
            <form action={saveRatesAction} className="flex flex-col gap-3.5">
              <div className="flex flex-wrap items-end gap-3">
                <p className="min-w-[240px] flex-1 text-[13px] text-ink-muted">New prices apply to new quotes from the date you pick. Issued invoices keep their price.</p>
                <label className="label text-xs font-semibold text-ink-muted">Effective from<input type="date" name="effectiveFrom" required defaultValue={today} className="input" /></label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <thead><tr className="text-left text-xs text-ink-muted">
                    <th className="py-2 pr-2 font-semibold">Package</th>
                    {DAYS.map((d) => <th key={d} className="p-2 text-right font-semibold">{DAYTYPE_LABEL[d]}</th>)}
                  </tr></thead>
                  <tbody>
                    {PKG.map(([k, label, hint]) => (
                      <tr key={k}>
                        <td className="border-t border-hair py-1.5 pr-2"><div className="font-semibold">{label}</div><div className="text-xs text-ink-muted">{hint}</div></td>
                        {DAYS.map((d) => (
                          <td key={d} className="border-t border-hair p-1.5">
                            <input name={`${k}_${d}`} inputMode="numeric" defaultValue={cfg.rates[k][d]} aria-label={`${label}, ${DAYTYPE_LABEL[d]}`} className="input tabnum text-right" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {bands.map((b) => (
                  <div key={b.id} className="rounded-[10px] bg-sand px-3.5 py-3">
                    <div className="text-[13px] font-semibold">{b.name} · {b.minAge}–{b.maxAge >= 100 ? "+" : b.maxAge}</div>
                    <div className="text-[13px] text-ink-2">{b.pctOfAdult === 0 ? "Free" : `${b.pctOfAdult}% of rate`}</div>
                  </div>
                ))}
              </div>
              {future.length > 0 && <Banner tone="info">Rates from {fmtDate(future[0].effectiveFrom)} are already saved and start on that date.</Banner>}
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-ink-muted">Saved versions: {history.map((h) => fmtDate(h.effectiveFrom)).join(", ")}</span>
                <button className="btn">Save new rates</button>
              </div>
            </form>
          </Card>

          <Card title="Government holidays" className="scroll-mt-4" action={<span className="text-[13px] text-ink-muted">Holiday rate applies (same as Friday by default)</span>}>
            <div id="holidays" />
            {holidays.length === 0 && <Empty>No holidays saved for this year.</Empty>}
            {holidays.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center gap-3 border-t border-hair py-2.5 text-sm">
                <span className="w-[120px] font-semibold">{fmtDate(h.date)}</span>
                <span className="min-w-[180px] flex-1">{h.name}</span>
                <Chip tone={h.source === "gazette" ? "leaf" : "amber"}>{h.source === "gazette" ? "Gazette" : "Expected"}</Chip>
                <form action={holidayAction}><input type="hidden" name="remove" value={iso(h.date)} /><button className="text-[13px] font-medium text-rose-ink underline">Remove</button></form>
              </div>
            ))}
            <form action={holidayAction} className="mt-3 flex flex-wrap items-end gap-2 border-t border-hair pt-3">
              <label className="label">Date<input type="date" name="date" required className="input" /></label>
              <label className="label min-w-[200px] flex-1">Name<input name="name" required className="input" placeholder="e.g. Eid ul-Fitr" /></label>
              <label className="label">Source<select name="source" className="input"><option value="expected">Expected</option><option value="gazette">Gazette</option></select></label>
              <button className="btn-ghost">Add holiday</button>
            </form>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-lake">Import the gazette list</summary>
              <form action={holidayAction} className="mt-2 flex flex-col gap-2">
                <input type="hidden" name="source" value="gazette" />
                <textarea name="bulk" required className="input min-h-[120px] py-2 font-mono text-[13px]" placeholder={"One per line:\n2027-03-26 Independence Day\n2027-04-14 Pohela Boishakh"} />
                <button className="btn-ghost self-start">Import</button>
              </form>
            </details>
          </Card>

          <Card title="Special prices for a date" action={<span className="text-[13px] text-ink-muted">Beats the day-type rate (e.g. Eid peak)</span>}>
            <div id="overrides" />
            {overrides.length === 0 && <Empty>No special prices coming up.</Empty>}
            {overrides.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center gap-3 border-t border-hair py-2.5 text-sm">
                <span className="w-[120px] font-semibold">{fmtDate(o.tripDate)}</span>
                <span className="min-w-[180px] flex-1">{PKG.find((p) => p[0] === o.packageType)?.[1]}</span>
                <span className="tabnum font-semibold">{tk(o.amount)}</span>
                <form action={overrideAction}><input type="hidden" name="remove" value={o.id} /><button className="text-[13px] font-medium text-rose-ink underline">Remove</button></form>
              </div>
            ))}
            <form action={overrideAction} className="mt-3 flex flex-wrap items-end gap-2 border-t border-hair pt-3">
              <label className="label">Date<input type="date" name="date" required className="input" /></label>
              <label className="label">Package<select name="packageType" className="input">{PKG.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
              <label className="label">Price (Tk)<input name="amount" required inputMode="numeric" className="input w-32" /></label>
              <button className="btn-ghost">Add special price</button>
            </form>
          </Card>
        </div>

        <Card title="Check a quote" className="min-w-0 flex-[1_1_300px]">
          <form className="flex flex-col gap-3">
            <p className="text-[13px] text-ink-muted">See what a guest pays on any date with the saved rates.</p>
            <label className="label text-xs font-semibold text-ink-muted">Trip date<input type="date" name="qd" defaultValue={qd} className="input" /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="label text-xs font-semibold text-ink-muted">Adults<input name="qa" inputMode="numeric" defaultValue={qa} className="input" /></label>
              <label className="label text-xs font-semibold text-ink-muted">Children<input name="qc" inputMode="numeric" defaultValue={qc} className="input" /></label>
            </div>
            <button className="btn-ghost">Check</button>
          </form>
          <div className="mt-3 flex flex-col gap-1.5 rounded-[10px] bg-sand px-3.5 py-3 text-[13px] text-ink-2">
            <div className="font-semibold text-ink">{fmtDate(qd)} · {DAYTYPE_LABEL[dayTypeOf(qd, qcfg.holidays)]}{qHoliday ? ` · ${qHoliday.name}` : ""}</div>
            {shared.lines.map((l, i) => <div key={i} className="flex justify-between"><span>{l.qty} × {l.description.replace("Shared package, ", "")} · {tk(l.unitPrice)}</span><span>{tk(l.total)}</span></div>)}
            <div className="flex justify-between border-t border-line pt-1.5 text-[15px] font-semibold text-ink"><span>Shared total</span><span>{tk(shared.total)}</span></div>
            <div className="flex justify-between"><span>Full boat + food for {qa + qc}</span><span>{tk(full.total)}</span></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
