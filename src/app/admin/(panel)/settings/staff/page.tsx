import { Banner, Card, Chip } from "@/components/ui";
import { fmtDateTime, initials } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { prisma } from "@/server/db";
import { staffAction } from "../../../_actions/settings";

const ROLES = [["FRONT_DESK", "Front desk", "Calendar, new bookings, check-in/out, manifest"], ["MANAGER", "Manager", "Also approve, invoices, payments, refunds, reports"], ["ADMIN", "Owner", "Everything, including prices, cabins, staff"]] as const;

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireUser("ADMIN_SETTINGS");
  const sp = await searchParams;
  const users = await prisma.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  return (
    <div className="flex flex-col gap-5">
      <Banner tone="ok">{sp.ok}</Banner>
      <Banner>{sp.error}</Banner>
      <Card title="Staff">
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {ROLES.map(([, l, d]) => <div key={l} className="rounded-[10px] bg-sand px-3 py-2.5 text-[13px]"><div className="font-semibold">{l}</div><div className="text-ink-2">{d}</div></div>)}
        </div>
        {users.map((u) => (
          <div key={u.id} className="flex flex-col gap-2 border-t border-hair py-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-lake-soft text-[13px] font-semibold text-lake-dark">{initials(u.name)}</span>
              <div className="min-w-[180px] flex-1">
                <div className="text-sm font-semibold">{u.name}{u.id === me.id ? " (you)" : ""}</div>
                <div className="text-xs text-ink-muted">{u.mobile} · added {fmtDateTime(u.createdAt, true)}</div>
              </div>
              {u.twoFaOn ? <Chip tone="leaf">2-step on</Chip> : <Chip tone="amber">2-step off</Chip>}
              {!u.active && <Chip tone="rose">Disabled</Chip>}
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={staffAction} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={u.id} />
                <select name="role" defaultValue={u.role} aria-label="Role" className="input w-40">{ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={u.active} className="h-[18px] w-[18px] accent-lake" />Can sign in</label>
                <button className="btn-ghost btn-sm">Save</button>
              </form>
              <form action={staffAction} className="flex items-center gap-2">
                <input type="hidden" name="id" value={u.id} />
                <input type="password" name="password" minLength={10} required placeholder="New password (10+ characters)" aria-label={`New password for ${u.name}`} className="input w-64" autoComplete="new-password" />
                <button className="btn-ghost btn-sm">Reset password</button>
              </form>
            </div>
          </div>
        ))}
      </Card>
      <Card title="Add staff member">
        <form action={staffAction} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_160px_minmax(0,2fr)_auto]">
          <label className="label text-xs">Name<input name="name" required className="input" /></label>
          <label className="label text-xs">Mobile (sign-in)<input name="mobile" required inputMode="tel" placeholder="01XXXXXXXXX" className="input" /></label>
          <label className="label text-xs">Role<select name="role" defaultValue="FRONT_DESK" className="input">{ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          <label className="label text-xs">First password<input name="password" type="password" minLength={10} required autoComplete="new-password" className="input" /></label>
          <button className="btn">Add</button>
        </form>
        <p className="mt-2 text-xs text-ink-muted">Ask them to change the password and turn on two-step sign-in from My account after their first sign-in.</p>
      </Card>
    </div>
  );
}
