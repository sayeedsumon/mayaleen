import Link from "next/link";
import { addDays, toDhakaDate } from "@/domain";
import { Icon, STATUS } from "@/components/ui";
import { tk } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { iso } from "@/server/config";
import { timeline } from "@/server/queries";
import { TimelineGrid, type TLCell } from "./grid";

const DAYS = 14;
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function TimelinePage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  await requireUser("VIEW_OPERATIONS");
  const sp = await searchParams;
  const today = toDhakaDate(new Date());
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? sp.from! : today;
  const t = await timeline(from, DAYS);
  const to = addDays(from, DAYS - 1);
  const rows = t.cabins.map((c) => ({
    id: c.id, name: c.name, type: c.cabinType.name, capacity: c.capacity,
    cells: t.dates.map(({ date }): TLCell => {
      if (t.blocked.has(date)) return { date, kind: "blocked" };
      const n = t.nights.find((x) => x.cabinId === c.id && iso(x.tripDate) === date);
      if (!n) return { date, kind: date < today ? "past" : "free" };
      const full = n.booking.type === "FULL_BOAT";
      return {
        date, kind: "booked", bookingId: n.bookingId, held: STATUS[n.booking.status]?.held ?? false,
        label: full ? `Full boat · ${n.booking.leadGuest.name}` : n.booking.leadGuest.name, ref: n.booking.reference,
      };
    }),
  }));
  const sold = rows.reduce((n, r) => n + r.cells.filter((c) => c.kind === "booked").length, 0);
  const held = rows.reduce((n, r) => n + r.cells.filter((c) => c.kind === "booked" && c.held).length, 0);
  const sellable = rows.reduce((n, r) => n + r.cells.filter((c) => c.kind !== "blocked").length, 0);
  const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center gap-4">
        <div className="min-w-[260px] flex-1">
          <div className="eyebrow">Cabins by night</div>
          <h1 className="h1 mt-0.5">{fmt(from)} – {fmt(to)}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`?from=${addDays(from, -DAYS)}`} aria-label="Previous two weeks" className="btn-ghost w-10 px-0"><Icon name="left" size={16} /></Link>
          <Link href="?" className="btn-ghost">Today</Link>
          <Link href={`?from=${addDays(from, DAYS)}`} aria-label="Next two weeks" className="btn-ghost w-10 px-0"><Icon name="right" size={16} /></Link>
        </div>
        <div role="tablist" aria-label="View" className="flex gap-1 rounded-[10px] bg-sand-3 p-1">
          <Link role="tab" aria-selected="false" href={`/admin/calendar?month=${from.slice(0, 7)}&day=${from}`} className="rounded-[7px] px-3.5 py-2 text-sm font-medium text-ink-2 no-underline">Month</Link>
          <span role="tab" aria-selected="true" className="rounded-[7px] bg-white px-3.5 py-2 text-sm font-semibold">Timeline</span>
        </div>
      </header>
      <p className="text-sm text-ink-2">Click empty cells on one night to pick cabins, then book them together. Click a booking to open it.</p>
      <TimelineGrid
        today={today}
        dates={t.dates.map((d) => ({ date: d.date, wd: WD[new Date(`${d.date}T00:00:00Z`).getUTCDay()], n: Number(d.date.slice(8)), price: tk(d.rate), blocked: t.blocked.has(d.date) }))}
        rows={rows}
      />
      <div className="grid grid-cols-3 gap-3">
        <div className="card px-4 py-4"><div className="text-xs font-semibold text-ink-muted">Nights in view</div><div className="font-display text-[26px] font-semibold">{DAYS}</div></div>
        <div className="card px-4 py-4"><div className="text-xs font-semibold text-ink-muted">Cabin-nights sold</div><div className="font-display text-[26px] font-semibold">{sold} <span className="font-sans text-sm font-medium text-ink-muted">of {sellable}</span></div></div>
        <div className="card px-4 py-4"><div className="text-xs font-semibold text-ink-muted">Held, not yet paid</div><div className="font-display text-[26px] font-semibold">{held}</div></div>
      </div>
    </div>
  );
}
