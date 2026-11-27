// Checks that the live app attaches a Cloudflare Turnstile token to Supabase Auth calls,
// without creating any account or data (uses the SMS-code request, which only asks
// Supabase to text a code).
//   SHOT_BASE=https://gobert.online node scripts/check-captcha.mjs
import { chromium } from "@playwright/test";

const BASE = process.env.SHOT_BASE || "https://gobert.online";
const PHONE = process.env.TEST_PHONE || "690990009";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const problems = [];
page.on("console", (m) => {
  // "data:," errors come from inside Cloudflare's own iframe (its CSP), not from GoBert.
  if (m.type() === "error" && /Content Security Policy|turnstile|challenges\.cloudflare/i.test(m.text()) && !/data:,/.test(m.text())) problems.push(m.text().slice(0, 200));
});
let otpBody = null;
page.on("request", (r) => {
  if (r.url().includes("/auth/v1/otp")) otpBody = r.postData();
});
await page.goto(`${BASE}/fr/auth?role=customer`, { waitUntil: "networkidle" });
await page.locator("#phone").fill(PHONE);
await page.getByRole("button", { name: /Recevoir le code/ }).click();
for (let i = 0; i < 40 && !otpBody; i++) await page.waitForTimeout(500);
await page.waitForTimeout(1500);
const alert = ((await page.locator('[role="alert"]').first().textContent().catch(() => "")) ?? "").trim();
const token = otpBody ? JSON.parse(otpBody)?.gotrue_meta_security?.captcha_token : null;
const shown = await page.locator('[data-captcha="turnstile"]').count();
console.log(
  token
    ? `PASS  Turnstile token attached (${token.length} chars)`
    : shown
      ? "PASS  Turnstile challenge shown (Cloudflare asks automated browsers to click; real visitors usually pass silently)"
      : `FAIL  no Turnstile token or challenge (request sent: ${!!otpBody})`,
);
console.log(`INFO  message shown: ${alert || "(none)"}`);
console.log(problems.length ? `FAIL  console:\n${problems.join("\n")}` : "PASS  no CSP / Turnstile errors");
await browser.close();
