// Chapter 1: "Create New Labnote Folder".
// Drives the command palette to create a lab note and captures each step.
import { runScenario } from "../lib/scenario.mjs";

await runScenario({ label: "ch1" }, async (ctx) => {
  const { page, shot, sleep } = ctx;

  // Step 1: open the command palette.
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+Shift+P" : "Control+Shift+P"
  );
  await sleep(1500);
  await shot("ch1-step1.png");

  // Step 2: type the command name.
  await page.keyboard.type("Labnote: Create New Labnote Folder", { delay: 25 });
  await sleep(1500);
  await shot("ch1-step2.png");
  await page.keyboard.press("Enter");
  await sleep(1500);

  // Step 3: title InputBox.
  await page.keyboard.type("Protein Folding Experiment", { delay: 25 });
  await sleep(800);
  await shot("ch1-step3.png");
  await page.keyboard.press("Enter");
  await sleep(800);
  // Author input (optional) - confirm empty.
  await page.keyboard.press("Enter");

  // Step 4: created note opened.
  await sleep(4000);
  await shot("ch1-step4.png");
});
