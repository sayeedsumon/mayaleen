import Link from "next/link";
import { Card, Empty } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { prisma } from "@/server/db";

const PAGE = 50;

/** FR-A27: read-only audit trail. */
export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireUser("ADMIN_SETTINGS");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim();
  const booking = q ? await prisma.booking.findUnique({ where: { reference: q.toUpperCase() } }) : null;
  const where = q ? { OR: [{ entityId: booking?.id ?? q }, { action: { contains: q.toUpperCase().replace(/\s+/g, "_") } }, { actor: q }] } : {};
  const [rows, total, users] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { at: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);
  const who = new Map(users.map((u) => [u.id, u.name]));
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const href = (p: number) => `?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;
  return (
    <Card title={`Audit log · ${total}`} pad={false}>
      <form className="flex gap-2 px-5 pb-3">
        <input name="q" defaultValue={q} placeholder="Booking reference, action (e.g. refund) or user id" className="input max-w-md" aria-label="Search the audit log" />
        <button className="btn-ghost">Search</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs">
          <thead className="text-ink-muted"><tr>
            <th className="border-b border-line px-5 py-2 font-semibold">When</th><th className="border-b border-line px-2 py-2 font-semibold">Who</th>
            <th className="border-b border-line px-2 py-2 font-semibold">Action</th><th className="border-b border-line px-2 py-2 font-semibold">What</th>
            <th className="border-b border-line px-5 py-2 font-semibold">Details</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="whitespace-nowrap border-b border-hair px-5 py-2">{fmtDateTime(r.at, true)}</td>
                <td className="border-b border-hair px-2 py-2">{who.get(r.actor) ?? r.actor}</td>
                <td className="border-b border-hair px-2 py-2 font-semibold">{r.action.toLowerCase().replace(/_/g, " ")}</td>
                <td className="border-b border-hair px-2 py-2">{r.entity === "Booking" ? <a href={`/admin/bookings/${r.entityId}`}>Booking</a> : `${r.entity} ${r.entityId.length > 12 ? "" : r.entityId}`}</td>
                <td className="max-w-md break-words border-b border-hair px-5 py-2 text-ink-2">{r.reason}{r.after ? ` ${JSON.stringify(r.after)}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <Empty>No entries.</Empty>}
      <div className="flex justify-between px-5 py-3 text-sm">
        {page > 1 ? <Link href={href(page - 1)}>← Newer</Link> : <span />}
        <span className="text-ink-muted">Page {page} of {pages}</span>
        {page < pages ? <Link href={href(page + 1)}>Older →</Link> : <span />}
      </div>
    </Card>
  );
}
