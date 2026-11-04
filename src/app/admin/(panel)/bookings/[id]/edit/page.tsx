import { notFound } from "next/navigation";
import { Banner, Card, Icon, PageHeader } from "@/components/ui";
import { fmtDateLong } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { prisma } from "@/server/db";
import { changeBookingAction } from "../../../../_actions/booking";

export default async function EditBooking({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireUser("MANAGE_BOOKINGS");
  const { id } = await params;
  const { error } = await searchParams;
  const b = await prisma.booking.findUnique({ where: { id }, include: { guests: true, nights: true, lines: true, leadGuest: true } });
  if (!b) notFound();
  const [cabins, bands] = await Promise.all([
    prisma.cabin.findMany({ where: { active: true }, include: { cabinType: true }, orderBy: { sortOrder: "asc" } }),
    prisma.ageBand.findMany({ orderBy: { minAge: "desc" } }),
  ]);
  const count = (band: string) => b.guests.filter((g) => g.ageBandName === band).length;
  const food = (band: string) => b.lines.find((l) => l.kind === "FOOD" && l.description.endsWith(band))?.qty ?? 0;

  return (
    <form action={changeBookingAction.bind(null, id)} className="flex max-w-3xl flex-col gap-5">
      <a href={`/admin/bookings/${id}`} className="flex items-center gap-1.5 text-[13px] font-medium no-underline"><Icon name="left" size={14} />{b.reference}</a>
      <PageHeader eyebrow={`${b.leadGuest.name} · now ${fmtDateLong(b.tripDate)}`} title="Change booking" />
      <p className="text-sm text-ink-2">Availability is checked again and the booking is re-priced at the rates for the new date. If the price changes, a revised invoice is issued and the guest is told.</p>
      <Banner>{error}</Banner>
      <Card title="Trip date">
        <input type="date" name="tripDate" defaultValue={b.tripDate.toISOString().slice(0, 10)} required className="input max-w-xs" aria-label="Trip date" />
      </Card>
      <Card title="Guests">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {bands.map((x, i) => (
            <label key={x.id} className="label">{x.name}<input type="number" min={0} name={`g${i}`} defaultValue={count(x.name)} className="input" /></label>
          ))}
        </div>
      </Card>
      {b.type === "SHARED" ? (
        <Card title="Cabins and guests per cabin">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {cabins.map((c) => {
              const n = b.nights.find((x) => x.cabinId === c.id);
              return (
                <div key={c.id} className="flex items-center gap-3 rounded-[10px] border border-field p-3 text-sm">
                  <input type="checkbox" name="cabin" value={c.id} id={`c_${c.id}`} defaultChecked={!!n} className="h-[18px] w-[18px] accent-lake" />
                  <label htmlFor={`c_${c.id}`} className="flex-1">{c.name} · {c.cabinType.name} · sleeps {c.capacity}</label>
                  <input type="number" min={0} max={c.capacity} name={`cg_${c.id}`} defaultValue={n?.guests || ""} aria-label={`Guests in ${c.name}`} className="input w-20" />
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card title="Guests taking the food package">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {bands.map((x, i) => (
              <label key={x.id} className="label">{x.name}<input type="number" min={0} name={`f${i}`} defaultValue={food(x.name)} className="input" /></label>
            ))}
          </div>
        </Card>
      )}
      <div className="flex gap-2">
        <a href={`/admin/bookings/${id}`} className="btn-ghost">Cancel</a>
        <button className="btn">Save changes</button>
      </div>
    </form>
  );
}
