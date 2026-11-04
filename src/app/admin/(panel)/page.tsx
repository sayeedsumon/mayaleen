import { Banner, Card, Check, Chip, Empty, Icon, Stat } from "@/components/ui";
import { countdown, fmtDate, fmtDateLong, fmtDateTime, fmtTime, plural, tk } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { can } from "@/server/auth/permissions";
import { dashboard } from "@/server/queries";
import { approveAction } from "../_actions/booking";

const ACTION_LABEL: Record<string, string> = {
  CREATED: "created a booking", APPROVE: "approved a booking", REJECT: "rejected a booking", CANCEL: "cancelled a booking",
  PROOF_SUBMITTED: "uploaded a payment proof", PAYMENT_VERIFIED: "verified a payment", PAYMENT_REJECTED: "rejected a payment proof",
  MANUAL_PAYMENT: "recorded a bank payment", CHECK_IN: "checked guests in", CHECK_OUT: "checked guests out",
  HOLD_EXPIRED: "hold expired", INVOICE_REVISED: "revised an invoice", CHANGED: "changed a booking", REFUND: "recorded a refund",
  NID_VIEW: "viewed guest IDs", BLOCK: "blocked a date", UNBLOCK: "unblocked a date",
};

export default async function Today({ searchParams }: { searchParams: Promise<{ denied?: string; ok?: string; error?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const now = new Date();
  const d = await dashboard(now);
  const manage = can(user.role, "MANAGE_BOOKINGS");
  const awaitingDue = d.awaiting.reduce((n, b) => n + (b.invoices[0]?.dueNow ?? 0), 0);
  const first = user.name.split(" ")[0];
  const hour = Number(fmtTime(now).slice(0, 2));
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const queue = d.pending.length + d.proofs.length + d.awaiting.length + d.balances.length;

  return (
    <div className="flex flex-col gap-6">
      {sp.denied && <Banner tone="warn">You do not have permission for that page.</Banner>}
      <Banner tone="ok">{sp.ok}</Banner>
      <Banner>{sp.error}</Banner>
      <header className="flex flex-wrap items-end gap-4">
        <div className="min-w-[300px] flex-1">
          <div className="eyebrow">{fmtDateLong(d.today)}</div>
          <h1 className="h1 mt-0.5">{hello}, {first}</h1>
        </div>
        <form action="/admin/bookings" className="flex h-[42px] w-full max-w-[360px] items-center gap-2 rounded-[10px] border border-field bg-white px-3 text-ink-muted">
          <Icon name="search" size={16} />
          <label className="sr-only" htmlFor="q">Search bookings</label>
          <input id="q" name="q" placeholder="Reference, name, mobile or NID" className="flex-1 border-0 bg-transparent text-sm text-ink outline-none" />
        </form>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat href="#queue" label="Needs approval" value={d.pending.length}
          note={d.pending[0] ? `Next hold ends ${countdown(d.pending[0].holdExpiresAt, now)}` : "All caught up"} />
        <Stat href="/admin/payments" label="Payment proofs to verify" value={d.proofs.length}
          note={d.proofs.length ? `${tk(d.proofs.reduce((n, p) => n + p.amountClaimed, 0))} claimed` : "None waiting"} />
        <Stat href="#queue" label="Awaiting payment" value={d.awaiting.length} note={d.awaiting.length ? `${tk(awaitingDue)} due` : "Nothing owed"} />
        <Stat href="/admin/boarding" tone="lake" label="Next boarding"
          value={d.nextDate ? (d.nextDate === d.today ? "Today" : fmtDate(d.nextDate)) : "None"}
          note={d.nextGroup.length ? `${d.nextGroup.map((b) => (b.type === "FULL_BOAT" ? "Full boat" : `${b.nights.length} cabins`)).join(" + ")} · ${plural(d.nextGroup.reduce((n, b) => n + b.guests.length, 0), "guest")} · 13:00` : "No confirmed trips"} />
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <section id="queue" aria-labelledby="queue-h" className="card min-w-0 flex-[999_1_520px]">
          <div className="flex items-center justify-between border-b border-hair px-5 py-4">
            <h2 id="queue-h" className="text-[17px] font-semibold">Needs your action</h2>
            <span className="text-[13px] text-ink-muted">Soonest deadline first</span>
          </div>
          {queue === 0 && <Empty>Nothing needs you right now.</Empty>}

          {d.pending.map((b) => {
            const total = b.lines.reduce((n, l) => n + l.total, 0);
            return (
              <div key={b.id} className="flex flex-wrap items-center gap-4 border-b border-hair px-5 py-4 last:border-0">
                <Chip tone="amber">Approve</Chip>
                <div className="min-w-[240px] flex-1">
                  <a href={`/admin/bookings/${b.id}`} className="text-[15px] font-semibold text-ink no-underline hover:underline">{b.leadGuest.name} · {fmtDate(b.tripDate)}</a>
                  <div className="text-[13px] text-ink-2">{b.reference} · {b.type === "FULL_BOAT" ? "Full boat" : "Shared"} · {tk(total)} · {b.source.toLowerCase().replace("_", "-")}</div>
                </div>
                <div className="text-xs font-semibold text-amber-ink">Hold ends {fmtTime(b.holdExpiresAt)} ({countdown(b.holdExpiresAt, now)})</div>
                {manage && (
                  <div className="flex gap-2">
                    <a href={`/admin/bookings/${b.id}#decide`} className="btn-ghost btn-sm text-rose-ink">Reject</a>
                    <form action={approveAction.bind(null, b.id)}>
                      <input type="hidden" name="back" value="/admin" />
                      <button className="btn btn-sm">Approve &amp; invoice</button>
                    </form>
                  </div>
                )}
              </div>
            );
          })}

          {d.proofs.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-4 border-b border-hair px-5 py-4 last:border-0">
              <Chip tone="sky">Verify</Chip>
              <div className="min-w-[240px] flex-1">
                <div className="text-[15px] font-semibold">{p.invoice.booking.leadGuest.name} · {fmtDate(p.invoice.booking.tripDate)}</div>
                <div className="text-[13px] text-ink-2">{tk(p.amountClaimed)} · {p.senderBank ?? "bank transfer"}{p.txnId ? ` · txn ${p.txnId}` : ""} · sent {fmtDateTime(p.createdAt)}</div>
              </div>
              <a href={`/admin/payments?id=${p.id}`} className="btn btn-sm">Check &amp; verify</a>
            </div>
          ))}

          {d.awaiting.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-4 border-b border-hair px-5 py-4 last:border-0">
              <Chip>Waiting</Chip>
              <div className="min-w-[240px] flex-1">
                <a href={`/admin/bookings/${b.id}`} className="text-[15px] font-semibold text-ink no-underline hover:underline">{b.leadGuest.name} · {fmtDate(b.tripDate)}</a>
                <div className="text-[13px] text-ink-2">{b.invoices[0] ? `${tk(b.invoices[0].dueNow)} due ${fmtDateTime(b.paymentDueAt)}` : "Invoice not issued"} · no proof yet</div>
              </div>
              <a href={`tel:${b.leadGuest.mobile}`} className="btn-ghost btn-sm">Call {b.leadGuest.mobile}</a>
            </div>
          ))}

          {d.balances.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-4 border-b border-hair px-5 py-4 last:border-0">
              <Chip tone="lake">Balance</Chip>
              <div className="min-w-[240px] flex-1">
                <a href={`/admin/bookings/${b.id}`} className="text-[15px] font-semibold text-ink no-underline hover:underline">{b.leadGuest.name} · {fmtDate(b.tripDate)}</a>
                <div className="text-[13px] text-ink-2">{tk((b.invoices[0]?.total ?? 0) - (d.paid.get(b.id) ?? 0))} due {fmtDateTime(b.balanceDueAt)}</div>
              </div>
              <a href={`tel:${b.leadGuest.mobile}`} className="btn-ghost btn-sm">Call {b.leadGuest.mobile}</a>
            </div>
          ))}
        </section>

        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-5">
          <Card title={d.nextDate ? `Boarding · ${fmtDate(d.nextDate)}, 13:00` : "Next boarding"}>
            {d.nextGroup.length === 0 && <Empty>No confirmed trips coming up.</Empty>}
            <div className="flex flex-col gap-4">
              {d.nextGroup.map((b) => (
                <div key={b.id} className="flex flex-col gap-2.5">
                  <a href={`/admin/bookings/${b.id}`} className="font-semibold text-ink no-underline hover:underline">{b.leadGuest.name} · {b.type === "FULL_BOAT" ? "full boat" : `${b.nights.length} cabins`}</a>
                  <Check ok={b.paid >= (b.invoices[0]?.total ?? 1)}>{b.paid >= (b.invoices[0]?.total ?? 1) ? `Paid in full · ${tk(b.paid)}` : `Balance ${tk((b.invoices[0]?.total ?? 0) - b.paid)} not paid`}</Check>
                  <Check ok={b.idsRecorded >= b.adults && b.adults > 0}>NIDs collected: {b.idsRecorded} of {b.adults} adults</Check>
                  <Check ok>Meals: {b.meals} per sitting</Check>
                </div>
              ))}
            </div>
            {d.nextGroup.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={`/admin/boarding?date=${d.nextDate}`} className="btn flex-1">Start check-in</a>
                <a href={`/admin/manifest?date=${d.nextDate}`} className="btn-ghost flex-1">Kitchen sheet</a>
              </div>
            )}
          </Card>

          <Card title="Next 7 nights">
            <div className="flex flex-col gap-2.5">
              {d.week.map((w) => {
                const sold = w.cabins.filter((c) => c !== "free").length;
                return (
                  <a key={w.date} href={`/admin/calendar?month=${w.date.slice(0, 7)}&day=${w.date}`} className="flex items-center gap-3 text-[13px] text-ink no-underline hover:text-ink">
                    <span className="w-[72px] font-semibold">{fmtDate(w.date).replace(/ \w+$/, "")}</span>
                    <span className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${w.cabins.length || 1}, minmax(0, 1fr))` }}>
                      {w.cabins.map((c, i) => (
                        <span key={i} className={`h-2 rounded ${c === "confirmed" ? "bg-lake" : c === "held" ? "bg-amber" : "border-[1.5px] border-[#9AA4A1]"}`} />
                      ))}
                    </span>
                    <span className="w-24 text-right text-ink-2">{w.full ? "Full boat" : sold === 0 ? "Open" : w.cabins.length - sold < 2 ? "Sold out" : `${w.cabins.length - sold} free`}</span>
                  </a>
                );
              })}
            </div>
          </Card>

          <Card title="Latest activity">
            {d.activity.length === 0 && <Empty>No activity yet.</Empty>}
            <div className="flex flex-col gap-2">
              {d.activity.map((a) => (
                <div key={a.id} className="text-[13px] leading-5 text-ink-2">
                  <strong className="text-ink">{fmtDateTime(a.at)}</strong> · {a.who} {ACTION_LABEL[a.action] ?? a.action.toLowerCase().replace(/_/g, " ")}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
