import Link from "next/link";
import type { BookingStatus } from "@prisma/client";
import { Card, StatusBadge, btnCls, inputCls } from "@/components/ui";
import { fmtDate, STATUS_LABEL, tk } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { searchBookings } from "@/server/queries";

type SP = { q?: string; status?: string; type?: string; source?: string; from?: string; to?: string; page?: string };

export default async function BookingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser("VIEW_OPERATIONS");
  const sp = await searchParams;
  const { rows, total, page, pages } = await searchBookings({
    q: sp.q, status: (sp.status || undefined) as BookingStatus | undefined, type: (sp.type || undefined) as never,
    source: sp.source || undefined, from: sp.from || undefined, to: sp.to || undefined, page: Number(sp.page) || 1,
  });
  const qs = (p: number) => new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v)), page: String(p) }).toString();
  const exportQs = new URLSearchParams(Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== "page"))).toString();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Bookings ({total})</h1>
        <a className="text-sm underline" href={`/admin/bookings/export?${exportQs}`}>Export CSV</a>
      </div>
      <form className="grid gap-2 rounded-lg bg-white p-3 shadow-sm md:grid-cols-6">
        <input name="q" defaultValue={sp.q} placeholder="Reference, name, mobile, NID" className={`${inputCls} md:col-span-2`} />
        <select name="status" defaultValue={sp.status ?? ""} className={inputCls}>
          <option value="">Any status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="type" defaultValue={sp.type ?? ""} className={inputCls}>
          <option value="">Shared + full boat</option>
          <option value="SHARED">Shared</option>
          <option value="FULL_BOAT">Full boat</option>
        </select>
        <input name="from" type="date" defaultValue={sp.from} className={inputCls} aria-label="Trip date from" />
        <input name="to" type="date" defaultValue={sp.to} className={inputCls} aria-label="Trip date to" />
        <button className={btnCls}>Search</button>
      </form>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr><th className="py-1">Reference</th><th>Trip date</th><th>Lead guest</th><th>Type</th><th>Status</th><th className="text-right">Total</th></tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((b) => (
                <tr key={b.id}>
                  <td className="py-2"><Link className="underline" href={`/admin/bookings/${b.id}`}>{b.reference}</Link></td>
                  <td>{fmtDate(b.tripDate)}</td>
                  <td>{b.leadGuest.name}<div className="text-xs text-slate-500">{b.leadGuest.mobile}</div></td>
                  <td>{b.type === "FULL_BOAT" ? "Full boat" : "Shared"}</td>
                  <td><StatusBadge status={b.status} /></td>
                  <td className="text-right">{b.invoices[0] ? tk(b.invoices[0].total) : "-"}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-500">No bookings match.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          {page > 1 ? <Link className="underline" href={`?${qs(page - 1)}`}>← Previous</Link> : <span />}
          <span>Page {page} of {pages}</span>
          {page < pages ? <Link className="underline" href={`?${qs(page + 1)}`}>Next →</Link> : <span />}
        </div>
      </Card>
    </div>
  );
}
