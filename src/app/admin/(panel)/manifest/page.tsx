import Link from "next/link";
import { toDhakaDate } from "@/domain";
import { Card, StatusBadge, btnGhostCls, inputCls } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { can } from "@/server/auth/permissions";
import { prisma } from "@/server/db";
import { manifest } from "@/server/queries";

export default async function ManifestPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireUser("VIEW_OPERATIONS");
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : toDhakaDate(new Date());
  const m = await manifest(date);
  // FR-A19: NID access is logged. Only roles that can operate may see it; record the view.
  if (can(user.role, "VIEW_OPERATIONS") && m.bookings.length > 0) {
    await prisma.auditLog.create({ data: { entity: "Manifest", entityId: date, action: "NID_VIEW", actor: user.id } });
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <h1 className="text-xl font-semibold">Manifest and kitchen sheet · {fmtDate(date)}</h1>
        <form className="flex gap-2">
          <input type="date" name="date" defaultValue={date} className={`${inputCls} w-44`} />
          <button className={btnGhostCls}>Go</button>
        </form>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Card title="Guests on board"><p className="text-3xl font-semibold">{m.guests}</p></Card>
        <Card title="Meals to prepare"><p className="text-3xl font-semibold">{m.meals}</p><p className="text-xs text-slate-500">Shared guests (food included) + full-boat food packages</p></Card>
        <Card title="Children"><p className="text-3xl font-semibold">{m.children}</p></Card>
      </div>
      {m.bookings.map((b) => (
        <Card key={b.id} title={`${b.reference} · ${b.leadGuest.name} · ${b.leadGuest.mobile}`}>
          <div className="mb-2 flex flex-wrap gap-3 text-sm">
            <StatusBadge status={b.status} />
            <span>Cabins: {b.nights.map((n) => n.cabin.name).join(", ") || "-"}</span>
            {b.notes && <span>Notes: {b.notes}</span>}
            <Link className="underline print:hidden" href={`/admin/bookings/${b.id}`}>Open</Link>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500"><tr><th>Guest</th><th>Type</th><th>NID / passport</th></tr></thead>
            <tbody>
              {b.guests.map((g) => (
                <tr key={g.id}><td>{g.name ?? "-"}{g.isLead && " (lead)"}</td><td>{g.ageBandName}</td><td>{g.nidOrPassport ?? (g.isLead ? b.leadGuest.nid : "-")}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
      {m.bookings.length === 0 && <p className="text-sm text-slate-500">No confirmed bookings for this date.</p>}
      <p className="text-xs text-slate-500 print:hidden">Use your browser's Print (Ctrl+P) for the paper copy.</p>
    </div>
  );
}
