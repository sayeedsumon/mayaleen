import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Banner, Card, Chip, Icon, Progress, StatusChip } from "@/components/ui";
import { fmtDate, fmtDateLong, fmtDateTime, maskId, SOURCE_LABEL, tk } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { can } from "@/server/auth/permissions";
import { decryptField } from "@/server/crypto";
import { prisma } from "@/server/db";
import { bookingDetail } from "@/server/queries";
import { toDhakaLocal } from "../../../_lib/form";
import * as B from "../../../_actions/booking";
import { manualPaymentAction, refundAction, verifyPaymentAction } from "../../../_actions/money";

const CHANGEABLE = ["PENDING_APPROVAL", "AWAITING_PAYMENT", "CONFIRMED_BALANCE_DUE", "CONFIRMED_PAID"];
const OPEN = ["PENDING_APPROVAL", "AWAITING_PAYMENT", "PAYMENT_SUBMITTED", "CONFIRMED_BALANCE_DUE", "CONFIRMED_PAID"];
const ORDER = ["PENDING_APPROVAL", "AWAITING_PAYMENT", "PAYMENT_SUBMITTED", "CONFIRMED_BALANCE_DUE", "CONFIRMED_PAID", "CHECKED_IN", "COMPLETED"];
const HISTORY: Record<string, string> = {
  CREATED: "Booking created, cabins held", APPROVE: "Approved, invoice issued", REJECT: "Rejected", CANCEL: "Cancelled",
  PROOF_SUBMITTED: "Payment proof uploaded", PAYMENT_VERIFIED: "Payment verified", PAYMENT_REJECTED: "Payment proof rejected",
  MANUAL_PAYMENT: "Bank payment recorded", ADVANCE_VERIFIED: "Advance confirmed", FULL_VERIFIED: "Paid in full",
  BALANCE_VERIFIED: "Balance paid", CHECK_IN: "Checked in", CHECK_OUT: "Checked out", HOLD_EXPIRED: "Hold expired",
  DEADLINE_EXTENDED: "Deadline extended", FOOD_CHANGED: "Food packages changed", CHANGED: "Booking changed",
  INVOICE_REVISED: "Invoice revised", REFUND: "Refund recorded", NO_SHOW: "Marked no-show", NID_VIEW: "Guest IDs viewed",
  PROOF_REJECTED: "Back to awaiting payment", PAYMENT_OPTION: "Payment option changed",
};

export default async function BookingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const user = await requireUser("VIEW_OPERATIONS");
  const { id } = await params;
  const sp = await searchParams;
  const b = await bookingDetail(id);
  if (!b) notFound();
  const manage = can(user.role, "MANAGE_BOOKINGS");
  const inv = b.invoices[0];
  const s = b.status;
  const bands = await prisma.ageBand.findMany({ orderBy: { minAge: "desc" } });
  const leadNid = decryptField(b.leadGuest.nid);
  const adults = b.guests.filter((g) => /^adult/i.test(g.ageBandName));
  const children = b.guests.length - adults.length;
  const idsRecorded = b.guests.filter((g) => g.nidOrPassport).length;
  const payments = b.invoices.flatMap((i) => i.payments.map((p) => ({ ...p, invoiceNumber: `${i.number} rev ${i.revision}` })));
  const here = `/admin/bookings/${id}`;
  const bound = <T extends (id: string, f: FormData) => Promise<unknown>>(fn: T) => fn.bind(null, id) as unknown as (f: FormData) => Promise<void>;
  const when = (action: string) => b.audit.filter((a) => a.action === action).at(-1)?.at;

  const closed = ["REJECTED", "EXPIRED", "CANCELLED", "NO_SHOW"].includes(s);
  const idx = ORDER.indexOf(s);
  const steps = [
    { label: "Requested", when: `${fmtDateTime(b.createdAt)} · ${SOURCE_LABEL[b.source]}`, done: true },
    { label: "Approved & invoiced", when: when("APPROVE") ? fmtDateTime(when("APPROVE")) : idx === 0 ? `Hold ends ${fmtDateTime(b.holdExpiresAt)}` : "–", done: idx >= 1 },
    { label: b.paymentOption === "ADVANCE" ? "Advance paid" : "Paid", when: idx >= 3 ? tk(Math.min(b.paid, inv?.dueNow ?? b.paid)) : inv ? `Due ${fmtDateTime(inv.dueNowAt)}` : "–", done: idx >= 3 },
    { label: "Balance paid", when: idx >= 4 ? "Paid in full" : inv?.balanceAt ? `Due ${fmtDateTime(inv.balanceAt)}` : "–", done: idx >= 4 },
    { label: "Checked in", when: b.checkedInAt ? fmtDateTime(b.checkedInAt) : `${fmtDate(b.tripDate)}, 13:00`, done: idx >= 5 },
  ];
  const current = steps.findIndex((x) => !x.done);

  return (
    <div className="flex flex-col gap-[18px]">
      <a href="/admin/bookings" className="flex items-center gap-1.5 text-[13px] font-medium no-underline"><Icon name="left" size={14} />Bookings</a>
      <Banner tone="ok">{sp.ok}</Banner>
      <Banner>{sp.error}</Banner>
      {b.cancelRequestedAt && !closed && (
        <Banner tone="warn">The guest asked to cancel on {fmtDateTime(b.cancelRequestedAt)}{b.cancelRequestReason ? `: “${b.cancelRequestReason}”` : "."} Call them, then cancel below if agreed.</Banner>
      )}

      <header className="flex flex-wrap items-start gap-4">
        <div className="min-w-[340px] flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-[30px] font-semibold">{b.leadGuest.name}</h1>
            <StatusChip status={s} />
          </div>
          <div className="mt-1.5 text-sm text-ink-2">
            {b.reference} · {fmtDateLong(b.tripDate)} · {b.type === "FULL_BOAT" ? "Full boat" : `Shared, ${b.nights.length} cabins`} · from {SOURCE_LABEL[b.source]}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {manage && CHANGEABLE.includes(s) && <a href={`${here}/edit`} className="btn-ghost">Change booking</a>}
          {inv && <a href={`/admin/invoices?id=${inv.id}`} className="btn-ghost">Invoice {inv.number}{inv.revision > 1 ? ` rev ${inv.revision}` : ""}</a>}
          {inv && <a href={`/admin/invoices/${inv.id}/print`} className="btn-ghost"><Icon name="print" size={16} />Print</a>}
        </div>
      </header>

      {!closed && (
        <ol aria-label="Booking progress" className="card grid grid-cols-2 gap-2 p-5 sm:grid-cols-5">
          {steps.map((st, k) => (
            <li key={st.label} className="flex flex-col gap-2">
              <span className={`h-1.5 rounded ${st.done ? "bg-lake" : k === current ? "bg-[linear-gradient(90deg,#0E5C56_50%,#D7E6E3_50%)]" : "bg-hair"}`} />
              <span className={`text-[13px] font-semibold ${st.done ? "text-ink" : k === current ? "text-lake-dark" : "text-ink-muted"}`}>{st.label}</span>
              <span className="text-xs text-ink-muted">{st.when}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
          <Card title="Trip">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {b.nights.map((n) => (
                <div key={n.id} className="rounded-[10px] bg-sand px-3.5 py-3">
                  <div className="text-xs font-semibold text-ink-muted">{n.cabin.name} · {n.cabin.cabinType.name}</div>
                  <div className="text-sm font-medium">{b.type === "FULL_BOAT" ? "Full boat" : `${n.guests} guests`}</div>
                </div>
              ))}
              {b.nights.length === 0 && <div className="text-sm text-ink-muted">Cabins released</div>}
            </div>
            <p className="mt-3.5 text-sm leading-[21px] text-ink-2">
              Boards 13:00 {fmtDate(b.tripDate)}, leaves 11:00 the next day. {b.type === "SHARED" ? "Food included." : `${b.lines.filter((l) => l.kind === "FOOD").reduce((n, l) => n + l.qty, 0)} food packages.`}
              {b.notes && <> Note: “{b.notes}”</>}
            </p>
            {b.checkoutNotes && <p className="mt-2 text-sm text-ink-2">Check-out notes: {b.checkoutNotes}</p>}
          </Card>

          <Card title="Price & payments" action={<span className="text-[13px] text-ink-muted">{b.paymentOption === "ADVANCE" ? "Advance chosen" : "Full payment chosen"}</span>}>
            <div className="flex flex-col gap-2.5">
              {b.lines.map((l) => (
                <div key={l.id} className={`flex justify-between text-sm ${l.kind === "DISCOUNT" ? "text-rose-ink" : "text-ink-2"}`}>
                  <span>{l.qty} × {l.description} · {tk(Math.abs(l.unitPrice))}</span><span className="tabnum">{l.total < 0 ? `− ${tk(-l.total)}` : tk(l.total)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-hair pt-2.5 text-[15px] font-semibold"><span>Total</span><span className="tabnum">{tk(b.total)}</span></div>
              <Progress value={b.paid} max={b.total} />
              <div className="flex flex-wrap justify-between gap-2 text-[13px]">
                <span className="font-semibold text-leaf-ink">Paid {tk(b.paid)}</span>
                {b.outstanding > 0 && <span className="font-semibold text-amber-ink">Still due {tk(b.outstanding)}{inv?.balanceAt && s === "CONFIRMED_BALANCE_DUE" ? ` by ${fmtDateTime(inv.balanceAt)}` : ""}</span>}
              </div>
            </div>

            {payments.length > 0 && (
              <div className="mt-3 flex flex-col border-t border-hair">
                {payments.map((p) => (
                  <div key={p.id} className="flex flex-col gap-2 border-b border-hair py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Chip tone={p.status === "VERIFIED" ? (p.isRefund ? "rose" : "leaf") : p.status === "REJECTED" ? "rose" : "sky"}>
                        {p.isRefund ? "Refund" : p.status === "VERIFIED" ? "Verified" : p.status === "REJECTED" ? "Rejected" : "To verify"}
                      </Chip>
                      <span className="min-w-[220px] flex-1 text-sm">{tk(p.amountReceived ?? p.amountClaimed)}{p.senderBank ? ` · ${p.senderBank}` : ""}{p.txnId ? ` · txn ${p.txnId}` : ""}</span>
                      <span className="text-xs text-ink-muted">{p.invoiceNumber} · {fmtDateTime(p.createdAt)}</span>
                    </div>
                    {p.rejectReason && <span className="text-xs text-rose-ink">{p.rejectReason}</span>}
                    {p.status === "SUBMITTED" && manage && (
                      <form action={verifyPaymentAction.bind(null, p.id)} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="back" value={here} />
                        <label className="label">Amount that arrived<input name="received" inputMode="numeric" defaultValue={p.amountClaimed} className="input w-36" /></label>
                        <button name="decision" value="verify" className="btn">Verify</button>
                        <input name="reason" placeholder="Reason to reject" className="input w-52" aria-label="Reject reason" />
                        <button name="decision" value="reject" className="btn-danger">Reject</button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}

            {manage && inv && ["AWAITING_PAYMENT", "PAYMENT_SUBMITTED", "CONFIRMED_BALANCE_DUE"].includes(s) && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-lake">Record a bank payment</summary>
                <form action={manualPaymentAction} className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <input type="hidden" name="bookingId" value={b.id} /><input type="hidden" name="back" value={here} />
                  <label className="label">Amount<input name="amount" required inputMode="numeric" defaultValue={b.outstanding || ""} className="input" /></label>
                  <label className="label">Txn / bank ref<input name="txnId" className="input" /></label>
                  <label className="label">Sender<input name="sender" className="input" /></label>
                  <label className="label">Sent at<input name="transferAt" type="datetime-local" className="input" /></label>
                  <button className="btn col-span-2 sm:col-span-1">Record &amp; verify</button>
                </form>
              </details>
            )}
            {manage && b.paid > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-lake">Record a refund</summary>
                <form action={refundAction} className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <input type="hidden" name="bookingId" value={b.id} /><input type="hidden" name="back" value={here} />
                  <label className="label">Amount<input name="amount" required inputMode="numeric" max={b.paid} className="input" /></label>
                  <label className="label">Bank ref<input name="txnId" required className="input" /></label>
                  <label className="label col-span-2">Reason<input name="reason" required className="input" /></label>
                  <button className="btn-ghost">Record refund</button>
                </form>
              </details>
            )}
          </Card>

          <Card title="Guests & IDs" action={<span className={`text-[13px] font-semibold ${idsRecorded >= adults.length ? "text-leaf-ink" : "text-amber-ink"}`}>{idsRecorded} of {adults.length} adult IDs recorded</span>}>
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] items-center gap-x-3 gap-y-2 text-sm">
              <span className="text-xs font-semibold text-ink-muted">Name</span><span className="text-xs font-semibold text-ink-muted">Age band</span>
              <span className="text-xs font-semibold text-ink-muted">Cabin</span><span className="text-xs font-semibold text-ink-muted">NID</span>
              {b.guests.sort((x, y) => Number(y.isLead) - Number(x.isLead)).map((g, k) => (
                <GuestRow key={g.id}
                  name={g.name ?? (g.isLead ? `${b.leadGuest.name} (lead)` : `${g.ageBandName} ${k + 1}`)}
                  band={g.ageBandName} cabin={g.cabinName ?? "–"}
                  id={g.nidOrPassport ? maskId(decryptField(g.nidOrPassport)) : g.isLead && leadNid ? maskId(leadNid) : /^adult/i.test(g.ageBandName) ? "Collect at check-in" : "–"}
                  muted={!g.name && !g.isLead} />
              ))}
            </div>
            {children > 0 && <p className="mt-2 text-xs text-ink-muted">Children do not need an NID.</p>}
          </Card>
        </div>

        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
          <NextStep b={b} manage={manage} here={here} bound={bound} />

          <Card title="Lead guest">
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="font-medium">{b.leadGuest.name}</div>
              <div><a href={`tel:${b.leadGuest.mobile}`}>{b.leadGuest.mobile}</a> · <a href={`https://wa.me/88${b.leadGuest.mobile.replace(/^\+?88/, "")}`}>WhatsApp</a></div>
              {b.leadGuest.email && <div className="text-ink-2">{b.leadGuest.email}</div>}
              <div className="text-ink-2">NID {maskId(leadNid)}</div>
              {b.leadGuest.emergencyContact && <div className="text-ink-2">Emergency: {b.leadGuest.emergencyContact}</div>}
              <a href={`/admin/guests?id=${b.leadGuestId}`} className="text-[13px] font-semibold">{b.earlierTrips ? `${b.earlierTrips} other trip${b.earlierTrips > 1 ? "s" : ""} · view guest` : "View guest"}</a>
            </div>
          </Card>

          <Card title="History">
            <div className="flex flex-col gap-3">
              {b.audit.filter((a) => a.action !== "NID_VIEW").map((a) => (
                <div key={a.id} className="flex gap-2.5">
                  <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-lake" />
                  <div className="text-[13px] leading-[19px]">
                    <div className="font-semibold">{HISTORY[a.action] ?? a.action}{a.reason ? ` · ${a.reason}` : ""}</div>
                    <div className="text-ink-muted">{a.who} · {fmtDateTime(a.at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {manage && OPEN.includes(s) && (
            <section className="card flex flex-col gap-3 p-5">
              {["PENDING_APPROVAL", "AWAITING_PAYMENT"].includes(s) && (
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-lake">Extend deadline</summary>
                  <form action={bound(B.extendAction)} className="mt-2 flex flex-col gap-2">
                    <input type="datetime-local" name="until" required defaultValue={toDhakaLocal(b.holdExpiresAt)} className="input" aria-label="New deadline" />
                    <input name="reason" required placeholder="Reason" className="input" aria-label="Reason" />
                    <button className="btn-ghost self-start">Extend</button>
                  </form>
                </details>
              )}
              {b.type === "FULL_BOAT" && (
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-lake">Change food packages</summary>
                  <form action={bound(B.foodAction)} className="mt-2 flex flex-wrap items-end gap-2">
                    {bands.map((x, i) => (
                      <label key={x.id} className="label">{x.name}<input name={`f${i}`} inputMode="numeric" className="input w-20"
                        defaultValue={b.lines.find((l) => l.kind === "FOOD" && l.description.endsWith(x.name))?.qty ?? 0} /></label>
                    ))}
                    <button className="btn-ghost">Update</button>
                  </form>
                </details>
              )}
              {["CONFIRMED_BALANCE_DUE", "CONFIRMED_PAID"].includes(s) && (
                <form action={bound(B.noShowAction)} className="flex gap-2">
                  <input name="reason" placeholder="No-show note" className="input" aria-label="No-show note" />
                  <button className="btn-danger whitespace-nowrap">Mark no-show</button>
                </form>
              )}
              <form action={bound(B.cancelAction)} className="flex gap-2">
                <input name="reason" required placeholder="Reason for cancelling" className="input" aria-label="Cancel reason" />
                <button className="btn-danger whitespace-nowrap">Cancel booking</button>
              </form>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function GuestRow({ name, band, cabin, id, muted }: { name: string; band: string; cabin: string; id: string; muted: boolean }) {
  return (
    <>
      <span className={muted ? "text-ink-muted" : "font-medium"}>{name}</span>
      <span>{band}</span>
      <span className="text-ink-2">{cabin}</span>
      <span className={id === "Collect at check-in" ? "text-ink-muted" : ""}>{id}</span>
    </>
  );
}

type Detail = NonNullable<Awaited<ReturnType<typeof bookingDetail>>>;

function NextStep({ b, manage, here, bound }: {
  b: Detail; manage: boolean; here: string; bound: <T extends (id: string, f: FormData) => Promise<unknown>>(fn: T) => (f: FormData) => Promise<void>;
}) {
  const inv = b.invoices[0];
  const shell = (title: string, body: ReactNode, children?: ReactNode) => (
    <section id="decide" aria-labelledby="next-h" className="flex flex-col gap-3 rounded-2xl bg-ink p-5 text-white">
      <div className="text-xs font-semibold tracking-wide text-[#C9D3D0]">NEXT STEP</div>
      <h2 id="next-h" className="font-display text-[22px] font-semibold text-white">{title}</h2>
      <p className="text-sm leading-[21px] text-[#E3E8E6]">{body}</p>
      {children}
    </section>
  );
  const light = "h-11 rounded-[10px] border-0 bg-white text-sm font-semibold text-lake-dark no-underline flex items-center justify-center hover:text-lake-dark";
  const dark = "h-10 rounded-[10px] border border-ink-muted bg-transparent text-sm font-medium text-white flex items-center justify-center no-underline hover:text-white";
  switch (b.status) {
    case "PENDING_APPROVAL":
      return shell("Approve or reject", `Cabins are held until ${fmtDateTime(b.holdExpiresAt)}. Approving issues the invoice and gives the guest 24 hours to pay.`, manage && (
        <>
          <form action={bound(B.approveAction)} className="flex flex-col gap-2">
            <select name="paymentOption" defaultValue={b.paymentOption} className="h-10 rounded-[10px] border-0 px-3 text-sm text-ink" aria-label="Payment option">
              <option value="ADVANCE">Advance payment</option><option value="FULL">Full payment</option>
            </select>
            <button className={light}>Approve &amp; send invoice</button>
          </form>
          <form action={bound(B.rejectAction)} className="flex gap-2">
            <input name="reason" required placeholder="Reason (sent to guest)" className="h-10 flex-1 rounded-[10px] border-0 px-3 text-sm text-ink" aria-label="Reject reason" />
            <button className={`${dark} px-4`}>Reject</button>
          </form>
        </>
      ));
    case "AWAITING_PAYMENT":
      return shell("Wait for payment", `${tk(inv?.dueNow ?? 0)} is due by ${fmtDateTime(b.paymentDueAt)}. If it isn't paid by then, the cabins are released.`,
        <a href={`tel:${b.leadGuest.mobile}`} className={light}>Call {b.leadGuest.mobile}</a>);
    case "PAYMENT_SUBMITTED":
      return shell("Verify the payment", "The guest uploaded a payment proof. Check the money arrived in the bank, then verify it.",
        <a href="/admin/payments" className={light}>Open payment proof</a>);
    case "CONFIRMED_BALANCE_DUE":
      return shell("Collect the balance", `${tk(b.outstanding)} is due by ${fmtDateTime(inv?.balanceAt)}. Check-in stays blocked until it is verified.`,
        <a href={`tel:${b.leadGuest.mobile}`} className={dark}>Call {b.leadGuest.mobile}</a>);
    case "CONFIRMED_PAID":
      return shell("Ready to board", `Paid in full. Collect the NID of every adult at check-in on ${fmtDate(b.tripDate)}, 13:00.`,
        <a href={`/admin/boarding?date=${b.tripDate.toISOString().slice(0, 10)}&booking=${b.id}`} className={light}>Open check-in</a>);
    case "CHECKED_IN":
      return shell("On board", `Checked in ${fmtDateTime(b.checkedInAt)}. Check-out is at 11:00 the next day.`,
        <a href={`/admin/boarding?date=${new Date(b.tripDate.getTime() + 86_400_000).toISOString().slice(0, 10)}`} className={light}>Go to check-out</a>);
    case "COMPLETED":
      return shell("Trip completed", `Checked out ${fmtDateTime(b.checkedOutAt)}.`);
    default:
      return shell("Closed", "This booking is no longer active. Its cabins were released.");
  }
  void here;
}
