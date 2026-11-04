import type { ReactNode } from "react";
import { Icon } from "@/components/ui";
import { initials } from "@/lib/format";
import { requireUser } from "@/server/auth/current-user";
import { can } from "@/server/auth/permissions";
import { navCounts, sweepHolds } from "@/server/queries";
import { logoutAction } from "../actions";
import { NavLinks } from "./nav-links";

export const dynamic = "force-dynamic";

const ROLE_LABEL = { ADMIN: "Owner", MANAGER: "Manager", FRONT_DESK: "Front desk" } as const;

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  await sweepHolds();
  const counts = await navCounts();
  const items = [
    { href: "/admin", label: "Today", icon: "sun", badge: counts.approvals + counts.proofs, exact: true },
    { href: "/admin/calendar", label: "Calendar", icon: "calendar" },
    { href: "/admin/timeline", label: "Timeline", icon: "timeline" },
    { href: "/admin/bookings", label: "Bookings", icon: "list" },
    { href: "/admin/boarding", label: "Boarding", icon: "boarding" },
    { href: "/admin/invoices", label: "Invoices", icon: "invoice" },
    { href: "/admin/payments", label: "Payments", icon: "money", badge: counts.proofs, tone: "sky" as const },
    { href: "/admin/guests", label: "Guests", icon: "guests" },
    ...(can(user.role, "MANAGE_BOOKINGS") ? [{ href: "/admin/reports", label: "Reports", icon: "chart" }] : []),
    { href: "/admin/settings", label: "Settings", icon: "gear" },
  ];
  return (
    <div className="flex min-h-screen flex-wrap bg-ground">
      <aside className="no-print flex w-full flex-col gap-6 border-b border-line bg-panel px-4 py-5 md:sticky md:top-0 md:h-screen md:w-[248px] md:border-b-0 md:border-r md:py-6">
        <div className="flex items-center gap-2.5 px-2">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-lake text-white"><Icon name="boat" size={20} /></div>
          <div>
            <div className="font-display text-[19px] font-semibold leading-tight">Mayaleen</div>
            <div className="text-xs text-ink-muted">Kaptai Lake</div>
          </div>
        </div>
        {can(user.role, "CREATE_BOOKING") && (
          <a href="/admin/calendar" className="btn h-[42px]"><Icon name="plus" size={16} />New booking</a>
        )}
        <NavLinks items={items} />
        <form action={logoutAction} className="mt-auto flex items-center gap-2.5 border-t border-line px-2 pt-3">
          <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-lake-soft text-[13px] font-semibold text-lake-dark">{initials(user.name)}</div>
          <div className="min-w-0 flex-1 text-[13px] leading-[18px]">
            <div className="truncate font-semibold">{user.name}</div>
            <div className="text-ink-muted">{ROLE_LABEL[user.role]}</div>
          </div>
          <button className="text-[13px] font-medium text-ink-2 underline hover:text-ink">Sign out</button>
        </form>
      </aside>
      <main className="min-w-0 flex-1 px-4 pb-10 pt-6 md:px-8 md:pt-7">{children}</main>
    </div>
  );
}
