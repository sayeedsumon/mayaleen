import { notFound } from "next/navigation";
import { Card, ErrorBanner, btnCls, inputCls } from "../../../../../../components/ui";
import { requireUser } from "../../../../../../server/auth/current-user";
import { prisma } from "../../../../../../server/db";
import { fmtDate } from "../../../../../../lib/format";
import { changeBookingAction } from "../../../../actions";

export default async function EditBooking({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireUser("MANAGE_BOOKINGS");
  const { id } = await params;
  const { error } = await searchParams;
  const b = await prisma.booking.findUnique({ where: { id }, include: { guests: true, nights: true, lines: true } });
  if (!b) notFound();
  const [cabins, bands] = await Promise.all([
    prisma.cabin.findMany({ where: { active: true }, include: { cabinType: true }, orderBy: { sortOrder: "asc" } }),
    prisma.ageBand.findMany({ orderBy: { minAge: "desc" } }),
  ]);
  const count = (band: string) => b.guests.filter((g) => g.ageBandName === band).length;
  const food = (band: string) => b.lines.find((l) => l.kind === "FOOD" && l.description.endsWith(band))?.qty ?? 0;

  return (
    <form action={changeBookingAction.bind(null, id)} className="space-y-4">
      <h1 className="text-xl font-semibold">Change {b.reference}</h1>
      <p className="text-sm text-slate-600">
        Availability is re-checked and the booking is re-priced at today&apos;s rates. A revised invoice is issued if one exists.
        Currently {fmtDate(b.tripDate)}.
      </p>
      <ErrorBanner message={error} />
      <Card title="Trip date">
        <input type="date" name="tripDate" defaultValue={b.tripDate.toISOString().slice(0, 10)} required className={`${inputCls} max-w-xs`} />
      </Card>
      <Card title="Guests">
        <div className="grid gap-3 md:grid-cols-3">
          {bands.map((x, i) => (
            <label key={x.id} className="text-sm">{x.name}
              <input type="number" min={0} name={`g${i}`} defaultValue={count(x.name)} className={inputCls} />
            </label>
          ))}
        </div>
      </Card>
      {b.type === "SHARED" ? (
        <Card title="Cabins and guests per cabin">
          <div className="grid gap-2 md:grid-cols-2">
            {cabins.map((c) => {
              const n = b.nights.find((x) => x.cabinId === c.id);
              return (
                <div key={c.id} className="flex items-center gap-3 rounded border p-2 text-sm">
                  <input type="checkbox" name="cabin" value={c.id} id={`c_${c.id}`} defaultChecked={!!n} />
                  <label htmlFor={`c_${c.id}`} className="flex-1">{c.name} · {c.cabinType.name} · sleeps {c.capacity}</label>
                  <input type="number" min={0} max={c.capacity} name={`cg_${c.id}`} defaultValue={n?.guests || ""} className="w-20 rounded border p-1" />
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card title="Guests taking the food package">
          <div className="grid gap-3 md:grid-cols-3">
            {bands.map((x, i) => (
              <label key={x.id} className="text-sm">{x.name}
                <input type="number" min={0} name={`f${i}`} defaultValue={food(x.name)} className={inputCls} />
              </label>
            ))}
          </div>
        </Card>
      )}
      <button className={btnCls}>Save changes</button>
    </form>
  );
}
