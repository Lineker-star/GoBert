import { chromium } from "@playwright/test";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";

const OUT = fileURLToPath(new URL("../../../docs/screens/r3", import.meta.url));
mkdirSync(OUT, { recursive: true });

const BASE = process.env.SHOT_BASE || "http://localhost:3000";

async function shot(page, name) {
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log("captured", name);
}

async function main() {
  const browser = await chromium.launch();

  const cases = [
    { w: 390, h: 844, tag: "mobile" },
    { w: 1280, h: 800, tag: "desktop" },
  ];

  for (const c of cases) {
    const page = await browser.newPage({ viewport: { width: c.w, height: c.h } });
    for (const loc of ["fr", "en"]) {
      await page.goto(`${BASE}/${loc}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(5000); // let map load + markers
      await shot(page, `${loc}-${c.tag}`);

      if (c.tag === "mobile") {
        try {
          await page.locator("input[readonly]").first().click();
          await page.waitForTimeout(700);
          const searchInput = page.locator("input:not([readonly])").first();
          await searchInput.fill("marche central bertoua");
          await page.waitForTimeout(2500);
          await shot(page, `${loc}-mobile-search`);

          const savedLabel = loc === "fr" ? "Marché" : "Market";
          const savedBtn = page.locator("div.fixed.inset-0 button").filter({ hasText: savedLabel }).first();
          if (await savedBtn.count()) {
            await savedBtn.click();
            await page.waitForTimeout(1500);
            await shot(page, `${loc}-mobile-picked`);
          }
        } catch (e) {
          console.log("search flow skipped:", e?.message || e);
        }
      }
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