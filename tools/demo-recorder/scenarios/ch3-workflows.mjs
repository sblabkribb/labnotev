// Chapter 3: Managing Workflows (tree view catalog, add, checklist reorder).
import { runScenario } from "../lib/scenario.mjs";
import {
  createLabNote,
  addWorkflow,
  openSectionEditor,
  openActivityBar,
  togglePane,
  expandTreeItem,
} from "../lib/actions.mjs";

await runScenario({ label: "ch3" }, async (ctx) => {
  const { shot, sleep, wheelEditor } = ctx;

  await createLabNote(ctx);

  // Step 1: Workflow catalog in the Activity Bar. Collapse Samples, expand Workflows.
  await openActivityBar(ctx, "Lab Samples");
  await sleep(800);
  await togglePane(ctx, "Samples");
  await sleep(500);
  await expandTreeItem(ctx, "Workflows");
  await sleep(800);
  await shot("ch3-step1.png");

  // Add two workflows so the checklist/reorder is meaningful.
  await addWorkflow(ctx, "General Design of Experiment");
  await addWorkflow(ctx, "Blank Workflow");

  // Step 2 & 3: the added workflows appear in Related Workflows (Section Editor).
  const frame = await openSectionEditor(ctx);
  if (!frame) throw new Error("Section Editor frame not found");
  await wheelEditor(500);
  await sleep(500);
  await shot("ch3-step2.png");

  // Step 3: workflow management commands (renumber / delete / rename).
  await ctx.openPalette();
  await ctx.page.keyboard.type("Labnote: Renumber", { delay: 25 });
  await sleep(1000);
  await shot("ch3-step3.png");
  await ctx.page.keyboard.press("Escape");
});
