import { ErrorBanner, btnCls, inputCls, Card } from "@/components/ui";
import { requireUser } from "@/server/auth/current-user";
import { can } from "@/server/auth/permissions";
import { prisma } from "@/server/db";
import { createBookingAction } from "../../../actions";

export default async function NewBooking({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser("CREATE_BOOKING");
  const { error } = await searchParams;
  const [cabins, bands] = await Promise.all([
    prisma.cabin.findMany({ where: { active: true }, include: { cabinType: true }, orderBy: { sortOrder: "asc" } }),
    prisma.ageBand.findMany({ orderBy: { minAge: "desc" } }),
  ]);
  return (
    <form action={createBookingAction} className="space-y-4">
      <h1 className="text-xl font-semibold">New booking (phone / Facebook / walk-in)</h1>
      <ErrorBanner message={error} />
      <Card title="Trip">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">Trip date<input type="date" name="tripDate" required className={inputCls} /></label>
          <label className="text-sm">Package
            <select name="type" className={inputCls}>
              <option value="SHARED">Shared (cabins, min 2)</option>
              <option value="FULL_BOAT">Full boat</option>
            </select>
          </label>
          <label className="text-sm">Source
            <select name="source" className={inputCls}>
              <option value="PHONE">Phone</option><option value="FACEBOOK">Facebook</option>
              <option value="WALK_IN">Walk-in</option><option value="OTHER">Other</option>
            </select>
          </label>
        </div>
      </Card>
      <Card title="Guests">
        <div className="grid gap-3 md:grid-cols-3">
          {bands.map((b, i) => (
            <label key={b.id} className="text-sm">{b.name} ({b.pctOfAdult}%)
              <input type="number" min={0} name={`g${i}`} defaultValue={b.isAdult ? 2 : 0} className={inputCls} />
            </label>
          ))}
        </div>
      </Card>
      <Card title="Shared: choose cabins and guests per cabin">
        <div className="grid gap-2 md:grid-cols-2">
          {cabins.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded border p-2 text-sm">
              <input type="checkbox" name="cabin" value={c.id} id={`c_${c.id}`} />
              <label htmlFor={`c_${c.id}`} className="flex-1">{c.name} · {c.cabinType.name} · sleeps {c.capacity}</label>
              <input type="number" min={0} max={c.capacity} name={`cg_${c.id}`} placeholder="guests" className="w-20 rounded border p-1" />
            </div>
          ))}
        </div>
      </Card>
      <Card title="Full boat: guests taking the food package">
        <div className="grid gap-3 md:grid-cols-3">
          {bands.map((b, i) => (
            <label key={b.id} className="text-sm">{b.name}
              <input type="number" min={0} name={`f${i}`} defaultValue={0} className={inputCls} />
            </label>
          ))}
        </div>
      </Card>
      <Card title="Lead guest">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">Name<input name="name" required className={inputCls} /></label>
          <label className="text-sm">Mobile<input name="mobile" required placeholder="01XXXXXXXXX" className={inputCls} /></label>
          <label className="text-sm">NID number<input name="nid" required className={inputCls} /></label>
          <label className="text-sm">Email (optional)<input type="email" name="email" className={inputCls} /></label>
          <label className="text-sm md:col-span-2">Notes<textarea name="notes" className={inputCls} /></label>
        </div>
      </Card>
      {can(user.role, "MANAGE_BOOKINGS") && (
        <Card>
          <label className="text-sm"><input type="checkbox" name="approveNow" /> Approve immediately and issue invoice</label>
          <select name="paymentOption" className={`${inputCls} mt-2 max-w-xs`}>
            <option value="FULL">Full payment</option><option value="ADVANCE">Advance</option>
          </select>
        </Card>
      )}
      <button className={btnCls}>Create booking</button>
    </form>
  );
}
