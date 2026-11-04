import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/current-user";
import { can } from "@/server/auth/permissions";

export default async function SettingsIndex() {
  const user = await requireUser();
  redirect(can(user.role, "ADMIN_SETTINGS") ? "/admin/settings/rates" : "/admin/settings/account");
}
