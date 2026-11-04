import { notFound } from "next/navigation";
import { Icon } from "@/components/ui";
import { fmtDateLong, fmtDateTime, tk } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { invoiceDetail } from "@/server/queries";
import { PrintButton } from "../../../manifest/print-button";

type Bank = { bank: string; branch: string; accountName: string; accountNo: string; routingNo: string };

/** FR-A11: the invoice as a page. "Print" saves it as PDF from the browser. */
export default async function InvoicePrint({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("VIEW_OPERATIONS");
  const { id } = await params;
  const inv = await invoiceDetail(id);
  if (!inv) notFound();
  const b = inv.booking;
  const bank = inv.bankSnapshot as unknown as Bank;
  const guests = b.guests.reduce<Record<string, number>>((m, g) => ({ ...m, [g.ageBandName]: (m[g.ageBandName] ?? 0) + 1 }), {});
  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex gap-2">
        <a href={`/admin/invoices?id=${inv.id}`} className="btn-ghost"><Icon name="left" size={14} />Invoices</a>
        <div className="flex-1" />
        <PrintButton label="Print or save PDF" />
      </div>
      <article className="mx-auto w-full max-w-2xl rounded bg-white p-10 text-sm shadow-sm print:shadow-none">
        <header className="flex justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold">Mayaleen Houseboat</h1>
            <p className="text-ink-2">Floating villa · Kaptai Lake, Rangamati</p>
          </div>
          <div className="text-right">
            <p className="font-semibold">Invoice {inv.number}</p>
            <p>Revision {inv.revision}{inv.status !== "ISSUED" ? ` (${inv.status.toLowerCase()})` : ""}</p>
            <p>{fmtDateTime(inv.createdAt, true)}</p>
          </div>
        </header>
        <section className="mt-6 grid grid-cols-2 gap-4">
          <div><p className="text-ink-muted">Billed to</p><p className="font-medium">{b.leadGuest.name}</p><p>{b.leadGuest.mobile}</p>{b.leadGuest.email && <p>{b.leadGuest.email}</p>}</div>
          <div><p className="text-ink-muted">Booking {b.reference}</p><p>Trip date: {fmtDateLong(b.tripDate)}</p><p>{b.type === "FULL_BOAT" ? "Full boat" : "Shared cabins"} · 2 days / 1 night</p></div>
        </section>
        <p className="mt-4">Guests: {Object.entries(guests).map(([k, v]) => `${v} ${k}`).join(", ")}</p>
        {b.nights.length > 0 && <p>Cabins: {b.nights.map((n) => `${n.cabin.name} (${n.cabin.cabinType.name})`).join(", ")}</p>}
        <table className="mt-4 w-full border-collapse">
          <thead className="border-b text-left text-ink-muted"><tr><th className="py-1 font-semibold">Item</th><th className="font-semibold">Qty</th><th className="text-right font-semibold">Unit</th><th className="text-right font-semibold">Amount</th></tr></thead>
          <tbody>
            {b.lines.map((l) => (
              <tr key={l.id} className="border-b border-line"><td className="py-1.5">{l.description}</td><td>{l.qty}</td><td className="text-right">{tk(Math.abs(l.unitPrice))}</td><td className="text-right">{l.total < 0 ? `− ${tk(-l.total)}` : tk(l.total)}</td></tr>
            ))}
            <tr className="font-semibold"><td colSpan={3} className="pt-2">Total</td><td className="pt-2 text-right">{tk(inv.total)}</td></tr>
            {inv.paid > 0 && <tr><td colSpan={3}>Paid so far</td><td className="text-right">{tk(inv.paid)}</td></tr>}
          </tbody>
        </table>
        <section className="mt-6 rounded border border-line p-3">
          <p className="font-medium">{inv.balance > 0 ? "Advance payment" : "Full payment"}</p>
          <p>Amount due now: <strong>{tk(inv.dueNow)}</strong> by {fmtDateTime(inv.dueNowAt, true)}</p>
          {inv.balance > 0 && <p>Balance: <strong>{tk(inv.balance)}</strong> by {fmtDateTime(inv.balanceAt, true)}</p>}
        </section>
        <section className="mt-4 rounded border border-line p-3">
          <p className="font-medium">Pay by bank transfer (NPSB / BEFTN / deposit)</p>
          <p>{bank.bank}, {bank.branch}</p>
          <p>Account name: {bank.accountName}</p>
          <p>Account number: {bank.accountNo} · Routing number: {bank.routingNo}</p>
          <p className="mt-2 font-medium">Put booking reference {b.reference} in the transfer note.</p>
        </section>
      </article>
    </div>
  );
}
