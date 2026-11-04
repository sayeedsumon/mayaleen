import Link from "next/link";
import { Banner, Chip, Empty, Icon, PageHeader } from "@/components/ui";
import { fmtDate, fmtDateTime, tk } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { can } from "@/server/auth/permissions";
import { loadPricingConfig } from "@/server/config";
import { prisma } from "@/server/db";
import { invoiceDetail, invoicesList } from "@/server/queries";
import { reviseInvoiceAction } from "../../_actions/money";
import { toDhakaLocal } from "../../_lib/form";
import { InvoiceEditor } from "./editor";

type SP = { id?: string; f?: string; q?: string; ok?: string; error?: string };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("VIEW_OPERATIONS");
  const sp = await searchParams;
  const filter = (["open", "paid", "all"].includes(sp.f ?? "") ? sp.f : "open") as "open" | "paid" | "all";
  const list = await invoicesList(filter, sp.q);
  const chosenId = sp.id ?? list.rows[0]?.id;
  const inv = chosenId ? await invoiceDetail(chosenId) : null;
  const cfg = await loadPricingConfig(prisma);
  const manage = can(user.role, "MANAGE_BOOKINGS");
  const qs = (extra: Record<string, string>) => new URLSearchParams({ f: filter, ...(sp.q ? { q: sp.q } : {}), ...extra }).toString();
  const editable = inv && inv.status === "ISSUED" && !["REJECTED", "EXPIRED", "CANCELLED", "NO_SHOW", "COMPLETED"].includes(inv.booking.status);

  return (
    <div className="flex flex-col gap-[18px]">
      <Banner tone="ok">{sp.ok}</Banner>
      <Banner>{sp.error}</Banner>
      <PageHeader eyebrow="Issued on approval, revised on every change" title="Invoices">
        <form className="w-full max-w-[320px]">
          <input type="hidden" name="f" value={filter} />
          <input name="q" defaultValue={sp.q} placeholder="Invoice no., reference or guest" aria-label="Search invoices" className="input" />
        </form>
      </PageHeader>

      <div className="flex flex-wrap items-start gap-5">
        <section aria-label="Invoice list" className="card min-w-0 flex-[1_1_360px] overflow-hidden">
          <div className="flex flex-wrap gap-1.5 border-b border-hair p-3">
            {([["open", `Open · ${list.counts.open}`], ["paid", `Paid · ${list.counts.paid}`], ["all", "All"]] as const).map(([k, l]) => (
              <Link key={k} href={`?${new URLSearchParams({ f: k, ...(sp.q ? { q: sp.q } : {}) })}`}
                className={`flex h-8 items-center rounded-full border px-3 text-[13px] no-underline ${filter === k ? "border-ink bg-ink text-white hover:text-white" : "border-field bg-white text-ink hover:text-ink"}`}>{l}</Link>
            ))}
          </div>
          {list.rows.length === 0 && <Empty>No invoices here.</Empty>}
          {list.rows.map((r) => {
            const paid = r.paid >= r.total;
            const state = r.booking.status === "CANCELLED" ? ["Cancelled", "rose"] : paid ? ["Paid", "leaf"] : r.paid > 0 ? ["Part paid", "lake"] : r.booking.status === "PAYMENT_SUBMITTED" ? ["Proof sent", "sky"] : ["Unpaid", "amber"];
            return (
              <Link key={r.id} href={`?${qs({ id: r.id })}`}
                className={`flex items-center gap-3 border-b border-hair px-4 py-3 no-underline hover:bg-panel ${r.id === chosenId ? "bg-lake-soft" : ""}`}>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{r.number} <span className="font-medium text-ink-muted">rev {r.revision}</span></span>
                  <span className="block text-xs text-ink-muted">{r.booking.leadGuest.name} · {fmtDate(r.booking.tripDate)}</span>
                </span>
                <span className="text-right">
                  <span className="tabnum block text-sm font-semibold text-ink">{tk(r.total)}</span>
                  <span className="mt-1 inline-block"><Chip tone={state[1] as "leaf"}>{state[0]}</Chip></span>
                </span>
              </Link>
            );
          })}
        </section>

        {inv && (
          <section aria-labelledby="ed-h" className="card flex min-w-0 flex-[999_1_560px] flex-col">
            <div className="flex flex-wrap items-center gap-3 border-b border-hair px-5 py-[18px]">
              <div className="min-w-[280px] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="ed-h" className="font-display text-2xl font-semibold">{inv.number}</h2>
                  <Chip tone={inv.status === "ISSUED" ? "sky" : "sand"}>Revision {inv.revision}{inv.status !== "ISSUED" ? ` · ${inv.status.toLowerCase()}` : ""}</Chip>
                </div>
                <div className="mt-1 text-[13px] text-ink-2">
                  {inv.booking.leadGuest.name} · <a href={`/admin/bookings/${inv.bookingId}`}>{inv.booking.reference}</a> · {fmtDate(inv.booking.tripDate)} · {inv.booking.type === "FULL_BOAT" ? "full boat" : "shared"} · {inv.booking.guests.length} guests
                </div>
              </div>
              <a href={`/admin/invoices/${inv.id}/print`} className="btn-ghost"><Icon name="print" size={16} />Print / PDF</a>
            </div>

            {manage && editable ? (
              <InvoiceEditor
                action={reviseInvoiceAction.bind(null, inv.bookingId)}
                back={`/admin/invoices?${qs({ id: inv.id })}`}
                isFullBoat={inv.booking.type === "FULL_BOAT"}
                lines={inv.booking.lines.map((l) => ({ kind: l.kind, description: l.description, qty: l.qty, unitPrice: Math.abs(l.unitPrice) }))}
                paymentOption={inv.booking.paymentOption}
                advancePct={cfg.settings.advancePct}
                foodRate={cfg.rates.FULL_BOAT_FOOD.SUN_WED}
                dueNowAt={toDhakaLocal(inv.dueNowAt)}
                balanceAt={toDhakaLocal(inv.balanceAt)}
                prevTotal={inv.total}
                paid={inv.paid}
                revision={inv.revision}
              />
            ) : (
              <div className="flex flex-col gap-2.5 p-5">
                {inv.booking.lines.map((l) => (
                  <div key={l.id} className="flex justify-between text-sm text-ink-2"><span>{l.qty} × {l.description}</span><span className="tabnum">{tk(l.total)}</span></div>
                ))}
                <div className="flex justify-between border-t border-hair pt-2 font-semibold"><span>Total</span><span>{tk(inv.total)}</span></div>
                {!manage && <p className="text-xs text-ink-muted">Only a manager or the owner can edit invoices.</p>}
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-hair px-5 pb-[18px] pt-3.5">
              <div className="text-[13px] font-semibold text-ink-2">Revisions</div>
              {inv.booking.invoices.map((r) => (
                <div key={r.id} className="flex flex-wrap gap-3 text-[13px] text-ink-2">
                  <span className="font-semibold text-ink">Rev {r.revision}</span>
                  <span>{tk(r.total)} · issued {fmtDateTime(r.createdAt)}{r.status === "SUPERSEDED" ? " · replaced" : ""}</span>
                  <a href={`/admin/invoices/${r.id}/print`}>Open</a>
                </div>
              ))}
              <p className="text-xs text-ink-muted">Bank details on this invoice: {(inv.bankSnapshot as { bank?: string; accountNo?: string }).bank} · a/c {(inv.bankSnapshot as { accountNo?: string }).accountNo}. Issued invoices keep their bank details.</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
