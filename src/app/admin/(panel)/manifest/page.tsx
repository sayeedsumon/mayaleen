import { toDhakaDate } from "@/domain";
import { Icon } from "@/components/ui";
import { fmtDateLong, fmtDateTime } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { decryptField } from "@/server/crypto";
import { prisma } from "@/server/db";
import { manifest } from "@/server/queries";
import { PrintButton } from "./print-button";

export default async function ManifestPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireUser("VIEW_OPERATIONS");
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : toDhakaDate(new Date());
  const m = await manifest(date);
  if (m.bookings.length > 0) {
    // FR-A19: NID access is logged.
    await prisma.auditLog.create({ data: { entity: "Manifest", entityId: date, action: "NID_VIEW", actor: user.id } });
  }
  const notes = [...m.bookings, ...m.leaving].filter((b) => b.notes).map((b) => `${b.leadGuest.name}: ${b.notes}`);
  const meals = [
    ...(m.leavingPlates ? [{ meal: "Breakfast", time: "08:30", group: m.leaving.map((b) => `${b.leadGuest.name} (day 2)`).join(", "), plates: m.leavingPlates }] : []),
    ...(m.meals ? [
      { meal: "Lunch", time: "14:00", group: m.bookings.map((b) => b.leadGuest.name).join(", "), plates: m.meals },
      { meal: "Evening snacks", time: "17:30", group: "Same groups", plates: m.meals },
      { meal: "Dinner", time: "21:00", group: "Same groups", plates: m.meals },
      { meal: "Breakfast (next day)", time: "08:30", group: "Same groups", plates: m.meals },
    ] : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="no-print flex flex-wrap items-center gap-2.5">
        <a href={`/admin/boarding?date=${date}`} className="btn-ghost"><Icon name="left" size={14} />Boarding</a>
        <form className="flex items-center gap-2"><input type="date" name="date" defaultValue={date} className="input w-44" aria-label="Date" /><button className="btn-ghost">Go</button></form>
        <div className="flex-1" />
        <span className="text-xs text-ink-2">Viewing NIDs is logged</span>
        <PrintButton />
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <article className="flex min-w-0 flex-[3_1_620px] flex-col gap-[18px] rounded bg-white p-10 shadow-sm print:shadow-none">
          <header className="flex items-start justify-between border-b-2 border-ink pb-3">
            <div>
              <div className="font-display text-[22px] font-semibold">Guest manifest</div>
              <div className="text-[13px] text-ink-2">Mayaleen floating villa · Kaptai Lake, Rangamati</div>
            </div>
            <div className="text-right text-[13px]">
              <div className="font-semibold">Trip date: {fmtDateLong(date)}</div>
              <div className="text-ink-2">Boards 13:00 · returns 11:00 next day</div>
            </div>
          </header>
          <div className="grid grid-cols-2 gap-2.5 text-[13px] sm:grid-cols-4">
            <div><div className="text-ink-muted">Guests on board</div><div className="text-xl font-semibold">{m.guests}</div></div>
            <div><div className="text-ink-muted">Adults / children</div><div className="text-xl font-semibold">{m.guests - m.children} / {m.children}</div></div>
            <div><div className="text-ink-muted">Groups</div><div className="text-xl font-semibold">{m.bookings.length}</div></div>
            <div><div className="text-ink-muted">Meals per sitting</div><div className="text-xl font-semibold">{m.meals}</div></div>
          </div>
          {m.bookings.length === 0 && <p className="text-sm text-ink-muted">No confirmed bookings for this date.</p>}
          {m.bookings.map((b) => (
            <div key={b.id} className="flex flex-col gap-2">
              <div className="bg-sand-2 px-2.5 py-2 text-[13px] font-semibold">
                {b.reference} · {b.leadGuest.name} · {b.leadGuest.mobile} · {b.type === "FULL_BOAT" ? "full boat" : b.nights.map((n) => n.cabin.name).join(", ")}
              </div>
              <table className="w-full border-collapse text-[13px]">
                <thead><tr className="text-left text-xs text-ink-2">
                  <th className="border-b border-[#CFC9BD] py-1.5 pr-1.5 font-semibold">#</th>
                  <th className="border-b border-[#CFC9BD] p-1.5 font-semibold">Name</th>
                  <th className="border-b border-[#CFC9BD] p-1.5 font-semibold">Age</th>
                  <th className="border-b border-[#CFC9BD] p-1.5 font-semibold">NID / passport</th>
                  <th className="border-b border-[#CFC9BD] py-1.5 pl-1.5 font-semibold">Cabin</th>
                </tr></thead>
                <tbody>
                  {b.guests.sort((x, y) => Number(y.isLead) - Number(x.isLead)).map((g, i) => (
                    <tr key={g.id}>
                      <td className="border-b border-line py-1.5 pr-1.5 text-ink-muted">{i + 1}</td>
                      <td className="border-b border-line p-1.5 font-medium">{g.name ?? (g.isLead ? b.leadGuest.name : "–")}{g.isLead ? " (lead)" : ""}</td>
                      <td className="border-b border-line p-1.5">{g.ageBandName}</td>
                      <td className="tabnum border-b border-line p-1.5">{decryptField(g.nidOrPassport) ?? (g.isLead ? decryptField(b.leadGuest.nid) : null) ?? "–"}</td>
                      <td className="border-b border-line py-1.5 pl-1.5">{g.cabinName ?? "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {b.leadGuest.emergencyContact && <div className="text-xs text-ink-2">Emergency contact: {b.leadGuest.emergencyContact}</div>}
            </div>
          ))}
          <footer className="mt-auto flex justify-between border-t border-[#CFC9BD] pt-3 text-[11px] text-ink-muted">
            <span>Confidential. Printed by {user.name}, {fmtDateTime(new Date(), true)}</span><span>Mayaleen</span>
          </footer>
        </article>

        <article className="flex min-w-0 flex-[2_1_420px] flex-col gap-4 rounded bg-white p-10 shadow-sm print:shadow-none">
          <header className="border-b-2 border-ink pb-3">
            <div className="font-display text-[22px] font-semibold">Kitchen sheet</div>
            <div className="text-[13px] text-ink-2">{fmtDateLong(date)}</div>
          </header>
          {meals.length === 0 ? <p className="text-sm text-ink-muted">No meals to prepare.</p> : (
            <table className="w-full border-collapse text-sm">
              <thead><tr className="text-left text-xs text-ink-2">
                <th className="border-b border-[#CFC9BD] py-1.5 pr-1.5 font-semibold">Meal</th>
                <th className="border-b border-[#CFC9BD] p-1.5 font-semibold">Time</th>
                <th className="border-b border-[#CFC9BD] p-1.5 font-semibold">Group</th>
                <th className="border-b border-[#CFC9BD] py-1.5 pl-1.5 text-right font-semibold">Plates</th>
              </tr></thead>
              <tbody>
                {meals.map((x) => (
                  <tr key={x.meal}>
                    <td className="border-b border-line py-2 pr-1.5 font-semibold">{x.meal}</td>
                    <td className="border-b border-line p-1.5 text-ink-2">{x.time}</td>
                    <td className="border-b border-line p-1.5 text-ink-2">{x.group}</td>
                    <td className="border-b border-line py-2 pl-1.5 text-right text-base font-semibold">{x.plates}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="bg-sand-2 px-3.5 py-3 text-[13px] leading-5">
            <div className="font-semibold">Guest notes</div>
            {notes.length ? notes.map((n) => <div key={n}>{n}</div>) : <div className="text-ink-muted">None</div>}
          </div>
          <div className="text-xs text-ink-muted">Shared guests eat the fixed menu. Full-boat counts come from the food packages on the booking.</div>
        </article>
      </div>
    </div>
  );
}
