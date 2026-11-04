import Link from "next/link";
import type { ReactNode } from "react";
import { requireUser } from "@/server/auth/current-user";
import { logoutAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const links = [
    ["/admin", "Dashboard"],
    ["/admin/calendar", "Calendar"],
    ["/admin/timeline", "Timeline"],
    ["/admin/bookings", "Bookings"],
    ["/admin/bookings/new", "New booking"],
    ["/admin/manifest", "Manifest"],
  ];
  return (
    <div className="min-h-screen">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-slate-900 px-4 py-3 text-white">
        <span className="font-semibold">Mayaleen</span>
        <nav className="flex flex-wrap gap-4 text-sm">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="hover:underline">{label}</Link>
          ))}
        </nav>
        <form action={logoutAction} className="ml-auto text-sm">
          <span className="mr-3 opacity-70">{user.name} ({user.role.toLowerCase().replace("_", " ")})</span>
          <button className="underline">Sign out</button>
        </form>
      </header>
      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </div>
  );
}
