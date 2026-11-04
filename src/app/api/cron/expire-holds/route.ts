import { expireHolds } from "@/server/booking-service";

export const dynamic = "force-dynamic";

/**
 * Releases unpaid holds past their deadline (BR-10/11). Called by Vercel Cron, which sends
 * `Authorization: Bearer $CRON_SECRET`. Admin pages also sweep on load, so holds still
 * expire on time when the cron runs less often.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const released = await expireHolds(new Date());
  return Response.json({ ok: true, released });
}
