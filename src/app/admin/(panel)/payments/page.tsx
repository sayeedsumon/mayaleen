import Link from "next/link";
import { Banner, Card, Check, Chip, Empty, PageHeader } from "@/components/ui";
import { fmtDate, fmtDateTime, tk } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { can } from "@/server/auth/permissions";
import { paymentsPage } from "@/server/queries";
import { manualPaymentAction, refundAction, verifyPaymentAction } from "../../_actions/money";

type Tab = "verify" | "verified" | "rejected" | "refunds";
const REJECT = ["Not in bank account", "Amount does not match", "Screenshot unclear", "Wrong booking reference", "Duplicate transaction"];

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ tab?: string; id?: string; ok?: string; error?: string; new?: string }> }) {
  const user = await requireUser("VIEW_OPERATIONS");
  const sp = await searchParams;
  const tab = (["verify", "verified", "rejected", "refunds"].includes(sp.tab ?? "") ? sp.tab : "verify") as Tab;
  const data = await paymentsPage(tab);
  const manage = can(user.role, "MANAGE_BOOKINGS");
  const current = tab === "verify" ? data.rows.find((r) => r.id === sp.id) ?? data.rows[0] : undefined;
  const back = `/admin/payments?tab=${tab}`;

  return (
    <div className="flex flex-col gap-[18px]">
      <Banner tone="ok">{sp.ok}</Banner>
      <Banner>{sp.error}</Banner>
      <PageHeader eyebrow="Bank transfers only" title="Payments">
        {manage && <Link href="?new=payment" className="btn-ghost">Record bank payment</Link>}
        {manage && <Link href="?new=refund&tab=refunds" className="btn-ghost">Record refund</Link>}
      </PageHeader>

      {manage && sp.new && (
        <Card title={sp.new === "refund" ? "Record a refund" : "Record a bank payment the guest did not upload"}>
          <form action={sp.new === "refund" ? refundAction : manualPaymentAction} className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            <input type="hidden" name="back" value={back} />
            <label className="label">Booking reference<input name="reference" required placeholder="MYL-…" className="input uppercase" /></label>
            <label className="label">Amount (Tk)<input name="amount" required inputMode="numeric" className="input" /></label>
            <label className="label">{sp.new === "refund" ? "Bank reference" : "Txn / bank ref"}<input name="txnId" required={sp.new === "refund"} className="input" /></label>
            {sp.new === "refund"
              ? <label className="label">Reason<input name="reason" required className="input" /></label>
              : <label className="label">Sender<input name="sender" className="input" /></label>}
            <button className="btn self-end">{sp.new === "refund" ? "Record refund" : "Record & verify"}</button>
          </form>
        </Card>
      )}

      <div role="tablist" aria-label="Payment status" className="flex flex-wrap gap-1.5">
        {([["verify", "To verify"], ["verified", "Verified"], ["rejected", "Rejected"], ["refunds", "Refunds"]] as const).map(([k, l]) => (
          <Link key={k} role="tab" aria-selected={tab === k} href={`?tab=${k}`}
            className={`flex h-[38px] items-center rounded-full border px-3.5 text-sm no-underline ${tab === k ? "border-ink bg-ink text-white hover:text-white" : "border-field bg-white text-ink hover:text-ink"}`}>
            {l} · {data.counts[k]}
          </Link>
        ))}
      </div>

      {tab === "verify" && !current && <Card><Empty>No payment proofs waiting. New uploads from guests appear here.</Empty></Card>}

      {current && (() => {
        const bk = current.invoice.booking;
        const dueNow = current.invoice.dueNow;
        const outstanding = current.invoice.total - current.bookingPaid;
        const expected = bk.status === "CONFIRMED_BALANCE_DUE" ? outstanding : dueNow;
        const others = data.rows.filter((r) => r.id !== current.id);
        return (
          <section aria-labelledby="pv-h" className="card flex flex-wrap">
            <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-2.5 border-b border-hair p-[18px] md:border-b-0 md:border-r">
              <div className="text-[13px] font-semibold text-ink-2">Guest&apos;s screenshot</div>
              {current.proofUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <a href={current.proofUrl} target="_blank" rel="noreferrer"><img src={current.proofUrl} alt="Payment screenshot" className="max-h-[420px] w-full rounded-[10px] object-contain" /></a>
              ) : (
                <div className="flex h-[300px] items-center justify-center rounded-[10px] p-5 text-center text-[13px] text-ink-2" style={{ background: "repeating-linear-gradient(135deg,#F2EFE8 0 10px,#ECE8DF 10px 20px)" }}>
                  No screenshot attached. Guest uploads arrive with the public website (Phase 3).
                </div>
              )}
              {others.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5">
                  <div className="text-xs font-semibold text-ink-muted">Also waiting</div>
                  {others.map((o) => <Link key={o.id} href={`?id=${o.id}`} className="text-[13px]">{o.invoice.booking.leadGuest.name} · {tk(o.amountClaimed)}</Link>)}
                </div>
              )}
            </div>
            <div className="flex min-w-0 flex-[999_1_420px] flex-col gap-3.5 p-5">
              <div>
                <div className="eyebrow">Proof uploaded {fmtDateTime(current.createdAt)}</div>
                <h2 id="pv-h" className="mt-0.5 font-display text-2xl font-semibold">{bk.leadGuest.name} · {bk.status === "CONFIRMED_BALANCE_DUE" ? "balance" : current.invoice.balance > 0 ? "advance" : "full payment"}</h2>
                <div className="mt-1 text-[13px] text-ink-2"><a href={`/admin/bookings/${bk.id}`}>{bk.reference}</a> · {fmtDate(bk.tripDate)} · {bk.type === "FULL_BOAT" ? "full boat" : bk.nights.map((n) => n.cabin.name).join(", ")} · invoice {current.invoice.number}</div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-xl bg-sand px-4 py-3.5 text-sm">
                <div><div className="text-xs font-semibold text-ink-muted">Guest says they sent</div><div className="font-semibold">{tk(current.amountClaimed)}</div></div>
                <div><div className="text-xs font-semibold text-ink-muted">Expected now</div><div>{tk(expected)}</div></div>
                <div><div className="text-xs font-semibold text-ink-muted">Transaction ID</div><div>{current.txnId ?? "–"}</div></div>
                <div><div className="text-xs font-semibold text-ink-muted">Sent</div><div>{fmtDateTime(current.transferAt)}</div></div>
                <div><div className="text-xs font-semibold text-ink-muted">Sender</div><div>{current.senderName ?? "–"}</div></div>
                <div><div className="text-xs font-semibold text-ink-muted">From</div><div>{current.senderBank ?? "–"}</div></div>
              </div>
              <div className="flex flex-col gap-2">
                <Check ok={!current.duplicate}>{current.duplicate ? "This transaction ID is used on another payment" : current.txnId ? "Transaction ID not used on any other payment" : "No transaction ID given"}</Check>
                <Check ok={current.amountClaimed === expected}>{current.amountClaimed === expected ? "Amount matches what is due" : `Amount differs from the ${tk(expected)} due`}</Check>
                <Check ok={false}>Check the money arrived in the bank account before verifying</Check>
              </div>
              {manage ? (
                <form action={verifyPaymentAction.bind(null, current.id)} className="flex flex-col gap-3">
                  <input type="hidden" name="back" value={back} />
                  <label className="label text-sm font-semibold text-ink">Amount that arrived in the bank
                    <input name="received" inputMode="numeric" defaultValue={current.amountClaimed} className="input h-[42px] max-w-[240px] text-[15px] font-semibold" />
                    <span className="text-xs font-normal text-ink-muted">Enter what the bank statement shows, not what the guest typed.</span>
                  </label>
                  <div className="flex flex-wrap items-end gap-2">
                    <button name="decision" value="verify" className="btn h-[46px] flex-[1_1_200px] text-[15px]">Verify payment</button>
                    <label className="label flex-[1_1_200px] text-xs font-semibold text-ink-muted">Or reject with a reason
                      <select name="reason" className="input h-[46px]">{REJECT.map((r) => <option key={r}>{r}</option>)}</select></label>
                    <button name="decision" value="reject" className="btn-danger h-[46px]">Reject</button>
                  </div>
                </form>
              ) : <p className="text-sm text-ink-muted">A manager verifies payments.</p>}
            </div>
          </section>
        );
      })()}

      {tab !== "verify" && (
        <section className="card overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead><tr className="text-left text-xs text-ink-muted">
              <th className="border-b border-line px-5 py-2.5 font-semibold">When</th>
              <th className="border-b border-line px-2 py-2.5 font-semibold">Guest</th>
              <th className="border-b border-line px-2 py-2.5 font-semibold">Booking</th>
              <th className="border-b border-line px-2 py-2.5 font-semibold">Transaction</th>
              <th className="border-b border-line px-2 py-2.5 font-semibold">{tab === "rejected" ? "Reason" : "By"}</th>
              <th className="border-b border-line px-5 py-2.5 text-right font-semibold">Amount</th>
            </tr></thead>
            <tbody>
              {data.rows.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap border-b border-hair px-5 py-3">{fmtDateTime(p.verifiedAt ?? p.createdAt)}</td>
                  <td className="border-b border-hair px-2 py-3 font-medium">{p.invoice.booking.leadGuest.name}</td>
                  <td className="border-b border-hair px-2 py-3"><a href={`/admin/bookings/${p.invoice.bookingId}`}>{p.invoice.booking.reference}</a></td>
                  <td className="border-b border-hair px-2 py-3 text-ink-2">{[p.senderBank, p.txnId].filter(Boolean).join(" · ") || "–"}{p.duplicate && <> <Chip tone="rose">Duplicate</Chip></>}</td>
                  <td className="border-b border-hair px-2 py-3 text-ink-2">{tab === "rejected" ? p.rejectReason : p.verifiedByName ?? "–"}</td>
                  <td className="tabnum border-b border-hair px-5 py-3 text-right font-semibold">{p.isRefund ? `− ${tk(p.amountReceived ?? 0)}` : tk(p.amountReceived ?? p.amountClaimed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.rows.length === 0 && <Empty>Nothing here yet.</Empty>}
        </section>
      )}
    </div>
  );
}
