import type { BookingStatus } from "@prisma/client";
import { getCurrentUser } from "@/server/auth/current-user";
import { can } from "@/server/auth/permissions";
import { searchBookings } from "@/server/queries";

const esc = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formulas
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "VIEW_OPERATIONS")) return new Response("Unauthorized", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const lines = [["reference", "trip_date", "type", "status", "source", "lead_guest", "mobile", "total", "paid"].join(",")];
  for (let page = 1; page <= 200; page++) {
    const r = await searchBookings({
      q: sp.get("q") ?? undefined, status: (sp.get("status") || undefined) as BookingStatus | undefined,
      type: (sp.get("type") || undefined) as never, source: sp.get("source") || undefined, when: sp.get("when") || undefined, page,
    });
    for (const b of r.rows) {
      lines.push([b.reference, b.tripDate.toISOString().slice(0, 10), b.type, b.status, b.source, b.leadGuest.name, b.leadGuest.mobile, b.invoices[0]?.total ?? "", b.paid].map(esc).join(","));
    }
    if (page >= r.pages) break;
  }
  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="bookings.csv"' },
  });
}
