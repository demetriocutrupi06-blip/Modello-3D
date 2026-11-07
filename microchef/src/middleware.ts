import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath, safeEqual, SESSION_COOKIE, sessionToken } from "@/lib/auth";

/** Se APP_PASSWORD è impostata (online), tutte le pagine e le API richiedono l'accesso. */
export async function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  const { pathname, search } = req.nextUrl;
  if (!password || isPublicPath(pathname)) return NextResponse.next();

  const cookie = req.cookies.get(SESSION_COOKIE)?.value ?? "";
  if (cookie && safeEqual(cookie, await sessionToken(password))) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Accesso richiesto: inserisci la password." }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?da=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
