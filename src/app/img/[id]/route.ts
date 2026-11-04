import { prisma } from "@/server/db";

/** Public website photos uploaded in Settings › Photos. Ids are never reused, so caching forever is safe. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const f = await prisma.sitePhoto.findUnique({ where: { id }, select: { data: true, mime: true, size: true } });
  if (!f) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(f.data), {
    headers: {
      "content-type": f.mime,
      "content-length": String(f.size),
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
