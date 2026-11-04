import { notFound } from "next/navigation";
import { fmtDateLong, fmtDateTime, tk } from "@/lib/format";
import { guestBooking } from "@/server/queries";
import { PrintButton } from "../../../../admin/(panel)/manifest/print-button";

export const metadata = { title: "Invoice · Mayaleen", robots: { index: false } };

type Bank = { bank: string; branch: string; accountName: string; accountNo: string; routingNo: string };

export default async function GuestInvoice({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const b = await guestBooking(token);
  if (!b || !b.invoices[0]) notFound();
  const inv = b.invoices[0];
  const bank = inv.bankSnapshot as unknown as Bank;
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <div className="no-print flex justify-between gap-2">
        <a href={`/booking/${token}`} className="btn-ghost">← My booking</a>
        <PrintButton label="Print or save PDF" />
      </div>
      <article className="rounded bg-white p-6 text-sm shadow-sm md:p-10 print:shadow-none">
        <header className="flex flex-wrap justify-between gap-4">
          <div><h1 className="font-display text-2xl font-semibold">Mayaleen Houseboat</h1><p className="text-ink-2">Kaptai Lake, Rangamati</p></div>
          <div className="text-right"><p className="font-semibold">Invoice {inv.number}</p><p>Revision {inv.revision}</p><p>{fmtDateTime(inv.createdAt, true)}</p></div>
        </header>
        <section className="mt-6 grid grid-cols-2 gap-4">
          <div><p className="text-ink-muted">Billed to</p><p className="font-medium">{b.leadGuest.name}</p><p>{b.leadGuest.mobile}</p></div>
          <div><p className="text-ink-muted">Booking {b.reference}</p><p>{fmtDateLong(b.tripDate)}</p><p>{b.type === "FULL_BOAT" ? "Whole boat" : b.nights.map((n) => n.cabin.name).join(", ")}</p></div>
        </section>
        <table className="mt-5 w-full border-collapse">
          <thead className="border-b text-left text-ink-muted"><tr><th className="py-1 font-semibold">Item</th><th className="font-semibold">Qty</th><th className="text-right font-semibold">Amount</th></tr></thead>
          <tbody>
            {b.lines.map((l) => <tr key={l.id} className="border-b border-line"><td className="py-1.5">{l.description}</td><td>{l.qty}</td><td className="text-right">{l.total < 0 ? `− ${tk(-l.total)}` : tk(l.total)}</td></tr>)}
            <tr className="font-semibold"><td colSpan={2} className="pt-2">Total</td><td className="pt-2 text-right">{tk(inv.total)}</td></tr>
            <tr><td colSpan={2}>Paid</td><td className="text-right">{tk(b.paid)}</td></tr>
          </tbody>
        </table>
        <section className="mt-5 rounded border border-line p-3">
          <p>Due now: <strong>{tk(inv.dueNow)}</strong> by {fmtDateTime(inv.dueNowAt, true)}</p>
          {inv.balance > 0 && <p>Balance: <strong>{tk(inv.balance)}</strong> by {fmtDateTime(inv.balanceAt, true)}</p>}
        </section>
        <section className="mt-4 rounded border border-line p-3">
          <p className="font-medium">Bank transfer</p>
          <p>{bank.bank}, {bank.branch} · {bank.accountName}</p>
          <p>Account {bank.accountNo} · Routing {bank.routingNo}</p>
          <p className="mt-2 font-medium">Transfer note: {b.reference}</p>
        </section>
      </article>
    </main>
  );
}
