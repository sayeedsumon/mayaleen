import { notFound } from "next/navigation";
import { DICT, fill, money, num, tripDate, when, type Lang } from "@/lib/i18n";
import { guestBooking } from "@/server/queries";
import { getContent, getLang } from "@/server/site-content";
import { cancelRequestAction, choosePaymentAction, uploadProofAction } from "../../actions";
import { CopyButton } from "./copy-button";

export const metadata = { title: "My booking · Mayaleen", robots: { index: false } };

type Bank = { bank: string; branch: string; accountName: string; accountNo: string; routingNo: string };

function left(to: Date | null, lang: Lang) {
  if (!to) return "–";
  const mins = Math.max(0, Math.round((to.getTime() - Date.now()) / 60_000));
  const h = Math.floor(mins / 60), m = mins % 60;
  return lang === "bn" ? `${num(h, lang)} ঘণ্টা ${num(m, lang)} মিনিট` : `${h} h ${m} m`;
}

export default async function MyBooking({ params, searchParams }: {
  params: Promise<{ token: string }>; searchParams: Promise<{ new?: string; sent?: string; cancel?: string; error?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const lang = await getLang();
  const t = DICT[lang].my;
  const b = await guestBooking(token);
  if (!b) notFound();
  const c = await getContent(lang);
  const display = lang === "bn" ? "font-bnDisplay" : "font-display";
  const inv = b.invoices[0];
  const total = inv?.total ?? b.lines.reduce((n, l) => n + l.total, 0);
  const due = Math.max(0, total - b.paid);
  const bank = inv?.bankSnapshot as unknown as Bank | undefined;
  const s = b.status;
  const payments = b.invoices.flatMap((i) => i.payments).filter((p) => !p.isRefund);
  const adults = b.guests.filter((g) => /^adult/i.test(g.ageBandName)).length;
  const kids = b.guests.length - adults;
  const guestsTxt = lang === "bn" ? `${num(adults, lang)} জন প্রাপ্তবয়স্ক${kids ? `, ${num(kids, lang)} শিশু` : ""}` : `${adults} adults${kids ? `, ${kids} ${kids > 1 ? "children" : "child"}` : ""}`;
  const cabinsTxt = b.type === "FULL_BOAT" ? t.fullBoat : b.nights.map((n) => n.cabin.name).join(" + ");
  const needsPay = s === "AWAITING_PAYMENT" || s === "CONFIRMED_BALANCE_DUE" || s === "PAYMENT_SUBMITTED";
  const amountNow = s === "CONFIRMED_BALANCE_DUE" ? due : inv?.dueNow ?? 0;
  const stepIdx = { PENDING_APPROVAL: 0, AWAITING_PAYMENT: 2, PAYMENT_SUBMITTED: 2, CONFIRMED_BALANCE_DUE: 3, CONFIRMED_PAID: 4, CHECKED_IN: 4, COMPLETED: 4 }[s as string] ?? -1;

  const status = {
    PENDING_APPROVAL: [t.pending, fill(t.heldUntil, { t: when(b.holdExpiresAt, lang) }), "bg-amber-soft text-amber-ink"],
    AWAITING_PAYMENT: [t.awaiting, `${fill(t.left, { t: left(b.paymentDueAt, lang) })}`, "bg-amber-soft text-amber-ink"],
    PAYMENT_SUBMITTED: [t.submitted, t.checking, "bg-sky-soft text-sky-ink"],
    CONFIRMED_BALANCE_DUE: [t.balance, fill(t.balanceBy, { amount: money(due, lang), t: when(inv?.balanceAt ?? b.balanceDueAt, lang) }), "bg-lake-soft text-lake-dark"],
    CONFIRMED_PAID: [t.paid, t.paidMsg, "bg-leaf-soft text-leaf-ink"],
    CHECKED_IN: [t.onboard, "", "bg-lake-soft text-lake-dark"],
    COMPLETED: [t.done, "", "bg-sand-2 text-ink-2"],
  }[s as string] ?? [t.closed, "", "bg-rose-soft text-rose-ink"];

  return (
    <main className="mx-auto flex max-w-[640px] flex-col gap-4 px-4 pb-16 pt-6">
      {sp.new && (
        <section className="card flex flex-col gap-3 p-5">
          <h1 className={`text-[28px] font-medium leading-tight ${display}`}>{DICT[lang].req.title}</h1>
          <p className="text-[15px] leading-6 text-ink-2">{fill(DICT[lang].req.lead, { mobile: b.leadGuest.mobile })}</p>
          <ol className="list-decimal pl-5 text-[15px] leading-[26px] text-ink-2">{DICT[lang].req.nextSteps.map((x) => <li key={x}>{x}</li>)}</ol>
          <p className="text-[13px] text-ink-muted">{DICT[lang].req.save}</p>
        </section>
      )}
      {sp.error && <p role="alert" className="rounded-xl bg-rose-soft px-4 py-3 text-sm text-rose-ink">{sp.error}</p>}
      {sp.sent && <p role="status" className="rounded-xl bg-lake-soft px-4 py-3 text-sm text-lake-dark">{t.proofThanks}</p>}
      {sp.cancel && <p role="status" className="rounded-xl bg-lake-soft px-4 py-3 text-sm text-lake-dark">{t.cancelSent}</p>}

      <section aria-labelledby="h">
        <div className="text-[13px] text-ink-muted">{fill(t.ref, { ref: b.reference })} · {b.leadGuest.name}</div>
        <h2 id="h" className={`mt-1 text-[28px] font-medium ${display}`}>{tripDate(b.tripDate.toISOString(), lang)}</h2>
        <div className="mt-1 text-[15px] text-ink-2">{fill(t.trip, { cabins: cabinsTxt, guests: guestsTxt })}</div>
      </section>

      <section aria-label="Status" className="flex flex-col gap-2.5 rounded-2xl bg-lake-deep p-4 text-white">
        <span className={`self-start rounded-full px-2.5 py-1 text-xs font-semibold ${status[2]}`}>{status[0]}</span>
        {s === "AWAITING_PAYMENT" && <div className={`text-[22px] font-medium ${display}`}>{fill(t.payBy, { t: when(b.paymentDueAt, lang) })}</div>}
        {status[1] && <div className="text-sm text-[#D4E6E2]">{status[1]}</div>}
        {stepIdx >= 0 && (
          <ol className="mt-1.5 grid grid-cols-4 gap-1.5 text-[11px] text-[#C2DCD7]">
            {t.steps.map((x, i) => (
              <li key={x} className={`flex flex-col gap-1.5 ${i === stepIdx ? "font-semibold text-white" : ""}`}>
                <span className={`h-1 rounded ${i < stepIdx ? "bg-white" : i === stepIdx ? "bg-[#9FD0C7]" : "bg-[#3E6B66]"}`} />{x}
              </li>
            ))}
          </ol>
        )}
      </section>

      {s === "AWAITING_PAYMENT" && inv && (
        <section id="pay" aria-labelledby="pay-h" className="card flex flex-col gap-3 p-4">
          <h2 id="pay-h" className="text-[17px] font-semibold">{t.howPay}</h2>
          <form action={choosePaymentAction.bind(null, token)} className="flex flex-col gap-2">
            {(["ADVANCE", "FULL"] as const).map((o) => {
              const on = b.paymentOption === o;
              const adv = Math.round((total * b.advancePct) / 100);
              return (
                <button key={o} name="option" value={o} aria-pressed={on}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-left ${on ? "border-2 border-lake bg-lake-faint" : "border border-field bg-white"}`}>
                  <span className={`h-5 w-5 flex-none rounded-full border-2 ${on ? "border-lake bg-[radial-gradient(circle,#0E5C56_45%,transparent_50%)]" : "border-[#B7BFBC]"}`} />
                  <span className="flex-1">
                    <span className="block font-semibold">{o === "ADVANCE" ? fill(t.advanceNow, { pct: num(b.advancePct, lang) }) : t.payFull}</span>
                    <span className="block text-[13px] text-ink-2">{o === "ADVANCE" ? fill(t.restBy, { amount: money(total - adv, lang), t: when(inv.balanceAt ?? b.balanceDueAt, lang) }) : t.nothingLater}</span>
                  </span>
                  <strong>{money(o === "ADVANCE" ? adv : total, lang)}</strong>
                </button>
              );
            })}
          </form>
        </section>
      )}

      {needsPay && bank && (
        <section aria-labelledby="bank-h" className="card p-4">
          <h2 id="bank-h" className="mb-1 text-[17px] font-semibold">{fill(t.sendTo, { amount: money(amountNow, lang) })}</h2>
          <p className="mb-1.5 text-[13px] text-ink-2">{t.sendHow}</p>
          {([[t.bank, `${bank.bank}, ${bank.branch}`, false], [t.accountName, bank.accountName, true], [t.accountNo, bank.accountNo, true], [t.routing, bank.routingNo, true]] as const).map(([k, v, copy]) => (
            <div key={k} className="flex items-center justify-between gap-2.5 border-t border-hair py-2.5 text-[15px]">
              <span><span className="block text-xs text-ink-muted">{k}</span>{v}</span>
              {copy && <CopyButton text={v} label={t.copy} done={t.copied} />}
            </div>
          ))}
          <div className="mt-1.5 rounded-[10px] bg-amber-soft p-3 text-sm leading-5 text-[#5E3905]">{fill(t.noteRef, { ref: b.reference })}</div>
        </section>
      )}

      {needsPay && inv && (
        <form id="proof" action={uploadProofAction.bind(null, token)} aria-labelledby="up-h" className="card flex flex-col gap-3 p-4">
          <h2 id="up-h" className="text-[17px] font-semibold">{t.proofTitle}</h2>
          <div className="absolute left-[-9999px]" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
          <label className="label">{t.amountSent}<input name="amount" required inputMode="numeric" defaultValue={amountNow || ""} className="input h-12 text-base" /></label>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="label">{t.sentAt}<input name="transferAt" type="datetime-local" className="input h-12 text-base" /></label>
            <label className="label">{t.txn}<input name="txnId" placeholder={t.txnPh} className="input h-12 text-base" /></label>
          </div>
          <label className="label">{t.sender}<input name="sender" placeholder={t.senderPh} className="input h-12 text-base" /></label>
          <label className="label">{t.from}
            <select name="bank" className="input h-12 text-base" defaultValue="">
              <option value="" disabled>{t.choose}</option>
              {["BRAC Bank", "Dutch-Bangla Bank", "City Bank", "Islami Bank", "Sonali Bank", "Eastern Bank", "bKash (to bank)", "Nagad (to bank)"].map((x) => <option key={x}>{x}</option>)}
              <option>{t.other}</option>
            </select>
          </label>
          <label className="relative flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-[1.5px] border-dashed border-[#9DB9B4] bg-lake-faint p-[18px] text-center">
            <span className="text-[15px] font-semibold text-lake-dark">{t.screenshot}</span>
            <span className="text-xs text-ink-2">{t.screenshotHint}</span>
            <input type="file" name="file" accept="image/jpeg,image/png,application/pdf" className="mt-1 w-full max-w-[260px] text-sm" />
          </label>
          <button className="btn h-[52px] text-base">{t.sendProof}</button>
          <p className="text-center text-xs text-ink-muted">{t.pauseNote}</p>
        </form>
      )}

      {inv && (
        <section id="payments" aria-labelledby="pr-h" className="card p-4">
          <h2 id="pr-h" className="mb-1 text-[17px] font-semibold">{t.payments}</h2>
          {payments.map((p) => (
            <div key={p.id} className="flex items-start justify-between gap-2.5 border-t border-hair py-2.5 text-[15px]">
              <span>
                <span className="block">{money(p.amountReceived ?? p.amountClaimed, lang)} · {when(p.createdAt, lang)}</span>
                {p.status === "REJECTED" && p.rejectReason && <span className="block text-[13px] text-rose-ink">{p.rejectReason}</span>}
              </span>
              <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${p.status === "VERIFIED" ? "bg-leaf-soft text-leaf-ink" : p.status === "REJECTED" ? "bg-rose-soft text-rose-ink" : "bg-sky-soft text-sky-ink"}`}>
                {p.status === "VERIFIED" ? t.accepted : p.status === "REJECTED" ? t.rejected : t.checkingL}
              </span>
            </div>
          ))}
          <div className="flex justify-between border-t border-hair py-2.5 text-[15px]"><span>{t.totalL}</span><strong>{money(total, lang)}</strong></div>
          <div className="flex justify-between border-t border-hair py-2.5 text-[15px]"><span>{t.paidL}</span><strong>{money(b.paid, lang)}</strong></div>
          {due > 0 && <div className="flex justify-between border-t border-hair py-2.5 text-[15px]"><span>{t.dueL}</span><strong>{money(due, lang)}</strong></div>}
          <a href={`/booking/${token}/invoice`} className="btn-ghost mt-1.5 h-11 w-full">{t.invoice}</a>
        </section>
      )}

      <section className="mt-2 flex flex-col gap-2 text-sm">
        <span className="text-ink-muted">{t.bring} {fill(t.meeting, { place: c.meetingPoint })}</span>
        {!["CANCELLED", "REJECTED", "EXPIRED", "NO_SHOW", "COMPLETED", "CHECKED_IN"].includes(s) && !b.cancelRequestedAt && (
          <details>
            <summary className="cursor-pointer font-semibold text-lake">{t.cancel}</summary>
            <form action={cancelRequestAction.bind(null, token)} className="mt-2 flex flex-col gap-2">
              <div className="absolute left-[-9999px]" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
              <label className="label">{t.cancelReason}<textarea name="reason" maxLength={500} className="input min-h-16 py-2" /></label>
              <button className="btn-ghost self-start">{t.cancelSend}</button>
            </form>
          </details>
        )}
        {b.cancelRequestedAt && <span className="font-semibold text-amber-ink">{t.cancelSent}</span>}
      </section>
    </main>
  );
}
