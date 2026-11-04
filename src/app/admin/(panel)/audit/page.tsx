import Link from "next/link";
import { Card, btnCls, inputCls } from "../../../../components/ui";
import { fmtDateTime } from "../../../../lib/format";
import { requireUser } from "../../../../server/auth/current-user";
import { prisma } from "../../../../server/db";

const PAGE = 50;

/** FR-A27: read-only audit trail. */
export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireUser("ADMIN_SETTINGS");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim();
  // A booking reference in the search box is resolved to its id.
  const booking = q ? await prisma.booking.findUnique({ where: { reference: q } }) : null;
  const where = q ? { OR: [{ entityId: booking?.id ?? q }, { action: { contains: q, mode: "insensitive" as const } }, { actor: q }] } : {};
  const [rows, total, users] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { at: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);
  const who = new Map(users.map((u) => [u.id, u.name]));
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const href = (p: number) => `?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Audit log ({total})</h1>
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Booking reference, action or user id" className={`${inputCls} max-w-md`} />
        <button className={btnCls}>Search</button>
      </form>
      <Card>
        <table className="w-full text-left text-xs">
          <thead className="text-slate-500"><tr><th className="py-1">When</th><th>Who</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="py-1 whitespace-nowrap">{fmtDateTime(r.at)}</td>
                <td>{who.get(r.actor) ?? r.actor}</td>
                <td>{r.action}</td>
                <td>{r.entity === "Booking" ? <Link className="underline" href={`/admin/bookings/${r.entityId}`}>Booking</Link> : `${r.entity} ${r.entityId}`}</td>
                <td className="max-w-md break-words text-slate-600">{r.reason}{r.after ? ` ${JSON.stringify(r.after)}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex justify-between text-sm">
          {page > 1 ? <Link className="underline" href={href(page - 1)}>← Newer</Link> : <span />}
          <span>Page {page} of {pages}</span>
          {page < pages ? <Link className="underline" href={href(page + 1)}>Older →</Link> : <span />}
        </div>
      </Card>
    </div>
  );
}
