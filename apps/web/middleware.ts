import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";

const intl = createMiddleware({
  locales: ["fr", "en"],
  defaultLocale: "fr",
});

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

export default function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/mock")) {
    if (req.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: CORS });
    }
    const res = NextResponse.next();
    for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
    return res;
  }
  return intl(req);
}

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};