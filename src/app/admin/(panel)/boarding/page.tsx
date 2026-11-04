import Link from "next/link";
import { addDays, toDhakaDate } from "@/domain";
import { Banner, Card, Chip, Empty, Icon, StatusChip } from "@/components/ui";
import { fmtDateMid, fmtDateTime, plural, tk } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { can } from "@/server/auth/permissions";
import { decryptField } from "@/server/crypto";
import { boardingDay } from "@/server/queries";
import { checkInAction, checkOutAction, noShowBoardingAction } from "../../_actions/boarding";
import { CheckInForm } from "./check-in-form";

export default async function BoardingPage({ searchParams }: { searchParams: Promise<{ date?: string; booking?: string; ok?: string; error?: string }> }) {
  const user = await requireUser("VIEW_OPERATIONS");
  const sp = await searchParams;
  const today = toDhakaDate(new Date());
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;
  const d = await boardingDay(date);
  const back = `/admin/boarding?date=${date}`;
  const waiting = d.arrivals.filter((b) => b.status !== "CHECKED_IN" && b.status !== "COMPLETED");
  const selected = d.arrivals.find((b) => b.id === sp.booking) ?? waiting.find((b) => b.status === "CONFIRMED_PAID") ?? waiting[0];
  const onBoard = d.departures.filter((b) => b.status === "CHECKED_IN");
  const adultsArriving = d.arrivals.reduce((n, b) => n + b.adults, 0);
  const idsArriving = d.arrivals.reduce((n, b) => n + b.idsRecorded, 0);

  return (
    <div className="flex flex-col gap-5">
      <Banner tone="ok">{sp.ok}</Banner>
      <Banner>{sp.error}</Banner>
      <header className="flex flex-wrap items-center gap-4">
        <div className="min-w-[300px] flex-1">
          <div className="eyebrow">Boarding day{date === today ? " · today" : ""}</div>
          <h1 className="h1 mt-0.5">{fmtDateMid(date)}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`?date=${addDays(date, -1)}`} aria-label="Previous day" className="btn-ghost w-10 px-0"><Icon name="left" size={16} /></Link>
          <Link href="?" className="btn-ghost">Today</Link>
          <Link href={`?date=${addDays(date, 1)}`} aria-label="Next day" className="btn-ghost w-10 px-0"><Icon name="right" size={16} /></Link>
        </div>
        <a href={`/admin/manifest?date=${date}`} className="btn-ghost"><Icon name="print" size={16} />Manifest &amp; kitchen sheet</a>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card flex items-center gap-3.5 px-[18px] py-3.5"><span className="font-display text-[26px] font-semibold">11:00</span><span className="text-[13px] text-ink-2"><strong className="text-ink">Check-out</strong><br />{plural(onBoard.length, "group")} · {plural(onBoard.reduce((n, b) => n + b.guests.length, 0), "guest")}</span></div>
        <div className="card flex items-center gap-3.5 px-[18px] py-3.5"><span className="font-display text-[26px] font-semibold">13:00</span><span className="text-[13px] text-ink-2"><strong className="text-ink">Check-in</strong><br />{plural(waiting.length, "group")} · {plural(waiting.reduce((n, b) => n + b.guests.length, 0), "guest")}</span></div>
        <div className="card flex items-center gap-3.5 px-[18px] py-3.5"><span className="font-display text-[26px] font-semibold">{idsArriving} / {adultsArriving}</span><span className="text-[13px] text-ink-2"><strong className="text-ink">Adult NIDs recorded</strong><br />for this day&apos;s arrivals</span></div>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
          <Card title="Checking out · 11:00">
            {d.departures.length === 0 && <Empty>No one checks out this day.</Empty>}
            <div className="flex flex-col gap-4">
              {d.departures.map((b) => (
                <div key={b.id} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <a href={`/admin/bookings/${b.id}`} className="text-[15px] font-semibold text-ink no-underline hover:underline">{b.leadGuest.name} · {b.type === "FULL_BOAT" ? "full boat" : `${b.nights.length} cabins`}</a>
                    <StatusChip status={b.status} />
                  </div>
                  <div className="text-[13px] text-ink-2">{b.reference} · {plural(b.guests.length, "guest")} · boarded {fmtDateTime(b.checkedInAt)}</div>
                  {b.status === "CHECKED_IN" ? (
                    <form action={checkOutAction.bind(null, b.id)} className="flex flex-col gap-3">
                      <input type="hidden" name="back" value={back} />
                      <label className="label">Notes (damages, feedback)<textarea name="notes" className="input min-h-16 py-2" /></label>
                      <label className="flex items-center gap-2 text-sm text-ink-muted"><input type="checkbox" disabled className="h-[18px] w-[18px]" />Thank-you SMS with review link (comes with SMS setup)</label>
                      <button className="btn h-11">Check out &amp; complete trip</button>
                    </form>
                  ) : b.checkoutNotes ? <p className="text-[13px] text-ink-2">Notes: {b.checkoutNotes}</p> : null}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Arriving · 13:00">
            {d.arrivals.length === 0 && <Empty>No confirmed arrivals this day.</Empty>}
            <div className="flex flex-col gap-2.5">
              {d.arrivals.map((b) => {
                const on = selected?.id === b.id;
                return (
                  <a key={b.id} href={`?date=${date}&booking=${b.id}#checkin`}
                    className={`flex flex-col gap-1 rounded-[10px] px-3.5 py-3 text-ink no-underline hover:text-ink ${on ? "border-2 border-lake bg-lake-faint" : "border border-field"}`}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[15px] font-semibold">{b.leadGuest.name}</span>
                      {b.status === "CHECKED_IN" ? <Chip tone="lake">Checked in</Chip> : b.outstanding > 0 ? <Chip tone="amber">{tk(b.outstanding)} due</Chip> : <Chip tone="leaf">Paid</Chip>}
                    </span>
                    <span className="text-[13px] text-ink-2">{b.reference} · {b.type === "FULL_BOAT" ? "Full boat" : b.nights.map((n) => n.cabin.name).join(", ")} · {plural(b.guests.length, "guest")}</span>
                    <span className={`text-xs font-semibold ${b.idsRecorded >= b.adults ? "text-leaf-ink" : "text-amber-ink"}`}>{b.idsRecorded} of {b.adults} NIDs recorded</span>
                  </a>
                );
              })}
            </div>
          </Card>
        </div>

        <section id="checkin" aria-labelledby="ci-h" className="card flex min-w-0 flex-[999_1_520px] flex-col">
          {!selected && <div className="p-6"><h2 id="ci-h" className="text-[17px] font-semibold">Check-in</h2><Empty>Pick an arriving group to check them in.</Empty></div>}
          {selected && (
            <>
              <div className="flex flex-wrap items-center gap-3 border-b border-hair px-5 py-[18px]">
                <div className="min-w-[260px] flex-1">
                  <div className="eyebrow">Check-in</div>
                  <h2 id="ci-h" className="mt-0.5 font-display text-2xl font-semibold">{selected.leadGuest.name} · {plural(selected.guests.length, "guest")}</h2>
                </div>
                {can(user.role, "MANAGE_BOOKINGS") && selected.status !== "CHECKED_IN" && (
                  <form action={noShowBoardingAction.bind(null, selected.id)}>
                    <input type="hidden" name="back" value={back} />
                    <button className="btn-danger">Mark no-show</button>
                  </form>
                )}
              </div>
              {selected.status === "CHECKED_IN" || selected.status === "COMPLETED" ? (
                <div className="flex flex-col gap-2 p-5 text-sm">
                  <Chip tone="lake">Checked in {fmtDateTime(selected.checkedInAt)}</Chip>
                  <p className="text-ink-2">Their names and NIDs are on the manifest.</p>
                </div>
              ) : selected.outstanding > 0 ? (
                <div className="m-5 flex flex-col gap-2 rounded-xl bg-amber-soft p-4 text-[#5E3905]">
                  <div className="font-semibold">Can&apos;t check in yet</div>
                  <p className="text-[13px] leading-[19px]">{tk(selected.outstanding)} is not verified. Check-in unlocks once the whole bill is paid.</p>
                  <a href={`/admin/bookings/${selected.id}`} className="text-[13px] font-semibold text-[#5E3905]">Record payment →</a>
                </div>
              ) : (
                <CheckInForm
                  action={checkInAction.bind(null, selected.id)}
                  back={back}
                  paid={tk(selected.paidAmount)}
                  adultsBooked={selected.adults}
                  cabins={selected.type === "FULL_BOAT" ? ["Whole boat", ...selected.nights.map((n) => n.cabin.name)] : selected.nights.map((n) => n.cabin.name)}
                  lead={{ name: selected.leadGuest.name, nid: decryptField(selected.leadGuest.nid) ?? "" }}
                  emergency={selected.leadGuest.emergencyContact ?? ""}
                />
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
