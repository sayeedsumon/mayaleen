import { NextResponse } from "next/server";

/** Language switch: /lang?to=bn&back=/book */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const to = url.searchParams.get("to") === "bn" ? "bn" : "en";
  const back = url.searchParams.get("back") ?? "/";
  const safe = back.startsWith("/") && !back.startsWith("//") ? back : "/";
  const res = NextResponse.redirect(new URL(safe, url.origin));
  res.cookies.set("lang", to, { path: "/", maxAge: 365 * 86400, sameSite: "lax" });
  return res;
}
