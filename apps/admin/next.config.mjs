/**
 * The admin console is only reachable under a secret path, e.g.
 *   ADMIN_BASE_PATH=/ops-7f3k9q2m8x  →  https://admin.example.cm/ops-7f3k9q2m8x/login
 * Every other URL returns 404. Production builds refuse to start without it.
 */
const basePath = process.env.ADMIN_BASE_PATH || "";
const isProd = process.env.NODE_ENV === "production";

if (basePath && !/^\/[A-Za-z0-9_-]{12,}$/.test(basePath)) {
  throw new Error("ADMIN_BASE_PATH must look like /some-secret-slug (letters, digits, - or _, at least 12 characters).");
}
if (isProd && !basePath && process.env.NEXT_PUBLIC_USE_MOCKS !== "true") {
  throw new Error("Set ADMIN_BASE_PATH (secret URL path) before building the admin console for production.");
}

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host;
  } catch {
    return "";
  }
})();

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${supabaseHost ? ` https://${supabaseHost}` : ""}`,
  "font-src 'self' data:",
  `connect-src 'self'${supabaseHost ? ` https://${supabaseHost} wss://${supabaseHost}` : ""}${isProd ? "" : " http://localhost:* ws:"}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  basePath: basePath || undefined,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // Lets a second instance (e.g. CI or a preview build) run without clobbering the dev server's .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
