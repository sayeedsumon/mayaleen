import { notFound } from "next/navigation";
import { fmtDate, fmtDateTime, tk } from "../../../../../lib/format";
import { requireUser } from "../../../../../server/auth/current-user";
import { prisma } from "../../../../../server/db";

type Bank = { bank: string; branch: string; accountName: string; accountNo: string; routingNo: string };

/** FR-A11: invoice as a web page. Print to PDF from the browser (Ctrl+P). */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("VIEW_OPERATIONS");
  const { id } = await params;
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: {
      booking: { include: { leadGuest: true, lines: true, guests: true, nights: { include: { cabin: { include: { cabinType: true } } } } } },
    },
  });
  if (!inv) notFound();
  const b = inv.booking;
  const bank = inv.bankSnapshot as unknown as Bank;
  const guests = b.guests.reduce<Record<string, number>>((m, g) => ({ ...m, [g.ageBandName]: (m[g.ageBandName] ?? 0) + 1 }), {});

  return (
    <article className="mx-auto max-w-2xl bg-white p-8 text-sm shadow print:shadow-none">
      <header className="flex justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mayaleen Houseboat</h1>
          <p className="text-slate-600">Kaptai Lake, Rangamati</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">Invoice {inv.number}</p>
          <p>Revision {inv.revision}{inv.status !== "ISSUED" && ` (${inv.status.toLowerCase()})`}</p>
          <p>{fmtDateTime(inv.createdAt)}</p>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <p className="text-slate-500">Billed to</p>
          <p className="font-medium">{b.leadGuest.name}</p>
          <p>{b.leadGuest.mobile}</p>
        </div>
        <div>
          <p className="text-slate-500">Booking {b.reference}</p>
          <p>Trip date: {fmtDate(b.tripDate)}</p>
          <p>{b.type === "FULL_BOAT" ? "Full boat" : "Shared cabins"} · 2 days / 1 night</p>
        </div>
      </section>

      <p className="mt-4">Guests: {Object.entries(guests).map(([k, v]) => `${v} ${k}`).join(", ")}</p>
      {b.nights.length > 0 && <p>Cabins: {b.nights.map((n) => `${n.cabin.name} (${n.cabin.cabinType.name})`).join(", ")}</p>}

      <table className="mt-4 w-full">
        <thead className="border-b text-left text-slate-500"><tr><th className="py-1">Item</th><th>Qty</th><th className="text-right">Unit</th><th className="text-right">Amount</th></tr></thead>
        <tbody>
          {b.lines.map((l) => (
            <tr key={l.id} className="border-b"><td className="py-1">{l.description}</td><td>{l.qty}</td><td className="text-right">{tk(l.unitPrice)}</td><td className="text-right">{tk(l.total)}</td></tr>
          ))}
          <tr className="font-semibold"><td colSpan={3} className="pt-2">Total</td><td className="pt-2 text-right">{tk(inv.total)}</td></tr>
        </tbody>
      </table>

      <section className="mt-6 rounded border p-3">
        <p className="font-medium">{inv.balance > 0 ? "Advance payment" : "Full payment"}</p>
        <p>Amount due now: <strong>{tk(inv.dueNow)}</strong> by {fmtDateTime(inv.dueNowAt)}</p>
        {inv.balance > 0 && <p>Balance: <strong>{tk(inv.balance)}</strong> by {fmtDateTime(inv.balanceAt)}</p>}
      </section>

      <section className="mt-4 rounded border p-3">
        <p className="font-medium">Pay by bank transfer (NPSB / BEFTN / deposit)</p>
        <p>{bank.bank}, {bank.branch}</p>
        <p>Account name: {bank.accountName}</p>
        <p>Account number: {bank.accountNo} · Routing number: {bank.routingNo}</p>
        <p className="mt-2 font-medium">Put booking reference {b.reference} in the transfer note.</p>
      </section>
    </article>
  );
}
