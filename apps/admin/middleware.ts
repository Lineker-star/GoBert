import { NextRequest, NextResponse } from "next/server";

/**
 * Optional network restriction for the admin console:
 *   ADMIN_ALLOWED_IPS=41.202.1.10,102.244.0.0/16   (exact IPs or IPv4 /CIDR)
 * Anyone else gets a plain 404, so the console does not even reveal it exists.
 */
const RULES = (process.env.ADMIN_ALLOWED_IPS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function allowed(ip: string): boolean {
  return RULES.some((rule) => {
    if (!rule.includes("/")) return rule === ip;
    const [base, bitsStr] = rule.split("/");
    const a = ipv4ToInt(ip);
    const b = ipv4ToInt(base);
    const bits = Number(bitsStr);
    if (a === null || b === null || !(bits >= 0 && bits <= 32)) return false;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (a & mask) === (b & mask);
  });
}

export function middleware(req: NextRequest) {
  if (RULES.length === 0) return NextResponse.next();
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";
  if (!ip || !allowed(ip)) return new NextResponse("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex" } });
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
