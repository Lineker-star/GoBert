import { chromium } from "@playwright/test";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";

const OUT = fileURLToPath(new URL("../../../docs/screens/r5", import.meta.url));
mkdirSync(OUT, { recursive: true });
const BASE = process.env.SHOT_BASE || "http://localhost:3000";
const API = `${BASE}/api/mock`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log("  screenshot", name);
}

async function api(path, opts) {
  const res = await fetch(`${API}${path}`, opts);
  return res.json();
}

let failures = 0;
function check(name, cond, detail = "") {
  if (cond) console.log(`PASS: ${name}${detail ? " (" + detail + ")" : ""}`);
  else {
    console.error(`FAIL: ${name}${detail ? " (" + detail + ")" : ""}`);
    failures++;
  }
}

async function fullFlow(browser) {
  console.log("\n=== Full flow: passenger + provider ===");
  const pctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const dctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const passenger = await pctx.newPage();
  const provider = await dctx.newPage();

  const providerId = "00000000-0000-0000-0000-000000000001";

  // Passenger: booking page with destination
  await passenger.goto(`${BASE}/fr/booking?lat=4.58&lng=13.69&label=Mokolo`, { waitUntil: "domcontentloaded" });
  await passenger.getByText("Mokolo", { exact: false }).first().waitFor({ timeout: 15000 });
  await sleep(1500);
  await shot(passenger, "01-choose-vehicle");

  // confirm
  await passenger.getByRole("button", { name: /Confirmer/i }).click();
  await passenger.getByText(/Recherche d'un prestataire/i).first().waitFor({ timeout: 10000 });
  await shot(passenger, "02-looking-for-rider");
  check("passenger sees 'looking for a rider'", true);

  // Provider: dashboard, online, incoming
  await provider.goto(`${BASE}/fr/provider/dashboard?provider=${providerId}`, { waitUntil: "domcontentloaded" });
  await provider.getByRole("button", { name: /En ligne|Hors ligne/i }).first().waitFor({ timeout: 10000 });
  await sleep(1000);
  await shot(provider, "03-provider-online");

  // wait for incoming modal
  await provider.getByText(/Nouvelle demande/i).first().waitFor({ timeout: 15000 });
  await sleep(800);
  await shot(provider, "04-provider-incoming-request");
  check("provider sees incoming request", true);

  // provider accepts
  await provider.getByRole("button", { name: /^Accepter$/i }).click();
  await sleep(1000);
  await shot(provider, "05-provider-accepted");

  // passenger sees accepted (provider card)
  await passenger.getByText(/En route|Accepté/i).first().waitFor({ timeout: 15000 });
  await sleep(1000);
  await shot(passenger, "06-passenger-accepted");
  const hasProviderCard = await passenger.locator("text=/Mbarga Jean/").count();
  check("passenger sees provider card", hasProviderCard > 0, hasProviderCard > 0 ? "name shown" : "missing");

  // provider: arrived -> start -> complete
  await provider.getByRole("button", { name: /Arrivé/i }).click();
  await sleep(800);
  await shot(provider, "07-provider-arrived");
  await provider.getByRole("button", { name: /Démarrer/i }).click();
  await sleep(800);
  await shot(provider, "08-provider-in-progress");
  await provider.getByRole("button", { name: /Terminer/i }).click();
  await sleep(1000);
  await shot(provider, "09-provider-completed");

  // passenger sees completed + rates
  await passenger.getByText(/Course terminée/i).first().waitFor({ timeout: 15000 });
  await sleep(1000);
  await shot(passenger, "10-passenger-completed");
  check("passenger sees completed", true);

  // rate 5 stars
  const stars = passenger.locator("button:has(svg.lucide-star)");
  await stars.nth(4).click();
  await sleep(300);
  await passenger.getByRole("button", { name: /Envoyer/i }).click();
  await sleep(800);
  await shot(passenger, "11-passenger-rated");

  await pctx.close();
  await dctx.close();
}

async function concurrencyTest(browser) {
  console.log("\n=== Concurrency: two providers accept at once ===");
  // create a fresh booking
  const bk = await api("/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      passenger_id: "p-concurrency",
      vehicle_type: "taxi",
      pickup: { lat: 4.5774, lng: 13.6846, label: "Centre" },
      dropoff: { lat: 4.59, lng: 13.7, label: "Nkolndongo" },
    }),
  });
  const p1 = "00000000-0000-0000-0000-000000000001";
  const p2 = "00000000-0000-0000-0000-000000000002";

  // both accept simultaneously
  const [r1, r2] = await Promise.all([
    api(`/bookings/${bk.id}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider_id: p1 }),
    }),
    api(`/bookings/${bk.id}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider_id: p2 }),
    }),
  ]);
  const winners = [r1, r2].filter((r) => r.won).length;
  check("exactly one provider wins concurrent accept", winners === 1, `winners=${winners}`);

  const final = await api(`/bookings?id=${bk.id}`);
  check("booking assigned to the winner", final.provider_id === (r1.won ? p1 : p2), final.status);
  check("booking status is accepted", final.status === "accepted", final.status);
}

async function main() {
  const browser = await chromium.launch();
  try {
    await fullFlow(browser);
    await concurrencyTest(browser);
  } finally {
    await browser.close();
  }
  console.log(failures === 0 ? "\nAll e2e checks passed." : `\n${failures} e2e check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});