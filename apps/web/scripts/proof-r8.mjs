import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";

const OUT = fileURLToPath(new URL("../../../docs/screens/r8", import.meta.url));
mkdirSync(OUT, { recursive: true });
const WEB = process.env.WEB_BASE || "http://localhost:3000";
const ADMIN = process.env.ADMIN_BASE || "http://localhost:3001";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log("  screenshot", name);
}

async function ask(q) {
  const res = await fetch(`${WEB}/api/mock/assistant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: q }),
  });
  return res.json();
}

async function main() {
  // 1. API transcript (real data)
  const q1 = "Comment inscrire ma moto ?";
  const q2 = "Find me a taxi near the market";
  const a1 = await ask(q1);
  const a2 = await ask(q2);

  const transcript = `# GoBert Assistant — R8 Proof Transcript

## Q1: "${q1}"
**Answer:**
${a1.answer}

**Tools called:**
\`\`\`json
${JSON.stringify(a1.tools, null, 2)}
\`\`\`

## Q2: "${q2}"
**Answer:**
${a2.answer}

**Tools called:**
\`\`\`json
${JSON.stringify(a2.tools, null, 2)}
\`\`\`
`;
  writeFileSync(`${OUT}/transcript.md`, transcript, "utf8");
  console.log("transcript written");

  // 2. UI screenshots
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${WEB}/fr/assistant`, { waitUntil: "domcontentloaded" });
  await sleep(1500);
  await shot(page, "01-assistant-welcome");

  // quick reply: register
  await page.getByRole("button", { name: /Comment inscrire ma moto/i }).click();
  await sleep(1500);
  await shot(page, "02-assistant-register");

  // type the taxi question
  const input = page.locator('input[placeholder*="question" i], input[placeholder*="Posez" i]');
  await input.fill("Find me a taxi near the market");
  await page.locator('button:has(svg.lucide-send)').click().catch(async () => {
    await page.keyboard.press("Enter");
  });
  await sleep(2000);
  await shot(page, "03-assistant-taxi");
  await ctx.close();

  // 3. Admin AI settings
  const actx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const admin = await actx.newPage();
  await admin.goto(`${ADMIN}/login`, { waitUntil: "domcontentloaded" });
  await sleep(1000);
  await admin.locator('input[type="email"]').fill("admin@gobert.cm");
  await admin.locator('input[type="password"]').fill("admin123");
  await admin.getByRole("button", { name: /Se connecter/i }).click();
  await admin.waitForURL("**/overview").catch(() => {});
  await admin.goto(`${ADMIN}/ai`, { waitUntil: "domcontentloaded" });
  await sleep(1500);
  await shot(admin, "04-admin-ai-settings");
  await actx.close();

  await browser.close();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});