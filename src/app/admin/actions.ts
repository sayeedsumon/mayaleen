"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { RuleError } from "@/domain";
import { SESSION_COOKIE } from "@/server/auth/current-user";
import { verifyPassword } from "@/server/auth/password";
import { createSessionToken } from "@/server/auth/session";
import { verifyTotp } from "@/server/auth/totp";
import { prisma } from "@/server/db";
import { clearLogin, isLockedOut, recordFailedLogin } from "@/server/settings-service";
import { fail, str } from "./_lib/form";

export async function loginAction(form: FormData) {
  const mobile = str(form, "mobile").replace(/[^0-9]/g, "");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const keys = [`m:${mobile}`, `ip:${ip}`];
  let user;
  try {
    for (const k of keys) {
      if (await isLockedOut(k)) throw new RuleError("LOCKED", "Too many attempts. Try again in 10 minutes.");
    }
    user = await prisma.user.findUnique({ where: { mobile } });
  } catch (e) {
    if (e instanceof RuleError) fail("/admin/login", e);
    console.error("login: database error", e);
    fail("/admin/login", new RuleError("DB_DOWN", "Cannot reach the database. Check /api/health."));
  }
  const ok =
    !!user && user.active && verifyPassword(str(form, "password"), user.pwHash) &&
    (!user.twoFaOn || (!!user.totpSecret && verifyTotp(user.totpSecret, str(form, "code"))));
  if (!ok || !user) {
    for (const k of keys) await recordFailedLogin(k);
    const needs2fa = !!user?.twoFaOn && !str(form, "code");
    fail("/admin/login", new RuleError("BAD_LOGIN", needs2fa ? "Enter the 6-digit code from your authenticator app" : "Wrong mobile, password or code"));
  }
  for (const k of keys) await clearLogin(k);
  (await cookies()).set(SESSION_COOKIE, createSessionToken(user.id, user.role), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 12 * 3600,
  });
  redirect("/admin");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}
