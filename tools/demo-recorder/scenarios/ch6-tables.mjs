// Chapter 6 (partial): Markdown table editing (step 3).
// Image paste (step 1) is attempted separately; the native file dialog
// (step 2) is captured manually.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runScenario } from "../lib/scenario.mjs";
import { createLabNote, openSectionEditor } from "../lib/actions.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clipboardScript = path.join(__dirname, "..", "set-clipboard-image.ps1");

await runScenario({ label: "ch6" }, async (ctx) => {
  const { page, shot, sleep } = ctx;

  await createLabNote(ctx);
  const frame = await openSectionEditor(ctx);
  if (!frame) throw new Error("Section Editor frame not found");
  await sleep(800);

  // Step 1: clipboard image paste -> thumbnail below the textarea.
  // Put a demo plot image on the OS clipboard, focus a body textarea, paste.
  const ta = frame.locator("textarea").first();
  await ta.click({ timeout: 5000 });
  await sleep(300);
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Delete");
  await page.keyboard.type("Result plot: ", { delay: 15 });
  execFileSync(
    "powershell",
    ["-sta", "-ExecutionPolicy", "Bypass", "-File", clipboardScript],
    { stdio: "ignore" }
  );
  await sleep(500);
  await page.keyboard.press("Control+V");
  await sleep(3000); // allow the image to be saved and the thumbnail to render
  await ctx.wheelEditor(250);
  await sleep(500);
  await ctx.hideHovers();
  await shot("ch6-step1.png");

  // Step 3: Markdown table insertion dialog (columns / rows).
  await ctx.wheelEditor(-250);
  await sleep(400);
  const insertBtn = frame.locator('button[aria-label="Insert table"]').first();
  await insertBtn.click({ timeout: 5000 });
  await sleep(1000);
  await ctx.hideHovers();
  await shot("ch6-step3.png");
});
