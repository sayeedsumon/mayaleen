import type { ReactNode } from "react";
import { requireUser } from "@/server/auth/current-user";
import { can } from "@/server/auth/permissions";
import { SettingsNav } from "./settings-nav";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const admin = can(user.role, "ADMIN_SETTINGS");
  const items = [
    ...(admin ? [
      ["/admin/settings/rates", "Rates & holidays"], ["/admin/settings/cabins", "Cabins"], ["/admin/settings/rules", "Booking rules"],
      ["/admin/settings/bank", "Bank accounts"], ["/admin/settings/staff", "Staff & roles"], ["/admin/settings/website", "Website content"], ["/admin/settings/photos", "Website photos"],
    ] : []),
    ...(can(user.role, "MANAGE_BOOKINGS") ? [["/admin/settings/messages", "SMS & email"]] : []),
    ["/admin/settings/account", "My account & password"],
    ...(admin ? [["/admin/settings/audit", "Audit log"]] : []),
  ] as [string, string][];
  return (
    <div className="flex flex-col gap-5">
      <header>
        <div className="eyebrow">{admin ? "Owner only" : "Your account"}</div>
        <h1 className="h1 mt-0.5">Settings</h1>
      </header>
      <div className="flex flex-wrap items-start gap-6">
        <SettingsNav items={items} />
        <div className="min-w-0 flex-[999_1_560px]">{children}</div>
      </div>
    </div>
  );
}
