// End-to-end test of the whole app in demo mode (NEXT_PUBLIC_USE_MOCKS=true). Nothing leaves the machine.
//   SHOT_BASE=http://localhost:3200 ADMIN_BASE=http://localhost:3201 node scripts/e2e-mock.mjs
// Checks: the sign-up flows of all three account types, the "signed in without a profile" redirect,
// guest booking, and a crawl of every page (HTTP status, JS errors, console errors, missing
// translations, horizontal overflow on phones) for guests, customers, riders, businesses and admins.
import { chromium } from "@playwright/test";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";

const OUT = fileURLToPath(new URL("../../../docs/screens/r13-e2e", import.meta.url));
mkdirSync(OUT, { recursive: true });
const BASE = process.env.SHOT_BASE || "http://localhost:3200";
const ADMIN = process.env.ADMIN_BASE || "http://localhost:3201";
const ADMIN_PATH = process.env.ADMIN_PATH || "";
const results = [];
const problems = [];
const check = (name, ok, extra = "") => {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? ` — ${extra}` : ""}`);
  return ok;
};
const IGNORED = /openstreetmap|osrm|photon|nominatim|Failed to load resource|pravatar|status of 4\d\d|Download the React DevTools|\[HMR\]|\[Fast Refresh\]/i;

function watch(page, label) {
  page.on("pageerror", (e) => problems.push(`[${label}] JS error: ${e.message.slice(0, 300)}`));
  page.on("console", (m) => {
    if ((m.type() === "error" || /MISSING_MESSAGE/.test(m.text())) && !IGNORED.test(m.text())) problems.push(`[${label}] console: ${m.text().slice(0, 300)}`);
  });
}

async function shot(page, name) {
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}.png` }).catch(() => undefined);
}

/** Visit a page and check it renders cleanly. */
async function visit(page, label, path, { mobile = false } = {}) {
  const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 90000 }).catch((e) => {
    problems.push(`[${label}] ${path} navigation failed: ${e.message.slice(0, 160)}`);
    return null;
  });
  await page.waitForTimeout(1500);
  const status = res?.status() ?? 0;
  if (status >= 400) problems.push(`[${label}] ${path} → HTTP ${status}`);
  const info = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    // next-intl prints "namespace.key" when a message is missing
    rawKeys: (document.body.innerText.match(/\b(?:[a-z][a-zA-Z]+\.){1,4}[a-z][a-zA-Z]+\b/g) || []).filter((k) => !/^(www|gobert|exemple|example|nom|admin|e2e)\.|\.(cm|com|org|net|fr|en|io|png|jpg|webp)$/.test(k)),
    errorPage: /Application error|Unhandled Runtime Error|This page could not be found/.test(document.body.innerText),
  })).catch(() => ({ overflow: 0, rawKeys: [], errorPage: false }));
  if (mobile && info.overflow > 2) problems.push(`[${label}] ${path} scrolls sideways on phones (${info.overflow}px)`);
  if (info.rawKeys.length) problems.push(`[${label}] ${path} shows untranslated keys: ${[...new Set(info.rawKeys)].slice(0, 5).join(", ")}`);
  if (info.errorPage) problems.push(`[${label}] ${path} shows an error page`);
  return status;
}

const PUBLIC_PAGES = ["/fr", "/en", "/fr/auth", "/fr/directory", "/fr/rent", "/fr/express", "/fr/assistant", "/fr/partners", "/en/partners", "/fr/dashboard"];
const REDIRECTS = ["/fr/map", "/fr/rides", "/fr/account", "/fr/vehicles", "/fr/owner/list-vehicle"];

const browser = await chromium.launch();
const phoneCtx = () =>
  browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, geolocation: { latitude: 4.5776, longitude: 13.6852 }, permissions: ["geolocation"] });

// 1. Visitors: every public page on a phone
{
  const ctx = await phoneCtx();
  const page = await ctx.newPage();
  watch(page, "visitor");
  for (const p of PUBLIC_PAGES) await visit(page, "visitor", p, { mobile: true });
  for (const p of REDIRECTS) {
    const s = await visit(page, "visitor", p, { mobile: true });
    await page.waitForTimeout(3000);
    check(`old link ${p} still works`, s > 0 && s < 400, `${s} → ${page.url().replace(BASE, "")}`);
  }
  await page.goto(`${BASE}/fr/directory`, { waitUntil: "networkidle" });
  const card = page.locator('a[href*="/providers/"]').first();
  await card.waitFor({ timeout: 20000 }).catch(() => undefined);
  if (check("directory lists providers", (await card.count()) > 0)) {
    const href = await card.getAttribute("href");
    await visit(page, "visitor", href, { mobile: true });
    const locked = await page.locator("text=Connectez-vous pour voir les offres").first().waitFor({ timeout: 15000 }).then(() => true, () => false);
    check("provider offers locked for visitors", locked);
    check("visitors get no phone numbers", (await page.locator('a[href^="tel:"]').count()) === 0);
  }
  await ctx.close();
}

// 2. Customer signs up with email + password; the chosen account type survives to the profile step
{
  const ctx = await phoneCtx();
  const page = await ctx.newPage();
  watch(page, "customer-signup");
  await page.goto(`${BASE}/fr/auth`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Client/ }).first().click();
  await page.getByRole("tab", { name: "E-mail" }).click();
  await page.locator("#login-email").fill(`client${Date.now()}@exemple.cm`);
  await page.locator("#password").fill("demo1234");
  await page.getByRole("button", { name: /^Créer mon compte/ }).click();
  await page.locator("#name").waitFor({ timeout: 20000 });
  check("email sign-up → profile step", true);
  check("account type kept on the profile step", (await page.locator('[role="radio"][aria-checked="true"]').textContent())?.includes("Client") ?? false);
  await shot(page, "01-customer-profile-step");
  // Leaving before finishing: any page sends them back to the profile step
  await page.goto(`${BASE}/fr`, { waitUntil: "networkidle" });
  await page.waitForURL(/auth\?step=profile/, { timeout: 15000 }).catch(() => undefined);
  check("unfinished sign-up → sent back to the profile step from home", page.url().includes("step=profile"), page.url().replace(BASE, ""));
  await page.locator("#name").waitFor({ timeout: 20000 });
  await page.getByRole("radio", { name: /Client/ }).click();
  await page.locator("#name").fill("Awa Nkolo");
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: /^Créer mon compte/ }).click();
  await page.waitForURL((u) => /\/fr\/?$/.test(u.pathname), { timeout: 20000 }).catch(() => undefined);
  check("customer lands on the booking home after sign-up", /\/fr\/?$/.test(new URL(page.url()).pathname), page.url().replace(BASE, ""));
  for (const p of ["/fr", "/fr/dashboard", "/fr/trips", "/fr/profile", "/fr/directory", "/fr/rent", "/fr/express", "/fr/assistant"]) await visit(page, "customer", p, { mobile: true });
  check("customer onboarding page is refused", (await visit(page, "customer", "/fr/onboard"), !page.url().includes("/onboard")), page.url().replace(BASE, ""));
  await ctx.close();
}

// 3. Guest books a ride (no account)
{
  const ctx = await phoneCtx();
  const page = await ctx.newPage();
  watch(page, "guest-booking");
  await page.goto(`${BASE}/fr`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.getByLabel("Départ").fill("Marché");
  await page.getByRole("button", { name: /Marché Central/ }).first().click();
  await page.getByLabel("Arrivée").fill("Hôpital");
  await page.getByRole("button", { name: /Hôpital Régional/ }).first().click();
  const book = page.getByRole("button", { name: /^Réserver .*d/ }).first();
  await book.waitFor({ timeout: 4000 }).catch(() => undefined); // a price must show within 4 s
  check("fare shown before booking", /\d/.test((await book.textContent().catch(() => "")) ?? ""), ((await book.textContent().catch(() => "")) ?? "").trim());
  await book.click();
  const booked = await page.waitForURL(/booking\?id=/, { timeout: 30000 }).then(() => true, () => false);
  check("guest booking created", booked, page.url().replace(BASE, ""));
  await page.waitForTimeout(2500);
  await shot(page, "02-guest-booking");
  await visit(page, "guest", "/fr/trips", { mobile: true });
  await ctx.close();
}

// 4. Rider signs up by SMS code; business by phone + password → both go to verification
for (const [kind, label, method] of [["rider", /Rider/, "sms"], ["business", /Prestataire/, "password"]]) {
  const ctx = await phoneCtx();
  const page = await ctx.newPage();
  watch(page, `${kind}-signup`);
  await page.goto(`${BASE}/fr/auth`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: label }).first().click();
  const phone = `6${kind === "rider" ? 9 : 7}${String(Date.now()).slice(-7)}`;
  if (method === "password") {
    await page.getByRole("tab", { name: /mot de passe/ }).click();
    await page.locator("#phone").fill(phone);
    await page.locator("#password").fill("demo1234");
    await page.getByRole("button", { name: /^Créer mon compte/ }).click();
  } else {
    await page.locator("#phone").fill(phone);
    await page.getByRole("button", { name: /Recevoir le code/ }).click();
    await page.locator('input[autocomplete="one-time-code"]').fill("123456");
    await page.getByRole("button", { name: /^Vérifier/ }).click();
  }
  await page.locator("#name").waitFor({ timeout: 20000 });
  await page.locator("#name").fill(kind === "rider" ? "Eric Mbah" : "Est Logistique");
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: /Continuer vers la vérification/ }).click();
  const onboard = await page.waitForURL(/onboard/, { timeout: 20000 }).then(() => true, () => false);
  check(`${kind} sign-up (${method}) → verification form`, onboard, page.url().replace(BASE, ""));
  await page.waitForTimeout(1500);
  await shot(page, `03-${kind}-onboard`);
  for (const p of ["/fr/dashboard", "/fr/profile", "/fr/onboard"]) await visit(page, kind, p, { mobile: true });
  check(`unverified ${kind} sees the verification status`, (await page.goto(`${BASE}/fr/dashboard`, { waitUntil: "networkidle" }), await page.waitForTimeout(2000), (await page.locator("text=/vérification|Vérification|dossier/").count()) > 0));
  await ctx.close();
}

// 5. Approved rider and business (seed accounts): dashboards and their pages, desktop
for (const [kind, id, phone] of [["rider", "u-237690001122", "+237690001122"], ["business", "u-237677889900", "+237677889900"]]) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, geolocation: { latitude: 4.5776, longitude: 13.6852 }, permissions: ["geolocation"] });
  const page = await ctx.newPage();
  watch(page, `approved-${kind}`);
  await page.goto(`${BASE}/fr/auth`, { waitUntil: "domcontentloaded" });
  await page.evaluate((s) => localStorage.setItem("gobert:session", JSON.stringify(s)), { id, phone, anonymous: false });
  for (const p of ["/fr/dashboard", "/fr/trips", "/fr/profile", "/fr/directory", "/fr/rent", "/fr/assistant", "/en/dashboard"]) await visit(page, kind, p);
  await page.goto(`${BASE}/fr/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await shot(page, `04-${kind}-dashboard`);
  check(`${kind} dashboard renders`, (await page.locator("main").innerText()).length > 50);
  await ctx.close();
}

// 6. Admin console (demo session) — every page
{
  const page = await browser.newPage({ viewport: { width: 1366, height: 860 } });
  watch(page, "admin");
  await page.goto(`${ADMIN}${ADMIN_PATH}/login`, { waitUntil: "networkidle" });
  await page.evaluate(() => sessionStorage.setItem("gobert:admin-mock", "1"));
  for (const p of ["/overview", "/providers", "/providers?status=pending", "/providers/new", "/users", "/activity", "/pricing", "/audit", "/ai"]) {
    const res = await page.goto(`${ADMIN}${ADMIN_PATH}${p}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => null);
    await page.waitForTimeout(1500);
    if (!res || res.status() >= 400) problems.push(`[admin] ${p} → HTTP ${res?.status()}`);
    if (page.url().endsWith("/login")) problems.push(`[admin] ${p} bounced to login`);
    if (/Application error|Unhandled Runtime Error/.test(await page.locator("body").innerText())) problems.push(`[admin] ${p} shows an error page`);
  }
  await page.goto(`${ADMIN}${ADMIN_PATH}/providers?status=pending`, { waitUntil: "networkidle" });
  const review = page.locator('a[href*="/providers/"]:not([href$="/new"])').first();
  await review.waitFor({ timeout: 15000 }).catch(() => undefined);
  if (check("admin queue lists the new applications", (await review.count()) > 0)) {
    await review.click();
    await page.waitForTimeout(2500);
    await shot(page, "05-admin-review");
    check("admin opens an application", /providers\/[^/]+$/.test(new URL(page.url()).pathname));
  }
  await page.goto(`${ADMIN}${ADMIN_PATH}/overview`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await shot(page, "06-admin-overview");
  await page.close();
}

await browser.close();
console.log(results.join("\n"));
console.log(problems.length ? `\nPROBLEMS (${problems.length}):\n${[...new Set(problems)].join("\n")}` : "\nno problems found");
process.exit(results.some((r) => r.startsWith("FAIL")) || problems.length ? 1 : 0);
