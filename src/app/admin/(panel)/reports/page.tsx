import { addMonths, toDhakaDate } from "@/domain";
import { Card, Empty, Icon, PageHeader, Stat } from "@/components/ui";
import { DAYTYPE_LABEL, fmtDate, fmtDateTime, SOURCE_LABEL, tk } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { reports } from "@/server/queries";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function Bars({ rows }: { rows: { label: string; value: number; text: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <div key={r.label} className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[13px]"><span>{r.label}</span><span className="tabnum font-semibold">{r.text}</span></div>
          <div className="h-2 rounded bg-hair"><div className="h-2 rounded bg-lake" style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  await requireUser("MANAGE_BOOKINGS");
  const sp = await searchParams;
  const today = toDhakaDate(new Date());
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : today.slice(0, 7);
  const r = await reports(month);
  const [y, m] = month.split("-").map(Number);
  const options = Array.from({ length: 18 }, (_, i) => addMonths(`${today.slice(0, 7)}-01`, 6 - i).slice(0, 7));
  const occ = r.capacity ? Math.round((r.cabinNights / r.capacity) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader eyebrow={`Trips in ${MONTHS[m - 1]} ${y}`} title="Reports">
        <form className="flex items-end gap-2">
          <label className="label text-xs font-semibold text-ink-muted">Month
            <select name="month" defaultValue={month} className="input">
              {options.map((o) => <option key={o} value={o}>{MONTHS[Number(o.slice(5)) - 1]} {o.slice(0, 4)}</option>)}
            </select>
          </label>
          <button className="btn-ghost">Show</button>
        </form>
        <a href={`/admin/bookings/export?when=all`} className="btn-ghost"><Icon name="download" size={16} />Export bookings</a>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Invoiced" value={tk(r.invoicedTotal)} note={`${r.invoicedCount} approved bookings`} />
        <Stat label="Collected" value={tk(r.collected)} note={r.invoicedTotal ? `${Math.round((r.collected / r.invoicedTotal) * 100)}% of invoiced` : "–"} />
        <Stat label="Outstanding" value={tk(r.outstanding)} note={`${r.unpaidCount} unpaid, ${r.balanceCount} balances due`} />
        <Stat label="Cabin occupancy" value={`${occ}%`} note={`${r.cabinNights} of ${r.capacity} cabin-nights · ${r.guests} guests`} />
      </div>

      <Card title="Cabins sold per night" action={
        <div className="flex gap-3.5 text-xs text-ink-2">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-lake" />Shared</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-lake-deep" />Full boat</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px] bg-[#E8C27E]" />Not yet approved</span>
        </div>
      }>
        <div role="img" aria-label={`Cabins sold per night in ${MONTHS[m - 1]}`} className="flex h-40 items-end gap-1 border-b border-line pb-1">
          {r.perNight.map((n) => {
            const total = n.confirmed + n.pending;
            return (
              <div key={n.date} className="flex h-full flex-1 flex-col justify-end" title={`${fmtDate(n.date)}: ${total} cabins`}>
                {n.pending > 0 && <div className="rounded-t bg-[#E8C27E]" style={{ height: `${(n.pending / Math.max(1, r.cabins)) * 100}%` }} />}
                {n.confirmed > 0 && <div className={`${n.pending ? "" : "rounded-t"} ${n.full ? "bg-lake-deep" : "bg-lake"}`} style={{ height: `${(n.confirmed / Math.max(1, r.cabins)) * 100}%` }} />}
                {total === 0 && <div className="h-0.5 rounded bg-hair" />}
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex gap-1 text-center text-[10px] text-ink-muted">
          {r.perNight.map((n, i) => <span key={n.date} className="flex-1">{i === 0 || (i + 1) % 5 === 0 ? Number(n.date.slice(8)) : ""}</span>)}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card title="Revenue by day type">
          <Bars rows={(["FRIDAY", "THU_SAT", "SUN_WED", "HOLIDAY"] as const).map((k) => ({ label: DAYTYPE_LABEL[k], value: r.byDayType[k], text: tk(r.byDayType[k]) }))} />
        </Card>
        <Card title="Revenue by package">
          <Bars rows={[{ label: "Shared cabins", value: r.byPackage.SHARED, text: tk(r.byPackage.SHARED) }, { label: "Full boat", value: r.byPackage.FULL_BOAT, text: tk(r.byPackage.FULL_BOAT) }]} />
        </Card>
        <Card title="Bookings by source">
          {r.sourceTotal === 0 ? <Empty>No bookings.</Empty> : (
            <Bars rows={Object.entries(r.bySource).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: SOURCE_LABEL[k] ?? k, value: v, text: `${v} · ${Math.round((v / r.sourceTotal) * 100)}%` }))} />
          )}
        </Card>
      </div>

      <section className="card overflow-x-auto">
        <div className="flex items-baseline justify-between px-5 pb-1.5 pt-4">
          <h2 className="text-base font-semibold">Outstanding balances</h2>
          <span className="text-[13px] text-ink-muted">Soonest deadline first</span>
        </div>
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead><tr className="text-left text-xs text-ink-muted">
            <th className="border-b border-line px-5 py-2.5 font-semibold">Guest</th>
            <th className="border-b border-line px-2 py-2.5 font-semibold">Trip</th>
            <th className="border-b border-line px-2 py-2.5 font-semibold">Due by</th>
            <th className="border-b border-line px-5 py-2.5 text-right font-semibold">Amount</th>
          </tr></thead>
          <tbody>
            {r.owed.map(({ b, due }) => (
              <tr key={b.id}>
                <td className="border-b border-hair px-5 py-3 font-medium"><a href={`/admin/bookings/${b.id}`} className="text-ink no-underline hover:underline">{b.leadGuest.name}</a></td>
                <td className="border-b border-hair px-2 py-3 text-ink-2">{fmtDate(b.tripDate)} · {b.type === "FULL_BOAT" ? "full boat" : `${b.nights.length} cabins`}</td>
                <td className="border-b border-hair px-2 py-3 text-ink-2">{fmtDateTime(b.status === "CONFIRMED_BALANCE_DUE" ? b.balanceDueAt : b.paymentDueAt)}</td>
                <td className="tabnum border-b border-hair px-5 py-3 text-right">{tk(due)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {r.owed.length === 0 && <Empty>Nothing outstanding for this month.</Empty>}
      </section>
    </div>
  );
}
