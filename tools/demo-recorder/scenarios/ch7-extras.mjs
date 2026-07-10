// Chapter 7: Extra features (send selection to Chat, @ autocomplete, dates).
import { runScenario } from "../lib/scenario.mjs";
import {
  createLabNote,
  openActivityBar,
  openTreeContextMenu,
  clickContextMenuItem,
  openSectionEditor,
  openAsText,
} from "../lib/actions.mjs";

await runScenario({ label: "ch7" }, async (ctx) => {
  const { page, shot, sleep } = ctx;

  await createLabNote(ctx);

  // Seed one DNA sample so the @dna: autocomplete has a suggestion.
  await openActivityBar(ctx, "Lab Samples");
  await sleep(800);
  await openTreeContextMenu(ctx, "DNA");
  await clickContextMenuItem(ctx, "Add Sample");
  await page.keyboard.type("Sample-A", { delay: 20 });
  await sleep(300);
  await page.keyboard.press("Enter");
  await sleep(400);
  await page.keyboard.type("Purified plasmid DNA", { delay: 20 });
  await page.keyboard.press("Enter");
  await sleep(1200);

  // Step 2: @ autocomplete in the plain Markdown editor.
  await openAsText(ctx);
  await sleep(600);
  await page.locator(".monaco-editor").first().click();
  await sleep(400);
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  // insertText reliably places the prefix (per-key typing dropped chars here).
  await page.keyboard.insertText("@dna:");
  await sleep(600);
  await page.keyboard.press("Control+Space");
  await sleep(1500);
  await shot("ch7-step2.png");
  await page.keyboard.press("Escape");
  await sleep(300);

  // Step 1: Send selection to Chat button (Section Editor textarea selection).
  const frame = await openSectionEditor(ctx);
  if (frame) {
    const ta = frame.locator("textarea").first();
    await ta.click({ timeout: 5000 });
    await sleep(300);
    await page.keyboard.press("Control+A");
    await sleep(1200);
  }
  await ctx.hideHovers();
  await shot("ch7-step1.png");

  // Step 3: date insertion commands in the palette.
  await ctx.openPalette();
  await page.keyboard.type("Labnote: Insert Current Date", { delay: 25 });
  await sleep(1000);
  await shot("ch7-step3.png");
  await page.keyboard.press("Escape");
});
