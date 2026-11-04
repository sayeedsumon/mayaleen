import Link from "next/link";
import type { BookingStatus } from "@prisma/client";
import { Empty, Icon, PageHeader, StatusChip } from "@/components/ui";
import { fmtDate, fmtDateTime, SOURCE_LABEL, tk } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { searchBookings } from "@/server/queries";

type SP = { q?: string; status?: string; type?: string; source?: string; when?: string; page?: string };

const TABS: [string, string, BookingStatus[]][] = [
  ["", "All", []],
  ["PENDING_APPROVAL", "Needs approval", ["PENDING_APPROVAL"]],
  ["AWAITING_PAYMENT", "Awaiting payment", ["AWAITING_PAYMENT"]],
  ["PAYMENT_SUBMITTED", "Proof to verify", ["PAYMENT_SUBMITTED"]],
  ["CONFIRMED_BALANCE_DUE", "Balance due", ["CONFIRMED_BALANCE_DUE"]],
  ["CONFIRMED_PAID", "Paid", ["CONFIRMED_PAID"]],
  ["CHECKED_IN", "On board", ["CHECKED_IN"]],
  ["CANCELLED", "Cancelled", ["CANCELLED"]],
];

function nextStep(b: Awaited<ReturnType<typeof searchBookings>>["rows"][number]): [string, string] {
  const inv = b.invoices[0];
  const due = inv ? inv.total - b.paid : 0;
  switch (b.status) {
    case "PENDING_APPROVAL": return [`Approve by ${fmtDateTime(b.holdExpiresAt)}`, "text-amber-ink"];
    case "AWAITING_PAYMENT": return [`${tk(inv?.dueNow ?? 0)} due ${fmtDateTime(b.paymentDueAt)}`, "text-amber-ink"];
    case "PAYMENT_SUBMITTED": return ["Verify the payment proof", "text-sky-ink"];
    case "CONFIRMED_BALANCE_DUE": return [`Balance ${tk(due)} by ${fmtDateTime(b.balanceDueAt)}`, "text-ink-2"];
    case "CONFIRMED_PAID": {
      const adults = b.guests.filter((g) => /^adult/i.test(g.ageBandName)).length;
      const ids = b.guests.filter((g) => g.nidOrPassport).length;
      return [ids >= adults ? "Ready to board" : `Ready · ${adults - ids} NIDs at check-in`, "text-leaf-ink"];
    }
    case "CHECKED_IN": return ["On board · check out 11:00", "text-lake-dark"];
    default: return ["–", "text-ink-muted"];
  }
}

export default async function BookingsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser("VIEW_OPERATIONS");
  const sp = await searchParams;
  const r = await searchBookings({
    q: sp.q, status: (sp.status || undefined) as BookingStatus | undefined, type: (sp.type || undefined) as never,
    source: sp.source || undefined, when: sp.when, page: Number(sp.page) || 1,
  });
  const keep = (extra: Record<string, string>) => {
    const o: Record<string, string> = {};
    for (const [k, v] of Object.entries(sp)) if (v && k !== "page") o[k] = v;
    return new URLSearchParams({ ...o, ...extra }).toString();
  };
  const allCount = Object.values(r.counts).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <div className="flex flex-col gap-[18px]">
      <PageHeader eyebrow="All channels" title="Bookings">
        <a href={`/admin/bookings/export?${keep({})}`} className="btn-ghost"><Icon name="download" size={16} />Export CSV</a>
      </PageHeader>

      <div role="tablist" aria-label="Status" className="flex flex-wrap gap-1.5">
        {TABS.map(([key, label]) => {
          const on = (sp.status ?? "") === key;
          const count = key ? r.counts[key as BookingStatus] ?? 0 : allCount;
          return (
            <Link key={key || "all"} role="tab" aria-selected={on} href={`?${keep({ status: key })}`}
              className={`flex h-[38px] items-center gap-2 rounded-full border px-3.5 text-sm font-medium no-underline ${on ? "border-ink bg-ink text-white hover:text-white" : "border-field bg-white text-ink hover:text-ink"}`}>
              {label}
              <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${on ? "bg-ink-2 text-white" : "bg-sand-3 text-ink-2"}`}>{count}</span>
            </Link>
          );
        })}
      </div>

      <form className="card flex flex-wrap gap-2 p-3">
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        <label className="label flex-[2_1_260px] text-xs font-semibold text-ink-muted">Search<input name="q" defaultValue={sp.q} className="input" placeholder="Reference, name, mobile or NID" /></label>
        <label className="label flex-[1_1_140px] text-xs font-semibold text-ink-muted">Trip dates
          <select name="when" defaultValue={sp.when ?? ""} className="input"><option value="">Upcoming</option><option value="past">Past</option><option value="all">All dates</option></select></label>
        <label className="label flex-[1_1_140px] text-xs font-semibold text-ink-muted">Package
          <select name="type" defaultValue={sp.type ?? ""} className="input"><option value="">Shared + full boat</option><option value="SHARED">Shared</option><option value="FULL_BOAT">Full boat</option></select></label>
        <label className="label flex-[1_1_140px] text-xs font-semibold text-ink-muted">Source
          <select name="source" defaultValue={sp.source ?? ""} className="input"><option value="">Any source</option>{Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <button className="btn self-end">Search</button>
      </form>

      <section aria-label="Bookings" className="card overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-muted">
              <th className="border-b border-line px-4 py-3 font-semibold">Trip date</th>
              <th className="border-b border-line px-2 py-3 font-semibold">Guest</th>
              <th className="border-b border-line px-2 py-3 font-semibold">Package</th>
              <th className="border-b border-line px-2 py-3 font-semibold">Status</th>
              <th className="border-b border-line px-2 py-3 text-right font-semibold">Total</th>
              <th className="border-b border-line px-2 py-3 text-right font-semibold">Paid</th>
              <th className="border-b border-line px-4 py-3 font-semibold">Next step</th>
            </tr>
          </thead>
          <tbody>
            {r.rows.map((b) => {
              const total = b.invoices[0]?.total ?? 0;
              const [next, nextCls] = nextStep(b);
              const adults = b.guests.filter((g) => /^adult/i.test(g.ageBandName)).length;
              return (
                <tr key={b.id} className="hover:bg-panel">
                  <td className="whitespace-nowrap border-b border-hair px-4 py-3.5">
                    <div className="font-semibold">{fmtDate(b.tripDate)}</div>
                    <div className="text-xs text-ink-muted">{b.reference}</div>
                  </td>
                  <td className="border-b border-hair px-2 py-3.5">
                    <a href={`/admin/bookings/${b.id}`} className="font-semibold text-ink no-underline hover:underline">{b.leadGuest.name}</a>
                    <div className="text-xs text-ink-muted">{b.leadGuest.mobile} · {SOURCE_LABEL[b.source]}</div>
                  </td>
                  <td className="border-b border-hair px-2 py-3.5">
                    <div>{b.type === "FULL_BOAT" ? "Full boat" : `Shared · ${b.nights.map((n) => n.cabin.name.replace("Cabin ", "")).join(", ")}`}</div>
                    <div className="text-xs text-ink-muted">{adults} adults{b.guests.length > adults ? `, ${b.guests.length - adults} children` : ""}</div>
                  </td>
                  <td className="border-b border-hair px-2 py-3.5"><StatusChip status={b.status} /></td>
                  <td className="tabnum border-b border-hair px-2 py-3.5 text-right">{total ? tk(total) : "–"}</td>
                  <td className="tabnum border-b border-hair px-2 py-3.5 text-right">
                    <div>{tk(b.paid)}</div>
                    <div className="ml-auto mt-1.5 h-1 w-[72px] rounded bg-hair"><div className="h-1 rounded bg-lake" style={{ width: `${total ? Math.min(100, (b.paid / total) * 100) : 0}%` }} /></div>
                  </td>
                  <td className={`border-b border-hair px-4 py-3.5 text-[13px] ${nextCls}`}>{next}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {r.rows.length === 0 && <Empty>No bookings match these filters.</Empty>}
        <div className="flex items-center justify-between px-4 py-3 text-[13px] text-ink-muted">
          {r.page > 1 ? <Link href={`?${keep({ page: String(r.page - 1) })}`}>← Previous</Link> : <span />}
          <span>{r.total} bookings · page {r.page} of {r.pages}</span>
          {r.page < r.pages ? <Link href={`?${keep({ page: String(r.page + 1) })}`}>Next →</Link> : <span />}
        </div>
      </section>
    </div>
  );
}
