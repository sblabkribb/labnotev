// Generate manual.ko.pdf and manual.en.pdf from docs/manual/index.html using
// Playwright's headless Chromium. The manual reads ?lang= and ?theme= query
// params to lock a fixed language/light theme for print.
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MANUAL_DIR = path.join(REPO_ROOT, "docs", "manual");
const INDEX = path.join(MANUAL_DIR, "index.html");

async function exportOne(browser, lang) {
  const page = await browser.newPage();
  const url =
    "file://" +
    INDEX.replace(/\\/g, "/") +
    `?lang=${lang}&theme=light`;
  await page.goto(url, { waitUntil: "networkidle" });
  // Ensure the language class is applied before printing.
  await page.evaluate(() => new Promise((r) => setTimeout(r, 300)));
  const out = path.join(MANUAL_DIR, `manual.${lang}.pdf`);
  await page.pdf({
    path: out,
    format: "A4",
    printBackground: true,
    margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" },
  });
  await page.close();
  console.log(`[recorder] wrote ${path.relative(REPO_ROOT, out)}`);
}

async function run() {
  if (!fs.existsSync(INDEX)) {
    throw new Error(`Manual not found: ${INDEX}`);
  }
  const browser = await chromium.launch();
  try {
    await exportOne(browser, "ko");
    await exportOne(browser, "en");
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("[recorder] PDF export failed:", err);
  process.exitCode = 1;
});
