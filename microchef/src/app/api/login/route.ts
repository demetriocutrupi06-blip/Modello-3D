import { NextResponse } from "next/server";
import { safeEqual, SESSION_COOKIE, SESSION_MAX_AGE, sessionToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return NextResponse.json({ ok: true });
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (typeof password !== "string" || !safeEqual(password, expected)) {
    await new Promise((r) => setTimeout(r, 800)); // rallenta i tentativi a caso
    return NextResponse.json({ error: "Password sbagliata." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await sessionToken(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
