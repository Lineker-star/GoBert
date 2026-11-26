// Visual smoke test of the three-role experience. Usage:
//   SHOT_BASE=http://localhost:3100 ADMIN_BASE=http://localhost:3101 node scripts/shoot-roles.mjs
import { chromium } from "@playwright/test";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";

const OUT = fileURLToPath(new URL("../../../docs/screens/r10", import.meta.url));
mkdirSync(OUT, { recursive: true });
const BASE = process.env.SHOT_BASE || "http://localhost:3000";
const ADMIN = process.env.ADMIN_BASE || "http://localhost:3001";
const errors = [];

async function shot(page, name, full = true) {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  console.log("captured", name);
}

function watch(page, label) {
  page.on("pageerror", (e) => errors.push(`[${label}] pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/tile\.openstreetmap|Failed to load resource|nominatim|photon/i.test(m.text())) errors.push(`[${label}] console: ${m.text().slice(0, 200)}`);
  });
}

async function login(page, phone, session) {
  // Seed a mock session directly (same shape the app stores after OTP).
  await page.goto(`${BASE}/fr`, { waitUntil: "domcontentloaded" });
  await page.evaluate((s) => localStorage.setItem("gobert:session", JSON.stringify(s)), session);
}

const browser = await chromium.launch();

// ---- landing (desktop + mobile)
for (const [w, h, tag] of [[1280, 800, "desktop"], [390, 844, "mobile"]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  watch(page, `landing-${tag}`);
  await page.goto(`${BASE}/fr`, { waitUntil: "networkidle" });
  await shot(page, `01-landing-${tag}`);
  await page.close();
}

// ---- real sign-up flow: new rider via the UI
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  watch(page, "signup");
  await page.goto(`${BASE}/fr/auth`, { waitUntil: "networkidle" });
  await shot(page, "02-auth-roles", false);
  await page.getByRole("button", { name: /Rider/ }).first().click();
  await page.locator("#phone").fill(`69${String(Date.now()).slice(-7)}`);
  await shot(page, "03-auth-phone", false);
  await page.getByRole("button", { name: /Recevoir le code/ }).click();
  await page.locator('input[autocomplete="one-time-code"]').fill("123456");
  await page.getByRole("button", { name: /^Vérifier/ }).click();
  await page.locator("#name").waitFor();
  await page.locator("#name").fill("Eric Mbah");
  await page.locator('input[type="checkbox"]').check();
  await shot(page, "04-auth-profile", false);
  await page.getByRole("button", { name: /Continuer vers la vérification/ }).click();
  await page.waitForURL(/onboard/);
  await shot(page, "05-onboard-rider-step1");
  await page.getByRole("button", { name: /Suivant/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Suivant/ }).click(); // should show validation errors on vehicle step
  await shot(page, "06-onboard-vehicle-errors");
  await page.close();
}

// ---- approved rider dashboard (account approved in the API run)
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  watch(page, "rider");
  await login(page, null, { id: "u-237690001122", phone: "+237690001122", anonymous: false });
  await page.goto(`${BASE}/fr/dashboard`, { waitUntil: "networkidle" });
  await shot(page, "07-rider-dashboard");
  await page.goto(`${BASE}/fr/profile`, { waitUntil: "networkidle" });
  await shot(page, "08-rider-profile");
  await page.close();
}

// ---- business dashboard
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  watch(page, "business");
  await login(page, null, { id: "u-237677889900", phone: "+237677889900", anonymous: false });
  await page.goto(`${BASE}/fr/dashboard`, { waitUntil: "networkidle" });
  await shot(page, "09-business-dashboard");
  await page.close();
}

// ---- customer (guest) dashboard, map, booking review, directory, rent
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  watch(page, "customer");
  await login(page, null, { id: "anon-demo", phone: null, anonymous: true });
  await page.goto(`${BASE}/fr/dashboard`, { waitUntil: "networkidle" });
  await shot(page, "10-customer-dashboard");
  await page.goto(`${BASE}/fr/booking?lat=4.5895&lng=13.6963&label=Mokolo&plat=4.5774&plng=13.6846&plabel=Bertoua%20Centre&vehicle=moto`, { waitUntil: "networkidle" });
  await shot(page, "11-booking-review");
  await page.goto(`${BASE}/fr/directory`, { waitUntil: "networkidle" });
  await shot(page, "12-directory");
  await page.goto(`${BASE}/en/rent`, { waitUntil: "networkidle" });
  await shot(page, "13-rent-en");
  await page.close();
}

// ---- admin
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  watch(page, "admin");
  await page.goto(`${ADMIN}/login`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.setItem("gobert:admin", JSON.stringify({ email: "admin@gobert.cm" })));
  await page.goto(`${ADMIN}/overview`, { waitUntil: "networkidle" });
  await shot(page, "14-admin-overview");
  await page.goto(`${ADMIN}/providers?status=pending`, { waitUntil: "networkidle" });
  await shot(page, "15-admin-queue");
  const first = page.locator('a:has-text("Examiner")').first();
  if (await first.count()) {
    await first.click();
    await page.waitForURL(/providers\/.+/);
    await shot(page, "16-admin-review");
  }
  await page.close();
}

await browser.close();
console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno page errors");
