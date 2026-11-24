import { chromium } from "@playwright/test";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";

const OUT = fileURLToPath(new URL("../../../docs/screens/r7", import.meta.url));
mkdirSync(OUT, { recursive: true });
const WEB = process.env.WEB_BASE || "http://localhost:3000";
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

  // ---------- RENTAL FLOW ----------
  console.log("\n=== Rental: request -> provider confirms ===");
  const pctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const passenger = await pctx.newPage();
  await passenger.goto(`${WEB}/fr/rent`, { waitUntil: "domcontentloaded" });
  await sleep(1500);
  await shot(passenger, "01-rent-browse");

  // click first Réserver
  await passenger.getByRole("button", { name: /^Réserver$/ }).first().click();
  await sleep(500);
  const dates = passenger.locator('input[type="date"]');
  await dates.nth(0).fill("2026-12-01");
  await dates.nth(1).fill("2026-12-03");
  await passenger.getByRole("button", { name: /Envoyer la demande/i }).click();
  await sleep(1500);
  await shot(passenger, "02-rent-requested");
  const rentPending = await passenger.getByText(/En attente de confirmation/i).count();
  check("passenger sees rental pending", rentPending > 0);

  // provider confirms
  const dctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const provider = await dctx.newPage();
  await provider.goto(`${WEB}/fr/provider/rentals`, { waitUntil: "domcontentloaded" });
  await sleep(2500);
  await shot(provider, "03-provider-rental-request");
  await provider.getByRole("button", { name: /Accepter/i }).first().click();
  await sleep(1000);
  await shot(provider, "04-provider-rental-confirmed");

  // passenger sees confirmed
  await sleep(2500);
  const rentConfirmed = await passenger.getByText(/^Confirmé$/).count();
  check("passenger sees rental confirmed", rentConfirmed > 0);
  await pctx.close();
  await dctx.close();

  // ---------- EXPRESS FLOW ----------
  console.log("\n=== Express: create -> provider delivers with OTP ===");
  const ectx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const sender = await ectx.newPage();
  await sender.goto(`${WEB}/fr/express`, { waitUntil: "domcontentloaded" });
  await sleep(1500);
  await shot(sender, "05-express-form");

  // fill sender/receiver
  const inputs = sender.locator('input');
  await inputs.nth(0).fill("Jean Expéditeur");
  await inputs.nth(1).fill("699000111");
  await inputs.nth(2).fill("Marie Destinataire");
  await inputs.nth(3).fill("699000222");
  await sender.getByRole("button", { name: /Envoyer le colis/i }).click();
  await sleep(1500);
  await shot(sender, "06-express-otp");
  const expressPending = await sender.getByText(/En attente d'un livreur/i).count();
  check("sender sees parcel pending", expressPending > 0);

  // extract OTP
  const otpText = await sender.locator('div.text-3xl').first().innerText();
  const otp = (otpText.match(/\d{4}/) || [""])[0];
  console.log("  OTP:", otp);

  // provider accepts + delivers
  const pctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const courier = await pctx2.newPage();
  await courier.goto(`${WEB}/fr/provider/express`, { waitUntil: "domcontentloaded" });
  await sleep(2500);
  await shot(courier, "07-provider-express-request");
  await courier.getByRole("button", { name: /Accepter/i }).first().click();
  await sleep(1000);
  await courier.locator('input[placeholder*="Code"]').first().fill(otp);
  await courier.getByRole("button", { name: /Livrer/i }).first().click();
  await sleep(1000);
  await shot(courier, "08-provider-express-delivered");

  // sender sees delivered
  await sleep(2500);
  const delivered = await sender.getByText(/^Livré$/).count();
  check("sender sees parcel delivered", delivered > 0);
  await ectx.close();
  await pctx2.close();

  await browser.close();
  console.log(failures === 0 ? "\nAll R7 checks passed." : `\n${failures} R7 check(s) failed.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});