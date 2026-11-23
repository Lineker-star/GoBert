import { chromium } from "@playwright/test";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";

const OUT = fileURLToPath(new URL("../../../docs/screens/r4", import.meta.url));
mkdirSync(OUT, { recursive: true });
const BASE = process.env.SHOT_BASE || "http://localhost:3000";

async function shot(page, name) {
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log("captured", name);
}

// React-compatible input setter (bypasses React's value tracker)
async function setInput(page, selector, value) {
  await page.evaluate(
    ([sel, val]) => {
      const el = document.querySelector(sel);
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(el, val);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
    [selector, value],
  );
}

async function main() {
  const browser = await chromium.launch();

  // ---------- AUTH FLOW (fr) ----------
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${BASE}/fr/auth`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    await shot(page, "auth-phone");

    await setInput(page, 'input[type="tel"]', "699000001");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /Envoyer le code/i }).click();
    await page.waitForTimeout(1500);
    await shot(page, "auth-otp");

    await setInput(page, 'input[placeholder*="chiffres"], input[placeholder*="6"]', "123456");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /Vérifier/i }).click();
    await page.waitForTimeout(2500);
    await shot(page, "account-logged-in");

    await page.getByRole("button", { name: /Se déconnecter/i }).click();
    await page.waitForTimeout(1500);
    await shot(page, "account-signed-out");
    await page.close();
  }

  // ---------- ANONYMOUS FLOW (fr) ----------
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${BASE}/fr/auth`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3500);
    await page.getByRole("button", { name: /Continuer sans compte/i }).click();
    await page.waitForTimeout(2000);
    await page.goto(`${BASE}/fr/account`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await shot(page, "account-anonymous");
    await page.close();
  }

  // ---------- MAP WITH SEEDED PROVIDERS (fr + en, mobile + desktop) ----------
  for (const vp of [{ w: 390, h: 844, tag: "mobile" }, { w: 1280, h: 800, tag: "desktop" }]) {
    const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
    for (const loc of ["fr", "en"]) {
      await page.goto(`${BASE}/${loc}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(11000);
      await shot(page, `${loc}-${vp.tag}-providers`);
    }
    await page.close();
  }

  await browser.close();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});