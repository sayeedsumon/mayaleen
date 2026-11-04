import { addMonths, toDhakaDate } from "@/domain";
import { Banner } from "@/components/ui";
import { requireUser } from "@/server/auth/current-user";
import { can } from "@/server/auth/permissions";
import { calendarMonth } from "@/server/queries";
import { CalendarBoard } from "./board";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; day?: string; cabins?: string; error?: string; ok?: string }> }) {
  const user = await requireUser("VIEW_OPERATIONS");
  const sp = await searchParams;
  const today = toDhakaDate(new Date());
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : (sp.day ?? today).slice(0, 7);
  const data = await calendarMonth(month);
  const day = sp.day && sp.day.startsWith(month) ? sp.day : month === today.slice(0, 7) ? today : `${month}-01`;
  return (
    <div className="flex flex-col gap-4">
      <Banner>{sp.error}</Banner>
      <Banner tone="ok">{sp.ok}</Banner>
      <CalendarBoard
        key={`${month}-${day}`}
        data={data}
        today={today}
        initialDay={day}
        initialCabins={sp.cabins ? sp.cabins.split(",") : []}
        prevMonth={addMonths(`${month}-01`, -1).slice(0, 7)}
        nextMonth={addMonths(`${month}-01`, 1).slice(0, 7)}
        canManage={can(user.role, "MANAGE_BOOKINGS")}
        canCreate={can(user.role, "CREATE_BOOKING")}
      />
    </div>
  );
}
