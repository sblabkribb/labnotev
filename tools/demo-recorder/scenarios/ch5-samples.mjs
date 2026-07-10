// Chapter 5: Sample Management (+Sample, highlight popover, sample tree).
import { runScenario } from "../lib/scenario.mjs";
import {
  createLabNote,
  openActivityBar,
  openTreeContextMenu,
  clickContextMenuItem,
  clickTreeInlineAction,
  openSectionEditor,
} from "../lib/actions.mjs";

async function addDnaSample(ctx, alias, description) {
  const { page, sleep } = ctx;
  await openTreeContextMenu(ctx, "DNA");
  await clickContextMenuItem(ctx, "Add Sample");
  await page.keyboard.type(alias, { delay: 20 });
  await sleep(400);
  await page.keyboard.press("Enter");
  await sleep(500);
  await page.keyboard.type(description, { delay: 20 });
  await page.keyboard.press("Enter");
  await sleep(1500);
}

await runScenario({ label: "ch5" }, async (ctx) => {
  const { page, shot, sleep } = ctx;

  await createLabNote(ctx);
  await openActivityBar(ctx, "Lab Samples");
  await sleep(1000);

  // Step 1: the Add Sample context menu on a sample type node.
  await openTreeContextMenu(ctx, "DNA");
  await sleep(500);
  await shot("ch5-step1.png");
  // Proceed to add the sample from the open menu.
  await clickContextMenuItem(ctx, "Add Sample");
  await page.keyboard.type("Sample-A", { delay: 20 });
  await sleep(400);
  await page.keyboard.press("Enter");
  await sleep(500);
  await page.keyboard.type("Purified plasmid DNA", { delay: 20 });
  await page.keyboard.press("Enter");
  await sleep(1500);

  // Add a second sample so the tree has content.
  await addDnaSample(ctx, "Sample-B", "Backup aliquot");

  // Step 3: the Samples tree view with the created samples.
  await ctx.hideHovers();
  await sleep(400);
  await shot("ch5-step3.png");

  // Step 2: sample reference inserted in the Section Editor body.
  // Open the note in the Section Editor, then insert a sample from the tree.
  const frame = await openSectionEditor(ctx);
  await sleep(1000);
  // Focus the Experiment Objective textarea and start a clean line.
  if (frame) {
    const ta = frame.locator("textarea").first();
    await ta.click({ timeout: 5000 }).catch(() => {});
    await sleep(300);
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Delete");
    await page.keyboard.type("Prepared using sample ", { delay: 15 });
    await sleep(400);
  }
  // Insert the sample reference via the tree's inline "Insert to Editor" action.
  await clickTreeInlineAction(ctx, "Sample-A", "Insert to Editor").catch(() => {});
  await sleep(1200);
  await ctx.hideHovers();
  await shot("ch5-step2.png");
});
