import { chromium } from "@playwright/test";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";

const OUT = fileURLToPath(new URL("../../../docs/screens/r6", import.meta.url));
mkdirSync(OUT, { recursive: true });
const WEB = process.env.WEB_BASE || "http://localhost:3000";
const ADMIN = process.env.ADMIN_BASE || "http://localhost:3001";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log("  screenshot", name);
}

let failures = 0;
function check(name, cond, detail = "") {
  if (cond) console.log(`PASS: ${name}${detail ? " (" + detail + ")" : ""}`);
  else {
    console.error(`FAIL: ${name}${detail ? " (" + detail + ")" : ""}`);
    failures++;
  }
}

async function main() {
  const browser = await chromium.launch();

  // 1. Provider registers via the wizard
  const pctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const provider = await pctx.newPage();
  await provider.goto(`${WEB}/fr/provider/onboard`, { waitUntil: "domcontentloaded" });
  await sleep(1500);
  await shot(provider, "01-wizard-identity");

  // fill identity
  const nameInput = provider.locator('input[placeholder="Nom complet"]');
  await nameInput.fill("Test Driver");
  await provider.locator('input[placeholder="+237 6 99 00 00 01"]').fill("699000123");

  // advance through steps 1..5 (vehicle, documents, services, schedule, review)
  for (let i = 0; i < 5; i++) {
    await provider.getByRole("button", { name: /Suivant/i }).click();
    await sleep(500);
    if (i === 1) await shot(provider, "02-wizard-documents");
  }
  // step 5 (review)
  await shot(provider, "03-wizard-review");

  // submit
  await provider.getByRole("button", { name: /Soumettre/i }).click();
  await sleep(1500);
  await shot(provider, "04-wizard-pending");
  const pendingVisible = await provider.getByText(/En attente de validation/i).count();
  check("provider sees pending status", pendingVisible > 0);
  await pctx.close();

  // 2. Admin logs in and approves
  const actx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const admin = await actx.newPage();
  await admin.goto(`${ADMIN}/login`, { waitUntil: "domcontentloaded" });
  await sleep(1000);
  await shot(admin, "05-admin-login");
  await admin.locator('input[type="email"]').fill("admin@gobert.cm");
  await admin.locator('input[type="password"]').fill("admin123");
  await admin.getByRole("button", { name: /Se connecter/i }).click();
  await admin.waitForURL("**/overview", { timeout: 10000 }).catch(() => {});
  await sleep(1000);
  await shot(admin, "06-admin-overview");

  await admin.goto(`${ADMIN}/providers?status=pending`, { waitUntil: "domcontentloaded" });
  await sleep(1500);
  await shot(admin, "07-admin-queue");

  // find the Test Driver row and open it
  const row = admin.locator("tr", { hasText: "Test Driver" }).first();
  await row.waitFor({ timeout: 10000 });
  await row.getByText(/Examiner/i).click();
  await sleep(1500);
  await shot(admin, "08-admin-detail");

  // approve
  await admin.getByRole("button", { name: /Approuver/i }).click();
  await sleep(1500);
  await shot(admin, "09-admin-approved");
  const approved = await admin.getByText(/Approuvé/i).count();
  check("admin approved the provider", approved > 0);
  await actx.close();

  // 3. Provider now appears on the passenger map
  const mctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const passenger = await mctx.newPage();
  await passenger.goto(`${WEB}/fr`, { waitUntil: "domcontentloaded" });
  await sleep(13000); // allow the 10s provider refresh
  await shot(passenger, "10-passenger-map");
  const onMap = await passenger.evaluate(() => {
    const markers = document.querySelectorAll(".maplibregl-marker");
    return Array.from(markers).some((m) => (m.getAttribute("title") || "") === "Test Driver");
  });
  check("approved provider appears on passenger map", onMap);
  await mctx.close();

  await browser.close();
  console.log(failures === 0 ? "\nAll R6 checks passed." : `\n${failures} R6 check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});