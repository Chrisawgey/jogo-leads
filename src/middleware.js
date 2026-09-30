import { NextResponse } from "next/server";
import { readSession, SESSION_COOKIE } from "./lib/session";

const PUBLIC_PATHS = new Set(["/login", "/api/login", "/favicon.ico", "/JOGOLOGO.png"]);

// Everything except the login screen requires a valid session
export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next's own build assets; everything else goes through the check above
  matcher: ["/((?!_next/).*)"],
};
