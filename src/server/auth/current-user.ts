import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../db";
import { can, type Capability } from "./permissions";
import { readSessionToken } from "./session";

export const SESSION_COOKIE = "mayaleen_session";

export async function getCurrentUser() {
  const jar = await cookies();
  const s = readSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!s) return null;
  const user = await prisma.user.findUnique({ where: { id: s.uid } });
  return user && user.active ? user : null;
}

/** Use at the top of pages and server actions. Redirects to login when signed out. */
export async function requireUser(cap?: Capability) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (cap && !can(user.role, cap)) redirect("/admin?denied=1");
  return user;
}
