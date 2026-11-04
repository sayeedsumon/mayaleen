import { Banner, Card } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { prisma } from "@/server/db";
import { rulesAction } from "../../../_actions/settings";

const FIELDS = [
  ["approvalWindowHours", "Hold for approval", "hours", "How long a new request keeps its cabins before it expires (PRD: 12)."],
  ["paymentWindowHours", "Time to pay after approval", "hours", "Deadline for the first payment (PRD: 24)."],
  ["advancePct", "Advance payment", "%", "Share of the total due first when the guest picks advance (PRD: 50)."],
  ["balanceLeadHours", "Balance due before boarding", "hours", "Balance deadline, counted back from 13:00 boarding (PRD: 24)."],
  ["cutoffDays", "Online booking closes", "days before", "Staff can still book up to the trip date (PRD: 2)."],
  ["horizonMonths", "Book up to", "months ahead", "How far ahead the website takes bookings (PRD: 12)."],
  ["capacityCap", "Boat capacity cap", "guests", "Upper limit even if cabins sleep more (PRD: 16)."],
  ["minBillablePerCabin", "Minimum billed guests per cabin", "guests", "0 = off. When on, a cabin with fewer guests is billed at this minimum."],
] as const;

export default async function RulesPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireUser("ADMIN_SETTINGS");
  const sp = await searchParams;
  const s = await prisma.boatSetting.findFirstOrThrow({ orderBy: { effectiveFrom: "desc" } });
  return (
    <div className="flex flex-col gap-5">
      <Banner tone="ok">{sp.ok}</Banner>
      <Banner>{sp.error}</Banner>
      <form action={rulesAction} className="flex flex-col gap-5">
        <Card title="Booking rules" action={<span className="text-[13px] text-ink-muted">Last changed {fmtDateTime(s.effectiveFrom, true)}</span>}>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            {FIELDS.map(([k, label, unit, hint]) => (
              <label key={k} className="label">
                {label}
                <span className="flex items-center gap-2">
                  <input name={k} inputMode="numeric" defaultValue={s[k]} required className="input w-28" />
                  <span className="text-sm text-ink-muted">{unit}</span>
                </span>
                <span className="text-xs font-normal text-ink-muted">{hint}</span>
              </label>
            ))}
          </div>
        </Card>
        <Card title="Group discount (optional)">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" name="groupTierEnabled" defaultChecked={s.groupTierEnabled} className="h-[18px] w-[18px] accent-lake" />Use a lower per-guest rate for big groups</label>
            <label className="label">From<span className="flex items-center gap-2"><input name="groupTierMinGuests" inputMode="numeric" defaultValue={s.groupTierMinGuests} className="input w-24" /><span className="text-sm text-ink-muted">guests</span></span></label>
            <label className="label">Rate<span className="flex items-center gap-2"><span className="text-sm text-ink-muted">Tk</span><input name="groupTierRate" inputMode="numeric" defaultValue={s.groupTierRate} className="input w-28" /><span className="text-sm text-ink-muted">per guest</span></span></label>
          </div>
          <p className="mt-2 text-xs text-ink-muted">Never raises a price: the lower of this and the day&apos;s rate is used. The PRD floor is Tk 6,800.</p>
        </Card>
        <button className="btn self-start">Save rules</button>
      </form>
    </div>
  );
}
