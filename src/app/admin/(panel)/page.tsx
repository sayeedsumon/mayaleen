import Link from "next/link";
import type { ReactNode } from "react";
import { Card, StatusBadge } from "@/components/ui";
import { countdown, fmtDate, fmtDateTime, tk } from "@/lib/format";
import { dashboard } from "@/server/queries";

type Row = {
  id: string; reference: string; tripDate: Date; status: string; leadGuest: { name: string };
  holdExpiresAt: Date | null; balanceDueAt: Date | null;
};

function List({ rows, extra, empty }: { rows: Row[]; extra?: (r: Row) => ReactNode; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="divide-y text-sm">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <Link href={`/admin/bookings/${r.id}`} className="font-medium underline">{r.reference}</Link>
          <span>{r.leadGuest.name} · {fmtDate(r.tripDate)}</span>
          <span className="text-slate-600">{extra?.(r)}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const sp = await searchParams;
  const now = new Date();
  const d = await dashboard(now);
  return (
    <div className="space-y-4">
      {sp.denied && <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">You do not have permission for that.</p>}
      <h1 className="text-xl font-semibold">Today · {fmtDate(d.today)}</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title={`Pending approval (${d.pending.length})`}>
          <List rows={d.pending} empty="Nothing waiting." extra={(r) => `hold ${countdown(r.holdExpiresAt, now)}`} />
        </Card>
        <Card title={`Payment proofs to verify (${d.proofs.length})`}>
          {d.proofs.length === 0 ? (
            <p className="text-sm text-slate-500">No proofs waiting.</p>
          ) : (
            <ul className="divide-y text-sm">
              {d.proofs.map((p) => (
                <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <Link href={`/admin/bookings/${p.invoice.booking.id}`} className="font-medium underline">{p.invoice.booking.reference}</Link>
                  <span>{p.invoice.booking.leadGuest.name}</span>
                  <span>{tk(p.amountClaimed)} · {fmtDateTime(p.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={`Balances due within 48h (${d.balances.length})`}>
          <List rows={d.balances} empty="None." extra={(r) => `due ${fmtDateTime(r.balanceDueAt)}`} />
        </Card>
        <Card title={`Today's check-ins (${d.checkIns.length})`}>
          <List rows={d.checkIns} empty="No arrivals today." extra={(r) => <StatusBadge status={r.status} />} />
        </Card>
        <Card title={`Check-outs due (${d.checkOuts.length})`}>
          <List rows={d.checkOuts} empty="No one on board." extra={() => "11:00 check-out"} />
        </Card>
      </div>
    </div>
  );
}
