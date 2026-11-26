// Live smoke test against the real Supabase project (no passwords involved).
//   SHOT_BASE=http://localhost:3100 ADMIN_BASE=http://localhost:3101 ADMIN_PATH=/ops-… node scripts/shoot-live.mjs
import { chromium } from "@playwright/test";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";

const OUT = fileURLToPath(new URL("../../../docs/screens/r12-live", import.meta.url));
mkdirSync(OUT, { recursive: true });
const BASE = process.env.SHOT_BASE || "http://localhost:3000";
const ADMIN = process.env.ADMIN_BASE || "http://localhost:3001";
const ADMIN_PATH = process.env.ADMIN_PATH || "";
const errors = [];
const results = [];
const check = (name, ok, extra = "") => results.push(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
const shot = async (page, name) => {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${name}.png` });
};
const watch = (page, label) => {
  page.on("pageerror", (e) => errors.push(`[${label}] ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/openstreetmap|osrm|photon|nominatim|Failed to load resource|pravatar|status of 4\d\d/i.test(m.text())) errors.push(`[${label}] ${m.text().slice(0, 200)}`);
  });
};

const browser = await chromium.launch();

// Demo API must be gone in live mode
{
  const page = await browser.newPage();
  const res = await page.request.get(`${BASE}/api/mock/admin/queue`);
  check("demo API disabled (/api/mock → 404)", res.status() === 404, String(res.status()));
  await page.close();
}

// Guest books a real trip through the UI
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  watch(page, "guest");
  await page.goto(`${BASE}/fr`, { waitUntil: "networkidle" });
  await page.waitForTimeout(5000);
  const online = await page.locator("text=/rider(s)? en ligne/").first().textContent().catch(() => "");
  check("home shows live online riders from Supabase", /[1-9]\d* rider/.test(online ?? ""), online ?? "");
  await page.getByLabel("Départ").fill("Marché");
  await page.getByRole("button", { name: /Marché Central/ }).first().click();
  await page.getByLabel("Arrivée").fill("Hôpital");
  await page.getByRole("button", { name: /Hôpital Régional/ }).first().click();
  await page.waitForTimeout(6000);
  const price = await page.getByRole("button", { name: /^Réserver Moto · / }).textContent().catch(() => "");
  check("fare from estimate_trip()", /\d/.test(price ?? ""), (price ?? "").trim());
  await shot(page, "01-live-quote");
  await page.getByRole("button", { name: /^Réserver Moto/ }).click();
  let booked = false;
  try {
    await page.waitForURL(/booking\?id=/, { timeout: 30000 });
    booked = true;
  } catch {
    // fall through
  }
  check("guest booking created without an account (anonymous auth + create_trip)", booked, page.url().replace(BASE, ""));
  await page.waitForTimeout(4000);
  await shot(page, "02-live-searching");
  const searching = await page.locator("text=Recherche d'un rider").count();
  check("trip status read back via get_trip()", searching > 0);
  // cancel so no real rider is disturbed
  const cancel = page.getByRole("button", { name: /Annuler la course/ });
  if (await cancel.count()) {
    await cancel.click();
    await page.waitForTimeout(4000);
    check("guest can cancel own trip (set_trip_status)", (await page.locator("text=Course annulée").count()) > 0);
    await shot(page, "03-live-cancelled");
  }
  // Directory from the database; guests never get phone numbers
  await page.goto(`${BASE}/fr/directory`, { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  const cards = await page.locator('a[href*="/providers/"]').count();
  const telLinks = await page.locator('a[href^="tel:"]').count();
  check("directory lists approved providers from Supabase", cards > 0, `${cards} providers`);
  check("guests get no phone numbers", telLinks === 0, `${telLinks} tel: links`);
  await shot(page, "04-live-directory");
  await page.locator('a[href*="/providers/"]').first().click();
  await page.waitForURL(/providers\//);
  await page.waitForTimeout(4000);
  check("provider offers locked for guests", (await page.locator("text=Connectez-vous pour voir les offres").count()) > 0);
  await shot(page, "05-live-provider-locked");
  await ctx.close();
}

// SMS sign-in without an SMS provider configured: clear message, no crash
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  watch(page, "auth");
  await page.goto(`${BASE}/fr/auth?role=customer`, { waitUntil: "networkidle" });
  await page.locator("#phone").fill("690990009");
  await page.getByRole("button", { name: /Recevoir le code/ }).click();
  await page.waitForTimeout(5000);
  const alert = (await page.locator('[role="alert"]').first().textContent().catch(() => "")) ?? "";
  check("SMS code without Twilio shows a clear message", alert.length > 0, alert.trim());
  await shot(page, "06-live-sms-no-provider");
  await page.close();
}

// Admin console only under the secret path
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  watch(page, "admin");
  const plain = await page.request.get(`${ADMIN}/login`);
  check("admin console hidden without secret path", plain.status() === 404, String(plain.status()));
  const secret = await page.goto(`${ADMIN}${ADMIN_PATH}/login`, { waitUntil: "networkidle" });
  check("admin login reachable at secret path", secret?.status() === 200, String(secret?.status()));
  check("no demo-mode banner in live admin", (await page.locator("text=Mode démo").count()) === 0);
  await shot(page, "07-live-admin-login");
  await page.goto(`${ADMIN}${ADMIN_PATH}/overview`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  check("admin pages redirect to login without a 2FA session", page.url().endsWith("/login"), page.url().replace(ADMIN, ""));
  await page.close();
}

await browser.close();
console.log(results.join("\n"));
console.log(errors.length ? `\nPAGE ERRORS:\n${errors.join("\n")}` : "\nno page errors");
