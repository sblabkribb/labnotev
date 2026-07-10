// Reusable extension interactions shared by the chapter scenarios. Each takes
// the scenario `ctx` (which exposes page/sleep/runCommand/etc.).

/** Switch the active .labnote.md to the plain Markdown text editor. */
export async function openAsText(ctx) {
  const { page, sleep } = ctx;
  await ctx.openPalette();
  await page.keyboard.type("Labnote: Open as Markdown Editor", { delay: 18 });
  await sleep(800);
  await page.keyboard.press("Enter");
  await sleep(2000);
}

/** Create a lab note via the command palette (title + optional author). */
export async function createLabNote(ctx, title = "Protein Folding Experiment", author = "Jane Researcher") {
  const { page, sleep } = ctx;
  await ctx.openPalette();
  await page.keyboard.type("Labnote: Create New Labnote Folder", { delay: 18 });
  await sleep(800);
  await page.keyboard.press("Enter");
  await sleep(1200);
  await page.keyboard.type(title, { delay: 18 });
  await sleep(400);
  await page.keyboard.press("Enter");
  await sleep(500);
  if (author) await page.keyboard.type(author, { delay: 18 });
  await page.keyboard.press("Enter");
  await sleep(3000);
}

/** Open the active .labnote.md in the Section Editor. Returns the webview frame. */
export async function openSectionEditor(ctx) {
  const { page, sleep } = ctx;
  await ctx.openPalette();
  await page.keyboard.type("Labnote: Open with Section Editor", { delay: 18 });
  await sleep(800);
  await page.keyboard.press("Enter");
  await sleep(4500);
  return ctx.sectionEditorFrame();
}

/**
 * Add a workflow to the active lab note via "Labnote: Add Workflow".
 * Shows a single template QuickPick; `filter` narrows it.
 */
export async function addWorkflow(ctx, filter = "General Design of Experiment") {
  const { page, sleep } = ctx;
  await ctx.openPalette();
  await page.keyboard.type("Labnote: Add Workflow", { delay: 18 });
  await sleep(800);
  await page.keyboard.press("Enter");
  await sleep(1200);
  // Workflow template QuickPick.
  await page.keyboard.type(filter, { delay: 18 });
  await sleep(1000);
  await page.keyboard.press("Enter");
  await sleep(2500);
}

/**
 * Add a unit operation via "Labnote: Add Unit Operation".
 * Flow: category QuickPick (Hardware/Software) -> operation QuickPick.
 * Attaches to the workflow document currently open (Section Editor or text).
 * `beforeConfirm` runs right before the final Enter (for screenshotting the picker).
 */
export async function addUnitOperation(ctx, { category = "Hardware", filter = "", onCategory, onOperation } = {}) {
  const { page, sleep } = ctx;
  await ctx.openPalette();
  await page.keyboard.type("Labnote: Add Unit Operation", { delay: 18 });
  await sleep(800);
  await page.keyboard.press("Enter");
  await sleep(1200);
  // Category QuickPick.
  if (onCategory) await onCategory();
  await page.keyboard.type(category, { delay: 18 });
  await sleep(700);
  await page.keyboard.press("Enter");
  await sleep(1300);
  // Unit operation QuickPick.
  if (filter) await page.keyboard.type(filter, { delay: 18 });
  await sleep(900);
  if (onOperation) await onOperation();
  await page.keyboard.press("Enter");
  await sleep(2200);
}

/**
 * Open the README in the Section Editor, then click a workflow link in the
 * Related Workflows list to open that workflow (Section Editor is the default
 * editor for *.labnote.md). Returns the workflow's Section Editor frame.
 */
export async function openLinkedWorkflow(ctx, linkTextContains) {
  const { sleep } = ctx;
  const readmeFrame = await openSectionEditor(ctx);
  if (!readmeFrame) throw new Error("README Section Editor frame not found");
  await ctx.wheelEditor(700);
  await sleep(600);
  const link = readmeFrame.getByText(linkTextContains, { exact: false }).first();
  await link.click({ timeout: 6000 });
  await sleep(3000);
  return ctx.sectionEditorFrame();
}

/** Open a specific view container in the Activity Bar by command. */
export async function openView(ctx, commandTitle) {
  const { page, sleep } = ctx;
  await ctx.openPalette();
  await page.keyboard.type(commandTitle, { delay: 18 });
  await sleep(800);
  await page.keyboard.press("Enter");
  await sleep(1500);
}

/** Click an Activity Bar item by its aria-label (e.g. "Lab Samples"). */
export async function openActivityBar(ctx, labelContains) {
  const { page, sleep } = ctx;
  const clicked = await page.evaluate((needle) => {
    const items = Array.from(
      document.querySelectorAll(".activitybar a.action-label, .activitybar .action-item")
    );
    for (const el of items) {
      const label = el.getAttribute("aria-label") || el.title || "";
      if (label.toLowerCase().includes(needle.toLowerCase())) {
        el.click();
        return label;
      }
    }
    return null;
  }, labelContains);
  await sleep(1500);
  return clicked;
}

/** Collapse/expand a view pane by clicking its header (matched by title text). */
export async function togglePane(ctx, titleContains) {
  const { page, sleep } = ctx;
  const ok = await page.evaluate((needle) => {
    const headers = Array.from(document.querySelectorAll(".pane-header"));
    for (const h of headers) {
      const t = (h.textContent || "").trim().toLowerCase();
      if (t.includes(needle.toLowerCase())) {
        h.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        return true;
      }
    }
    return false;
  }, titleContains);
  await sleep(700);
  return ok;
}

/** Right-click a tree row (by label) to open its context menu. */
export async function openTreeContextMenu(ctx, rowText) {
  const { page, sleep } = ctx;
  const row = page
    .locator(".monaco-list-row")
    .filter({ hasText: rowText })
    .first();
  await row.click({ button: "right", timeout: 5000 });
  await sleep(800);
}

/** Hover a tree row and click one of its inline action buttons by aria-label. */
export async function clickTreeInlineAction(ctx, rowText, actionLabelContains) {
  const { page, sleep } = ctx;
  const row = page
    .locator(".monaco-list-row")
    .filter({ hasText: rowText })
    .first();
  await row.hover();
  await sleep(400);
  const action = row.locator(
    `a.action-label[aria-label*="${actionLabelContains}"]`
  );
  await action.first().click({ timeout: 5000 });
  await sleep(900);
}

/** Click a context-menu item by its label (in an open .monaco-menu). */
export async function clickContextMenuItem(ctx, itemText) {
  const { page, sleep } = ctx;
  const item = page
    .locator(".monaco-menu .action-item .action-label")
    .filter({ hasText: itemText })
    .first();
  await item.click({ timeout: 5000 });
  await sleep(900);
}

/** Expand a collapsed tree item in the focused view by its visible label. */
export async function expandTreeItem(ctx, labelStartsWith) {
  const { page, sleep } = ctx;
  const row = page
    .locator(".monaco-list-row")
    .filter({ hasText: labelStartsWith })
    .first();
  try {
    // Only click if currently collapsed.
    const expanded = await row.getAttribute("aria-expanded");
    if (expanded === "true") return true;
    await row.click({ position: { x: 10, y: 10 }, timeout: 4000 });
    await sleep(1000);
    return true;
  } catch {
    return false;
  }
}

/** Find the actual scrollable element inside the webview and set scrollTop. */
export async function setFrameScroll(frame, top) {
  await frame.evaluate((y) => {
    const all = Array.from(document.querySelectorAll("*"));
    let best = document.scrollingElement || document.documentElement;
    let bestH = best ? best.scrollHeight - best.clientHeight : 0;
    for (const el of all) {
      const diff = el.scrollHeight - el.clientHeight;
      if (diff > bestH) {
        best = el;
        bestH = diff;
      }
    }
    if (best) best.scrollTop = y === Infinity ? best.scrollHeight : y;
  }, top);
}

/** Scroll the webview to the top. */
export async function scrollTop(frame) {
  await setFrameScroll(frame, 0);
}

/**
 * Scroll a heading/element whose text starts with `text` into view using
 * Playwright's locator (handles nested scroll containers reliably).
 */
export async function scrollToText(frame, text) {
  const loc = frame.getByText(text, { exact: false }).first();
  try {
    await loc.scrollIntoViewIfNeeded({ timeout: 5000 });
  } catch {
    // Fallback: DOM scrollIntoView.
    await frame.evaluate((t) => {
      const els = Array.from(
        document.querySelectorAll("h1,h2,h3,h4,div,span,label")
      );
      const target = els.find((e) => (e.textContent || "").trim().startsWith(t));
      if (target) target.scrollIntoView({ block: "start" });
    }, text);
  }
}
