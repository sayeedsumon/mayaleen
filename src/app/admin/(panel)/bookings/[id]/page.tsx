import { notFound } from "next/navigation";
import { Card, ErrorBanner, StatusBadge, btnCls, btnDangerCls, btnGhostCls, inputCls } from "../../../../../components/ui";
import { countdown, fmtDate, fmtDateTime, tk } from "../../../../../lib/format";
import { requireUser } from "../../../../../server/auth/current-user";
import { can } from "../../../../../server/auth/permissions";
import { prisma } from "../../../../../server/db";
import { bookingDetail } from "../../../../../server/queries";
import { duplicateTxn } from "../../../../../server/workflow-service";
import { decryptField } from "../../../../../server/crypto";
import * as A from "../../../actions";

function Reason({ name = "reason", required = true }: { name?: string; required?: boolean }) {
  return <input name={name} required={required} placeholder="Reason" className={`${inputCls} max-w-xs`} />;
}

const CHANGEABLE = ["PENDING_APPROVAL", "AWAITING_PAYMENT", "CONFIRMED_BALANCE_DUE", "CONFIRMED_PAID"];

export default async function BookingPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser("VIEW_OPERATIONS");
  const { id } = await params;
  const { error } = await searchParams;
  const b = await bookingDetail(id);
  if (!b) notFound();
  const manage = can(user.role, "MANAGE_BOOKINGS");
  const leadNid = decryptField(b.leadGuest.nid);
  if (leadNid) await prisma.auditLog.create({ data: { entity: "Booking", entityId: id, action: "NID_VIEW", actor: user.id } }); // FR-A27
  const inv = b.invoices[0];
  const payments = b.invoices.flatMap((i) => i.payments.map((p) => ({ ...p, invoiceNumber: i.number })));
  const dupes = new Map(await Promise.all(payments.filter((p) => p.status === "SUBMITTED").map(async (p) => [p.id, await duplicateTxn(p.id)] as const)));
  const bands = await prisma.ageBand.findMany({ orderBy: { minAge: "desc" } });
  const adults = b.guests.filter((g) => /^adult/i.test(g.ageBandName)).length;
  const s = b.status;
  const open = ["PENDING_APPROVAL", "AWAITING_PAYMENT", "PAYMENT_SUBMITTED", "CONFIRMED_BALANCE_DUE", "CONFIRMED_PAID"].includes(s);
  const bind = <T extends (id: string, f: FormData) => Promise<unknown>>(fn: T) => fn.bind(null, id) as unknown as (f: FormData) => Promise<void>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{b.reference}</h1>
        <StatusBadge status={s} />
        {manage && CHANGEABLE.includes(s) && <a href={`/admin/bookings/${id}/edit`} className="text-sm underline">Edit booking</a>}
        {inv && <a href={`/admin/invoices/${inv.id}`} className="text-sm underline">View invoice</a>}
        <span className="text-sm text-slate-600">{b.type === "FULL_BOAT" ? "Full boat" : "Shared"} · {fmtDate(b.tripDate)} · {b.source.toLowerCase().replace("_", "-")}</span>
      </div>
      <ErrorBanner message={error} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Lead guest">
          <p className="font-medium">{b.leadGuest.name}</p>
          <p className="text-sm">{b.leadGuest.mobile}{b.leadGuest.email && ` · ${b.leadGuest.email}`}</p>
          <p className="text-sm text-slate-600">NID: {leadNid ?? "-"}</p>
          {b.notes && <p className="mt-2 text-sm">Notes: {b.notes}</p>}
          <p className="mt-2 text-xs text-slate-500">Guest link: /booking/{b.accessToken}</p>
        </Card>
        <Card title="Cabins and guests">
          <ul className="text-sm">
            {b.nights.map((n) => <li key={n.id}>{n.cabin.name} ({n.cabin.cabinType.name}){n.guests > 0 && ` · ${n.guests} guests`}</li>)}
            {b.nights.length === 0 && <li className="text-slate-500">Cabins released</li>}
          </ul>
          <p className="mt-2 text-sm">{b.guests.length} guests: {bands.map((x) => `${b.guests.filter((g) => g.ageBandName === x.name).length} ${x.name}`).join(", ")}</p>
          {["PENDING_APPROVAL", "AWAITING_PAYMENT"].includes(s) && (
            <p className="mt-2 text-sm text-amber-700">Hold expires {fmtDateTime(b.holdExpiresAt)} ({countdown(b.holdExpiresAt)})</p>
          )}
        </Card>
      </div>

      <Card title="Price">
        <table className="w-full text-sm">
          <tbody>
            {b.lines.map((l) => (
              <tr key={l.id}><td>{l.description}</td><td className="text-right">{l.qty} × {tk(l.unitPrice)}</td><td className="w-28 text-right">{tk(l.total)}</td></tr>
            ))}
            <tr className="border-t font-semibold"><td colSpan={2}>Total</td><td className="text-right">{tk(b.total)}</td></tr>
            <tr><td colSpan={2}>Verified paid</td><td className="text-right">{tk(b.paid)}</td></tr>
            <tr className="font-medium"><td colSpan={2}>Outstanding</td><td className="text-right">{tk(b.outstanding)}</td></tr>
          </tbody>
        </table>
        {inv && (
          <p className="mt-2 text-xs text-slate-600">
            Invoice {inv.number} rev {inv.revision} · {b.paymentOption === "ADVANCE" ? `advance ${tk(inv.dueNow)} by ${fmtDateTime(inv.dueNowAt)}, balance ${tk(inv.balance)} by ${fmtDateTime(inv.balanceAt)}` : `full ${tk(inv.total)} by ${fmtDateTime(inv.dueNowAt)}`}
          </p>
        )}
      </Card>

      {payments.length > 0 && (
        <Card title="Payments">
          <ul className="divide-y text-sm">
            {payments.map((p) => (
              <li key={p.id} className="py-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <span>{p.isRefund ? "Refund " : ""}{tk(p.amountClaimed)} · {p.status.toLowerCase()} · txn {p.txnId ?? "-"} · {p.senderName ?? ""} {p.senderBank ?? ""}</span>
                  <span className="text-slate-500">{p.invoiceNumber} · {fmtDateTime(p.createdAt)}</span>
                </div>
                {p.proofUrl && <a className="text-xs underline" href={p.proofUrl}>View proof</a>}
                {p.rejectReason && <p className="text-xs text-red-700">{p.rejectReason}</p>}
                {p.status === "SUBMITTED" && manage && (
                  <form action={A.verifyPaymentAction.bind(null, p.id, id)} className="mt-2 flex flex-wrap items-center gap-2">
                    {dupes.get(p.id) && <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-700">Duplicate transaction id</span>}
                    <input name="received" type="number" min={1} defaultValue={p.amountClaimed} className={`${inputCls} w-36`} aria-label="Amount received in bank" />
                    <button name="decision" value="verify" className={btnCls}>Verify (funds received)</button>
                    <input name="reason" placeholder="Reject reason" className={`${inputCls} w-48`} />
                    <button name="decision" value="reject" className={btnDangerCls}>Reject</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {manage && (
        <Card title="Actions">
          <div className="flex flex-wrap gap-4">
            {s === "PENDING_APPROVAL" && (
              <>
                <form action={bind(A.approveAction)} className="flex items-center gap-2">
                  <select name="paymentOption" defaultValue={b.paymentOption} className={`${inputCls} w-40`}>
                    <option value="FULL">Full payment</option><option value="ADVANCE">Advance</option>
                  </select>
                  <button className={btnCls}>Approve and invoice</button>
                </form>
                <form action={bind(A.rejectAction)} className="flex items-center gap-2"><Reason /><button className={btnDangerCls}>Reject</button></form>
              </>
            )}
            {["PENDING_APPROVAL", "AWAITING_PAYMENT"].includes(s) && (
              <form action={bind(A.extendAction)} className="flex flex-wrap items-center gap-2">
                <input type="datetime-local" name="until" required className={`${inputCls} w-52`} />
                <Reason /><button className={btnGhostCls}>Extend deadline</button>
              </form>
            )}
            {["AWAITING_PAYMENT", "PAYMENT_SUBMITTED", "CONFIRMED_BALANCE_DUE"].includes(s) && (
              <form action={bind(A.manualPaymentAction)} className="flex flex-wrap items-center gap-2">
                <input name="amount" type="number" min={1} required placeholder="Amount" className={`${inputCls} w-32`} />
                <input name="txnId" placeholder="Txn / bank ref" className={`${inputCls} w-40`} />
                <input name="sender" placeholder="Sender" className={`${inputCls} w-36`} />
                <button className={btnGhostCls}>Record bank payment</button>
              </form>
            )}
            {b.type === "FULL_BOAT" && open && (
              <form action={bind(A.foodAction)} className="flex flex-wrap items-center gap-2">
                {bands.map((x, i) => {
                  const cur = b.lines.find((l) => l.kind === "FOOD" && l.description.endsWith(x.name))?.qty ?? 0;
                  return <label key={x.id} className="text-sm">{x.name} meals <input type="number" min={0} name={`f${i}`} defaultValue={cur} className="w-16 rounded border p-1" /></label>;
                })}
                <button className={btnGhostCls}>Update food</button>
              </form>
            )}
            {open && (
              <form action={bind(A.cancelAction)} className="flex items-center gap-2"><Reason /><button className={btnDangerCls}>Cancel booking</button></form>
            )}
            {["CONFIRMED_BALANCE_DUE", "CONFIRMED_PAID"].includes(s) && (
              <form action={bind(A.noShowAction)} className="flex items-center gap-2"><Reason /><button className={btnDangerCls}>Mark no-show</button></form>
            )}
            {b.paid > 0 && (
              <form action={bind(A.refundAction)} className="flex flex-wrap items-center gap-2">
                <input name="amount" type="number" min={1} max={b.paid} required placeholder="Refund amount" className={`${inputCls} w-36`} />
                <input name="txnId" required placeholder="Bank ref" className={`${inputCls} w-36`} />
                <Reason /><button className={btnGhostCls}>Record refund</button>
              </form>
            )}
          </div>
        </Card>
      )}

      {s === "CONFIRMED_PAID" && (
        <Card title="Check-in (NID / passport of every adult)">
          <form action={bind(A.checkInAction)} className="space-y-2">
            <input type="hidden" name="count" value={Math.max(adults, 1)} />
            {Array.from({ length: Math.max(adults, 1) }, (_, k) => (
              <div key={k} className="grid gap-2 md:grid-cols-2">
                <input name={`name${k}`} required placeholder={`Adult ${k + 1} name`} defaultValue={k === 0 ? b.leadGuest.name : ""} className={inputCls} />
                <input name={`nid${k}`} required placeholder="NID or passport" defaultValue={k === 0 ? leadNid ?? "" : ""} className={inputCls} />
              </div>
            ))}
            <p className="text-xs text-slate-500">Booked with {adults} adult(s). Change the count in the booking first if more arrive.</p>
            <button className={btnCls}>Check in</button>
          </form>
        </Card>
      )}
      {s === "CONFIRMED_BALANCE_DUE" && (
        <p className="rounded bg-amber-50 p-3 text-sm text-amber-800">Check-in blocked: balance of {tk(b.outstanding)} is not yet verified.</p>
      )}
      {s === "CHECKED_IN" && (
        <Card title="Check-out">
          <form action={bind(A.checkOutAction)} className="flex items-center gap-2">
            <input name="notes" placeholder="Notes (damages, feedback)" className={`${inputCls} max-w-md`} />
            <button className={btnCls}>Check out</button>
          </form>
        </Card>
      )}

      <Card title="History">
        <ul className="space-y-1 text-xs text-slate-600">
          {b.audit.map((a) => (
            <li key={a.id}>{fmtDateTime(a.at)} · {a.action} · {a.actor}{a.reason && ` · ${a.reason}`}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
