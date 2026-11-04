import { Banner, Card } from "@/components/ui";
import { tk } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { prisma } from "@/server/db";
import { cabinAction, cabinTypeAction } from "../../../_actions/settings";

export default async function CabinsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireUser("ADMIN_SETTINGS");
  const sp = await searchParams;
  const [cabins, types, cap] = await Promise.all([
    prisma.cabin.findMany({ include: { cabinType: true }, orderBy: { sortOrder: "asc" } }),
    prisma.cabinType.findMany({ orderBy: { name: "asc" } }),
    prisma.boatSetting.findFirst({ orderBy: { effectiveFrom: "desc" } }),
  ]);
  const total = cabins.filter((c) => c.active).reduce((n, c) => n + c.capacity, 0);
  return (
    <div className="flex flex-col gap-5">
      <Banner tone="ok">{sp.ok}</Banner>
      <Banner>{sp.error}</Banner>
      <Card title="Cabins" action={<span className="text-[13px] text-ink-muted">{cabins.filter((c) => c.active).length} active · sleeps {total}{cap ? ` · boat cap ${cap.capacityCap}` : ""}</span>}>
        <p className="mb-3 text-[13px] text-ink-muted">Changes apply to future dates. A cabin with future bookings can&apos;t be switched off or made smaller than its booked guests.</p>
        <div className="flex flex-col">
          {cabins.map((c) => (
            <form key={c.id} action={cabinAction} className="grid grid-cols-2 items-end gap-2 border-t border-hair py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_90px_80px_auto_auto]">
              <input type="hidden" name="id" value={c.id} />
              <label className="label text-xs">Name<input name="name" defaultValue={c.name} required className="input" /></label>
              <label className="label text-xs">Type<select name="cabinTypeId" defaultValue={c.cabinTypeId} className="input">{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
              <label className="label text-xs">Sleeps<input name="capacity" inputMode="numeric" defaultValue={c.capacity} className="input" /></label>
              <label className="label text-xs">Order<input name="sortOrder" inputMode="numeric" defaultValue={c.sortOrder} className="input" /></label>
              <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={c.active} className="h-[18px] w-[18px] accent-lake" />Active</label>
              <button className="btn-ghost">Save</button>
            </form>
          ))}
        </div>
        <form action={cabinAction} className="mt-2 grid grid-cols-2 items-end gap-2 border-t border-hair pt-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_90px_auto]">
          <label className="label text-xs">New cabin name<input name="name" required className="input" placeholder="Cabin 5" /></label>
          <label className="label text-xs">Type<select name="cabinTypeId" className="input">{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label className="label text-xs">Sleeps<input name="capacity" inputMode="numeric" defaultValue={4} className="input" /></label>
          <button className="btn">Add cabin</button>
        </form>
      </Card>

      <Card title="Cabin types" action={<span className="text-[13px] text-ink-muted">Surcharge is added per cabin on shared bookings</span>}>
        {types.map((t) => (
          <form key={t.id} action={cabinTypeAction} className="grid grid-cols-[minmax(0,2fr)_140px_auto] items-end gap-2 border-t border-hair py-3">
            <input type="hidden" name="id" value={t.id} />
            <label className="label text-xs">Name<input name="name" defaultValue={t.name} className="input" /></label>
            <label className="label text-xs">Surcharge (Tk)<input name="surcharge" inputMode="numeric" defaultValue={t.surcharge} className="input" /></label>
            <button className="btn-ghost">Save</button>
          </form>
        ))}
        <form action={cabinTypeAction} className="grid grid-cols-[minmax(0,2fr)_140px_auto] items-end gap-2 border-t border-hair pt-3">
          <label className="label text-xs">New type<input name="name" required className="input" placeholder="Family" /></label>
          <label className="label text-xs">Surcharge (Tk)<input name="surcharge" inputMode="numeric" defaultValue={0} className="input" /></label>
          <button className="btn-ghost">Add type</button>
        </form>
        <p className="mt-2 text-xs text-ink-muted">Current surcharges: {types.map((t) => `${t.name} ${t.surcharge ? tk(t.surcharge) : "none"}`).join(" · ")}</p>
      </Card>
    </div>
  );
}
