import { createHmac, timingSafeEqual } from "node:crypto";
import type { Role } from "@prisma/client";

export interface SessionData {
  uid: string;
  role: Role;
  exp: number; // epoch ms
}

const TTL_MS = 12 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set");
    return "dev-only-session-secret-change-me";
  }
  return s;
}

const sign = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

export function createSessionToken(uid: string, role: Role, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ uid, role, exp: now + TTL_MS } satisfies SessionData)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readSessionToken(token: string | undefined, now = Date.now()): SessionData | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(sign(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionData;
    return data.exp > now ? data : null;
  } catch {
    return null;
  }
}
