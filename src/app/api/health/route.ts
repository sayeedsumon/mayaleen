import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

/**
 * Deployment self-check. Reports whether required settings are present and valid and whether the
 * database answers. Never returns secret values, only true/false and a short error class.
 */
export async function GET() {
  const env = {
    DATABASE_URL: !!process.env.DATABASE_URL,
    DIRECT_URL: !!process.env.DIRECT_URL,
    SESSION_SECRET: (process.env.SESSION_SECRET?.length ?? 0) >= 16,
    FIELD_ENCRYPTION_KEY: /^[0-9a-f]{64}$/i.test(process.env.FIELD_ENCRYPTION_KEY ?? ""),
  };
  let db: { ok: boolean; users?: number; error?: string } = { ok: false };
  try {
    db = { ok: true, users: await prisma.user.count() };
  } catch (e) {
    const err = e as { code?: string; name?: string };
    db = { ok: false, error: err.code ?? err.name ?? "UnknownError" };
  }
  const ok = db.ok && Object.values(env).every(Boolean);
  return Response.json({ ok, env, db }, { status: ok ? 200 : 503 });
}
