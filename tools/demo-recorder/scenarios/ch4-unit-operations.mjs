// Chapter 4: Unit Operations (add op, accordion view, reorder).
import { runScenario } from "../lib/scenario.mjs";
import {
  createLabNote,
  addWorkflow,
  addUnitOperation,
  openLinkedWorkflow,
} from "../lib/actions.mjs";

await runScenario({ label: "ch4" }, async (ctx) => {
  const { shot, sleep, wheelEditor } = ctx;

  await createLabNote(ctx);
  await addWorkflow(ctx, "General Design of Experiment");

  // Open the workflow via its Related Workflows link (default editor).
  const frame = await openLinkedWorkflow(ctx, "General Design of Experiment");
  if (!frame) throw new Error("Workflow Section Editor frame not found");
  await sleep(800);

  // Step 1: the Add Unit Operation category picker (Hardware / Software).
  await addUnitOperation(ctx, {
    category: "Hardware",
    filter: "Centrifuge",
    onCategory: async () => {
      await sleep(500);
      await shot("ch4-step1.png");
    },
  });

  // Add a second (software) op so reorder is meaningful.
  await addUnitOperation(ctx, { category: "Software", filter: "Primer Design" });
  await sleep(1000);

  // Let the toast fade and dismiss the tab hover tooltip.
  await wheelEditor(700);
  await ctx.page.mouse.move(630, 300);
  await sleep(4000);
  await ctx.hideHovers();

  // Step 2: the two inserted unit operations (accordion + drag handles).
  await shot("ch4-step2.png");

  // Step 3: open the first unit operation's action menu (move up/down, delete)
  // by clicking its kebab button (the button just before the chevron toggle).
  const editorFrame = await ctx.sectionEditorFrame();
  if (editorFrame) {
    const label = editorFrame.getByText("Centrifuge", { exact: false }).first();
    const row = label.locator("xpath=ancestor::div[.//button][1]");
    const buttons = row.locator("button");
    const count = await buttons.count();
    if (count >= 2) {
      await buttons
        .nth(count - 2)
        .click({ timeout: 5000 })
        .catch(() => {});
    }
    await sleep(1400);
  }
  await ctx.page.mouse.move(630, 300);
  await sleep(500);
  await ctx.hideHovers();
  await shot("ch4-step3.png");
});
