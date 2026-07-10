// Chapter 2: Section Editor (Front Matter form, body sections, 3-way switch).
import { runScenario } from "../lib/scenario.mjs";
import { createLabNote, openSectionEditor } from "../lib/actions.mjs";

await runScenario({ label: "ch2" }, async (ctx) => {
  const { shot, sleep, highlight, clearHighlight, wheelEditor } = ctx;

  await createLabNote(ctx);
  const frame = await openSectionEditor(ctx);
  if (!frame) throw new Error("Section Editor frame not found");

  // Step 1: Front Matter form (top of the editor).
  await wheelEditor(-1500);
  await sleep(400);
  await shot("ch2-step1.png");

  // Step 2: body sections (Experiment Objective / Related Workflows).
  await wheelEditor(500);
  await sleep(400);
  await shot("ch2-step2.png");

  // Step 3: the editor title-bar switch buttons + SAVED badge.
  await wheelEditor(-1500);
  await sleep(400);
  await highlight(
    ".editor-actions .action-item a.action-label[aria-label*='Labnote: Open']",
    ""
  );
  await sleep(300);
  await shot("ch2-step3.png");
  await clearHighlight();
});
