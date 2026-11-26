// Visual smoke test of the app-style UI and the guest booking flow.
//   SHOT_BASE=http://localhost:3100 ADMIN_BASE=http://localhost:3101 node scripts/shoot-v2.mjs
import { chromium } from "@playwright/test";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";

const OUT = fileURLToPath(new URL("../../../docs/screens/r11", import.meta.url));
mkdirSync(OUT, { recursive: true });
const BASE = process.env.SHOT_BASE || "http://localhost:3000";
const ADMIN = process.env.ADMIN_BASE || "http://localhost:3001";
const errors = [];

const shot = async (page, name, full = false) => {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  console.log("captured", name);
};
const watch = (page, label) => {
  page.on("pageerror", (e) => errors.push(`[${label}] ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/openstreetmap|osrm|photon|nominatim|Failed to load resource|pravatar/i.test(m.text())) errors.push(`[${label}] ${m.text().slice(0, 200)}`);
  });
};

const browser = await chromium.launch();

// Home = booking map (desktop: sidebar app layout)
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 }, geolocation: { latitude: 4.5776, longitude: 13.6852 }, permissions: ["geolocation"] });
  const page = await ctx.newPage();
  watch(page, "home-desktop");
  await page.goto(`${BASE}/fr`, { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  await shot(page, "01-home-desktop");
  // GPS pickup + typed destination
  await page.getByRole("button", { name: "Ma position" }).first().click();
  await page.waitForTimeout(1500);
  await page.getByLabel("Arrivée").fill("Mokolo");
  await page.getByRole("button", { name: /Mokolo/ }).first().click();
  await page.waitForTimeout(5000);
  await shot(page, "02-home-route-desktop");
  await ctx.close();
}

// Mobile guest books a ride without any account
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  watch(page, "guest-mobile");
  await page.goto(`${BASE}/fr`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await shot(page, "03-home-mobile");
  await page.getByLabel("Départ").fill("Marché");
  await page.getByRole("button", { name: /Marché Central/ }).first().click();
  await page.getByLabel("Arrivée").fill("Hôpital");
  await page.getByRole("button", { name: /Hôpital Régional/ }).first().click();
  await page.waitForTimeout(5000);
  await shot(page, "04-mobile-vehicles");
  await page.getByRole("button", { name: /^Réserver Moto/ }).click();
  await page.waitForURL(/booking\?id=/, { timeout: 30000 });
  await shot(page, "05-guest-booked");
  console.log("guest booking url:", page.url().replace(BASE, ""));
  // guest gating
  await page.goto(`${BASE}/fr/directory`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await shot(page, "06-directory-guest");
  const firstProvider = page.locator('a[href*="/providers/"]').first();
  await firstProvider.click();
  await page.waitForURL(/providers\//);
  await shot(page, "07-provider-locked");
  await ctx.close();
}

// Auth methods + partners page (no website footer)
{
  const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });
  watch(page, "auth");
  await page.goto(`${BASE}/fr/auth?role=customer`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "E-mail" }).click();
  await shot(page, "08-auth-email");
  await page.goto(`${BASE}/fr/partners`, { waitUntil: "networkidle" });
  await shot(page, "09-partners", true);
  const footers = await page.locator("footer").count();
  console.log("footer elements on partners page:", footers);
  await page.close();
}

// Admin login (2FA flow entry)
{
  const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });
  watch(page, "admin");
  await page.goto(`${ADMIN}/login`, { waitUntil: "networkidle" });
  await shot(page, "10-admin-login");
  await page.close();
}

await browser.close();
console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nno page errors");
