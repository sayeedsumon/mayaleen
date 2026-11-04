import Link from "next/link";
import { addDays, toDhakaDate } from "@/domain";
import { STATUS_DOT } from "@/components/ui";
import { iso } from "@/server/config";
import { requireUser } from "@/server/auth/current-user";
import { timeline } from "@/server/queries";

const DAYS = 14;

export default async function TimelinePage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  await requireUser("VIEW_OPERATIONS");
  const sp = await searchParams;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? sp.from! : toDhakaDate(new Date());
  const { dates, cabins, nights } = await timeline(from, DAYS);
  const cell = (cabinId: string, date: string) => nights.find((n) => n.cabinId === cabinId && iso(n.tripDate) === date);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Cabin timeline</h1>
        <div className="flex gap-3 text-sm">
          <Link className="underline" href={`?from=${addDays(from, -DAYS)}`}>← Earlier</Link>
          <Link className="underline" href={`?from=${addDays(from, DAYS)}`}>Later →</Link>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-white p-2 text-left">Cabin</th>
              {dates.map((d) => <th key={d} className="p-1 font-normal text-slate-500">{d.slice(5)}</th>)}
            </tr>
          </thead>
          <tbody>
            {cabins.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="sticky left-0 whitespace-nowrap bg-white p-2 font-medium">{c.name}<div className="font-normal text-slate-500">{c.cabinType.name}</div></td>
                {dates.map((d) => {
                  const n = cell(c.id, d);
                  return (
                    <td key={d} className="h-10 min-w-14 border-l p-0.5">
                      {n && (
                        <Link
                          href={`/admin/bookings/${n.bookingId}`}
                          title={`${n.booking.reference} ${n.booking.leadGuest.name}`}
                          className={`block truncate rounded px-1 py-1 text-white ${STATUS_DOT[n.booking.status] ?? "bg-slate-500"}`}
                        >
                          {n.booking.leadGuest.name.split(" ")[0]}
                        </Link>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
