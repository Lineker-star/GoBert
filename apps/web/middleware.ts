import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";

const intl = createMiddleware({
  locales: ["fr", "en"],
  defaultLocale: "fr",
});

// The demo backend has no authentication. It only exists when mocks are explicitly
// enabled — in production every /api/mock request gets a 404.
const MOCKS_ENABLED = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

export default function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/mock")) {
    if (!MOCKS_ENABLED) return new NextResponse("Not found", { status: 404 });
    const origin = req.headers.get("origin") ?? "";
    // Only the local admin console may call the demo API cross-origin.
    const allowed = /^http:\/\/localhost:\d+$/.test(origin) ? origin : "";
    const cors: Record<string, string> = {
      "Access-Control-Allow-Origin": allowed,
      "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      Vary: "Origin",
    };
    if (req.method === "OPTIONS") return new NextResponse(null, { status: 204, headers: cors });
    const res = NextResponse.next();
    for (const [k, v] of Object.entries(cors)) if (v) res.headers.set(k, v);
    return res;
  }
  return intl(req);
}

export const config = {
  matcher: ["/((?!_next|_vercel|.*\\..*).*)"],
};
