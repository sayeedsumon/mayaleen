import Link from "next/link";
import { Banner, Card, Chip, Empty, Icon, PageHeader, StatusChip } from "@/components/ui";
import { fmtDate, initials, maskId, plural, tk } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { decryptField } from "@/server/crypto";
import { guestDetail, guestsList } from "@/server/queries";
import { guestNotesAction } from "../../_actions/settings";

export default async function GuestsPage({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; id?: string; ok?: string; error?: string }> }) {
  await requireUser("VIEW_OPERATIONS");
  const sp = await searchParams;
  const filter = sp.f === "repeat" ? "repeat" : undefined;
  const list = await guestsList(sp.q, filter);
  const chosen = sp.id ?? list.rows[0]?.id;
  const g = chosen ? await guestDetail(chosen) : null;
  const qs = (extra: Record<string, string>) => new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(filter ? { f: filter } : {}), ...extra }).toString();
  const sources = g ? [...new Set(g.bookings.map((b) => b.source))] : [];

  return (
    <div className="flex flex-col gap-[18px]">
      <Banner tone="ok">{sp.ok}</Banner>
      <Banner>{sp.error}</Banner>
      <PageHeader eyebrow="Everyone who has booked" title="Guests">
        <form className="flex h-[42px] w-full max-w-[360px] items-center gap-2 rounded-[10px] border border-field bg-white px-3 text-ink-muted">
          <Icon name="search" size={16} />
          <label htmlFor="gq" className="sr-only">Search guests</label>
          <input id="gq" name="q" defaultValue={sp.q} placeholder="Name, mobile or NID" className="flex-1 border-0 bg-transparent text-sm text-ink outline-none" />
        </form>
      </PageHeader>

      <div className="flex flex-wrap items-start gap-5">
        <section aria-label="Guest list" className="card min-w-0 flex-[1_1_380px] overflow-hidden">
          <div className="flex gap-1.5 border-b border-hair p-3">
            {([[undefined, `All · ${list.counts.all}`], ["repeat", `Repeat · ${list.counts.repeat}`]] as const).map(([k, l]) => (
              <Link key={l} href={`?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(k ? { f: k } : {}) })}`}
                className={`flex h-[34px] items-center rounded-full border px-3 text-[13px] no-underline ${filter === k ? "border-ink bg-ink text-white hover:text-white" : "border-field bg-white text-ink hover:text-ink"}`}>{l}</Link>
            ))}
          </div>
          {list.rows.length === 0 && <Empty>No guests found.</Empty>}
          {list.rows.map((r) => {
            const on = r.id === chosen;
            return (
              <Link key={r.id} href={`?${qs({ id: r.id })}`} className={`flex items-center gap-3 border-b border-hair px-4 py-3 no-underline hover:bg-panel ${on ? "bg-lake-soft" : ""}`}>
                <span className={`flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full text-[13px] font-semibold ${on ? "bg-lake text-white" : "bg-sand-3 text-ink-2"}`}>{initials(r.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{r.name}</span>
                  <span className="block text-xs text-ink-muted">{r.mobile} · {plural(r.trips, "trip")}</span>
                </span>
                {r.next && <span className="text-right text-xs text-ink-2">Next: {fmtDate(r.next)}</span>}
              </Link>
            );
          })}
        </section>

        {g && (
          <section aria-labelledby="g-h" className="flex min-w-0 flex-[1_1_460px] flex-col gap-4">
            <div className="card flex flex-col gap-3.5 p-5">
              <div className="flex flex-wrap items-center gap-3.5">
                <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-lake-soft text-[17px] font-semibold text-lake-dark">{initials(g.name)}</span>
                <div className="min-w-[200px] flex-1">
                  <h2 id="g-h" className="font-display text-2xl font-semibold">{g.name}</h2>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {g.trips > 1 && <Chip tone="lake">Repeat guest</Chip>}
                    {sources.map((s) => <Chip key={s}>Books via {s.toLowerCase().replace("_", "-")}</Chip>)}
                  </div>
                </div>
                <a href="/admin/calendar" className="btn">Book again</a>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-[10px] bg-sand px-3.5 py-3"><div className="text-xs font-semibold text-ink-muted">Trips</div><div className="font-display text-[22px] font-semibold">{g.trips}</div></div>
                <div className="rounded-[10px] bg-sand px-3.5 py-3"><div className="text-xs font-semibold text-ink-muted">Total paid</div><div className="font-display text-[22px] font-semibold">{tk(g.totalPaid)}</div></div>
                <div className="rounded-[10px] bg-sand px-3.5 py-3"><div className="text-xs font-semibold text-ink-muted">Usual party</div><div className="font-display text-[22px] font-semibold">{g.party}</div></div>
              </div>
              <div className="grid grid-cols-1 gap-2.5 text-sm sm:grid-cols-2">
                <div><div className="text-xs font-semibold text-ink-muted">Mobile</div><a href={`tel:${g.mobile}`}>{g.mobile}</a></div>
                <div><div className="text-xs font-semibold text-ink-muted">Email</div>{g.email ?? "–"}</div>
                <div><div className="text-xs font-semibold text-ink-muted">NID</div>{maskId(decryptField(g.nid))}</div>
                <div><div className="text-xs font-semibold text-ink-muted">Emergency contact</div>{g.emergencyContact ?? "–"}</div>
              </div>
              <form action={guestNotesAction.bind(null, g.id)} className="flex flex-col gap-2">
                <label className="label">Staff notes<textarea name="notes" defaultValue={g.notes ?? ""} className="input min-h-[72px] py-2.5" placeholder="Preferences, dietary needs, things to remember…" /></label>
                <button className="btn-ghost btn-sm self-start">Save notes</button>
              </form>
            </div>
            <Card title="Trips">
              {g.bookings.length === 0 && <Empty>No trips.</Empty>}
              {g.bookings.map((b) => (
                <a key={b.id} href={`/admin/bookings/${b.id}`} className="flex flex-wrap items-center gap-3 border-t border-hair py-3 text-ink no-underline hover:text-ink">
                  <span className="w-[110px] text-sm font-semibold">{fmtDate(b.tripDate)}</span>
                  <span className="min-w-[180px] flex-1 text-[13px] text-ink-2">{b.type === "FULL_BOAT" ? "Full boat" : `Shared · ${b.nights.map((n) => n.cabin.name).join(", ")}`} · {plural(b.guests.length, "guest")}</span>
                  <StatusChip status={b.status} />
                  <span className="tabnum w-24 text-right text-sm">{b.invoices[0] ? tk(b.invoices[0].total) : "–"}</span>
                </a>
              ))}
            </Card>
          </section>
        )}
      </div>
    </div>
  );
}
