import Link from "next/link";
import { addMonths, toDhakaDate, weekday } from "@/domain";
import { Card, ErrorBanner, STATUS_DOT, inputCls, btnCls } from "@/components/ui";
import { requireUser } from "@/server/auth/current-user";
import { can } from "@/server/auth/permissions";
import { monthCalendar } from "@/server/queries";
import { blockDateAction } from "../../actions";

const MODE_STYLE: Record<string, string> = {
  OPEN: "bg-white",
  SHARED: "bg-sky-50",
  FULL_BOAT: "bg-indigo-100",
  BLOCKED: "bg-slate-300",
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; error?: string; day?: string }> }) {
  const user = await requireUser("VIEW_OPERATIONS");
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : toDhakaDate(new Date()).slice(0, 7);
  const days = await monthCalendar(month);
  const lead = weekday(days[0].date);
  const prev = addMonths(`${month}-01`, -1).slice(0, 7);
  const next = addMonths(`${month}-01`, 1).slice(0, 7);
  const sel = days.find((d) => d.date === sp.day);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Calendar · {month}</h1>
        <div className="flex gap-3 text-sm">
          <Link className="underline" href={`?month=${prev}`}>← Prev</Link>
          <Link className="underline" href={`?month=${next}`}>Next →</Link>
        </div>
      </div>
      <ErrorBanner message={sp.error} />
      <div className="grid grid-cols-7 gap-1 text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="px-1 font-medium text-slate-500">{d}</div>
        ))}
        {Array.from({ length: lead }, (_, i) => <div key={`e${i}`} />)}
        {days.map((d) => (
          <Link
            key={d.date}
            href={`?month=${month}&day=${d.date}`}
            className={`min-h-20 rounded border p-1 ${MODE_STYLE[d.mode]} ${sp.day === d.date ? "ring-2 ring-slate-900" : ""}`}
          >
            <div className="flex justify-between">
              <span className="font-medium">{Number(d.date.slice(8))}</span>
              {d.holiday && <span title={d.holiday} className="text-red-600">●</span>}
            </div>
            <div className="text-[11px] text-slate-600">
              {d.mode === "BLOCKED" ? "Blocked" : d.mode === "FULL_BOAT" ? "Full boat" : `${d.cabinsSold}/${d.cabinsTotal} cabins`}
              {d.guests > 0 && ` · ${d.guests}g`}
            </div>
            <div className="mt-1 flex flex-wrap gap-0.5">
              {d.bookings.map((b) => (
                <span key={b.id} className={`h-2 w-2 rounded-full ${STATUS_DOT[b.status] ?? "bg-slate-400"}`} title={`${b.reference} ${b.lead}`} />
              ))}
            </div>
          </Link>
        ))}
      </div>
      <p className="text-xs text-slate-500">● red = government holiday. Dots show bookings coloured by status.</p>

      {sel && (
        <Card title={`${sel.date}${sel.holiday ? ` · ${sel.holiday}` : ""}`}>
          {sel.bookings.length === 0 && <p className="text-sm text-slate-500">No bookings.</p>}
          <ul className="mb-3 text-sm">
            {sel.bookings.map((b) => (
              <li key={b.id}><Link className="underline" href={`/admin/bookings/${b.id}`}>{b.reference}</Link> · {b.lead} · {b.status}</li>
            ))}
          </ul>
          {can(user.role, "MANAGE_BOOKINGS") && (
            <form action={blockDateAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="date" value={sel.date} />
              <label className="text-sm">Reason
                <input name="reason" defaultValue={sel.blockReason ?? ""} required className={inputCls} />
              </label>
              {sel.bookings.length > 0 && sel.mode !== "BLOCKED" && (
                <label className="text-sm"><input type="checkbox" name="confirm" value="yes" /> Block despite existing bookings</label>
              )}
              {sel.mode === "BLOCKED" ? (
                <button name="unblock" value="1" className={btnCls}>Unblock</button>
              ) : (
                <button className={btnCls}>Block date</button>
              )}
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
