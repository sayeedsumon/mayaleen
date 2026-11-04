import { getCurrentUser } from "@/server/auth/current-user";
import { can } from "@/server/auth/permissions";
import { prisma } from "@/server/db";

/** Staff-only view of a guest's payment screenshot (NFR-06: restricted, never public). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "VIEW_OPERATIONS")) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const f = await prisma.proofFile.findUnique({ where: { paymentId: id } });
  if (!f) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(f.data), {
    headers: {
      "content-type": f.mime,
      "content-length": String(f.size),
      "content-disposition": `inline; filename="proof-${id}.${f.mime === "application/pdf" ? "pdf" : f.mime.split("/")[1]}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
