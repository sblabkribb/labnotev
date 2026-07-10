// Shared scenario runner. Handles the common lifecycle for every chapter:
// launch the Extension Development Host, connect over CDP, suppress first-run
// dialogs, close the chat sidebar, verify we are on the demo workspace, and
// tear everything down afterwards. Each chapter scenario just receives a ready
// `ctx` with a `page` plus capture/highlight/command helpers.
import path from "node:path";
import {
  launchHost,
  connectCdp,
  findWorkbenchPage,
  assertPortFree,
  shutdownHost,
  resetDemoWorkspace,
  ensureImgOut,
  IMG_OUT,
  sleep,
} from "./host.mjs";
import { overlayInstallerSource } from "./highlight.js";

const DEFAULT_PORT = Number(process.env.LABNOTE_CDP_PORT || 9222);

async function dismissFirstRunDialogs(page) {
  for (let i = 0; i < 3; i++) {
    const clicked = await page.evaluate(() => {
      const labels = [
        "Continue without Signing In",
        "Continue Without Signing In",
        "Skip",
        "Skip for now",
        "Not now",
        "Maybe later",
      ];
      const nodes = Array.from(
        document.querySelectorAll("a, button, .monaco-button, [role='button']")
      );
      for (const el of nodes) {
        const txt = (el.textContent || "").trim();
        if (labels.some((l) => txt.toLowerCase() === l.toLowerCase())) {
          el.click();
          return txt;
        }
      }
      return null;
    });
    if (clicked) {
      console.log(`[recorder] dismissed dialog via "${clicked}"`);
      await sleep(600);
    }
    await page.keyboard.press("Escape").catch(() => {});
    await sleep(400);
  }
}

async function closeSecondarySidebar(page) {
  const chatOpen = await page.evaluate(
    () => !!document.querySelector(".part.auxiliarybar:not(.empty)")
  );
  if (chatOpen) {
    await page.keyboard.press("Control+Alt+B");
    await sleep(700);
  }
}

/** Build the helper context passed to each scenario. */
function makeCtx(page, browser) {
  const ctx = {
    page,
    browser,
    sleep,
    IMG_OUT,
    async shot(name) {
      await page.screenshot({ path: path.join(IMG_OUT, name) });
      console.log(`[recorder] captured ${name}`);
    },
    async highlight(selector, label) {
      return page.evaluate(
        ([sel, lb]) => window.__labnoteHighlight?.selector(sel, lb),
        [selector, label]
      );
    },
    async clearHighlight() {
      await page.evaluate(() => window.__labnoteHighlight?.clear());
    },
    /** Remove lingering hover/tooltip overlays and notification toasts. */
    async hideHovers() {
      await page.evaluate(() => {
        document
          .querySelectorAll(
            ".monaco-hover, .workbench-hover, .monaco-hover-content, .notifications-toasts .notification-toast"
          )
          .forEach((el) => el.remove());
      });
    },
    /**
     * Reliably open the command palette: dismiss stray widgets, move focus to
     * the workbench, press Ctrl+Shift+P, and verify the quick-input widget is
     * visible (retry once). Returns true if the palette opened.
     */
    async openPalette() {
      await page.keyboard.press("Escape").catch(() => {});
      await sleep(150);
      await ctx.focusWorkbench();
      for (let attempt = 0; attempt < 3; attempt++) {
        await page.keyboard.press(
          process.platform === "darwin" ? "Meta+Shift+P" : "Control+Shift+P"
        );
        await sleep(700);
        const visible = await page.evaluate(() => {
          const w = document.querySelector(".quick-input-widget");
          if (!w) return false;
          const style = window.getComputedStyle(w);
          return style.display !== "none" && style.visibility !== "hidden";
        });
        if (visible) return true;
        await sleep(300);
      }
      return false;
    },
    /**
     * Move keyboard focus from a webview back to the workbench by clicking the
     * active editor tab. Required before Ctrl+Shift+P when a Section Editor
     * webview holds focus (otherwise the keybinding never reaches VS Code).
     */
    async focusWorkbench() {
      try {
        await page
          .locator(".tabs-container .tab.active")
          .first()
          .click({ timeout: 3000 });
      } catch {
        try {
          await page.locator(".tabs-container .tab").first().click({ timeout: 2000 });
        } catch {
          /* no tabs */
        }
      }
      await sleep(400);
    },
    /** Scroll the editor webview by dispatching wheel events over its area. */
    async wheelEditor(dy, { x = 630, y = 350, steps = 6 } = {}) {
      await page.mouse.move(x, y);
      const per = Math.round(dy / steps);
      for (let i = 0; i < steps; i++) {
        await page.mouse.wheel(0, per);
        await sleep(120);
      }
      await sleep(400);
    },
    /** Open the command palette and run a command by exact/prefix text. */
    async runCommand(commandTitle, { screenshotBefore } = {}) {
      await page.keyboard.press(
        process.platform === "darwin" ? "Meta+Shift+P" : "Control+Shift+P"
      );
      await sleep(900);
      await page.keyboard.type(commandTitle, { delay: 20 });
      await sleep(900);
      if (screenshotBefore) await ctx.shot(screenshotBefore);
      await page.keyboard.press("Enter");
      await sleep(1200);
    },
    /**
     * Return the Section Editor's inner webview content frame. VS Code wraps a
     * webview in an outer iframe (index.html) plus an inner iframe (fake.html);
     * the React app lives in the inner one. We must NOT return the workbench
     * top frame (its text includes the ".labnote.md" filename).
     */
    async sectionEditorFrame({ timeoutMs = 15000 } = {}) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        // Prefer the inner webview frame by URL.
        const candidates = page
          .frames()
          .filter((f) => f !== page.mainFrame() && /fake\.html/.test(f.url()));
        for (const frame of candidates) {
          try {
            const hit = await frame.evaluate(
              () =>
                !!document.body &&
                /Lab Note Section Editor|Front Matter|Experiment Objective|Unit Operation/i.test(
                  document.body.innerText || ""
                )
            );
            if (hit) return frame;
          } catch {
            /* frame not ready */
          }
        }
        await sleep(700);
      }
      return null;
    },
  };
  return ctx;
}

/**
 * Run a chapter scenario.
 * @param {object} opts
 * @param {(workspaceDir:string)=>void} [opts.seed] optional disk seeding before launch
 * @param {(ctx:object)=>Promise<void>} fn scenario body
 */
export async function runScenario(opts, fn) {
  const { seed, port = DEFAULT_PORT, label = "scenario" } = opts;
  await assertPortFree(port);
  resetDemoWorkspace();
  if (typeof seed === "function") seed();
  ensureImgOut();

  console.log(`[recorder] launching Extension Development Host (${label})...`);
  const { child, userDataDir } = launchHost({ port });

  let browser;
  try {
    browser = await connectCdp({ port, timeoutMs: 90000 });
    console.log("[recorder] connected over CDP");
    const page = await findWorkbenchPage(browser, { timeoutMs: 90000 });
    console.log("[recorder] workbench page found");

    const onDemo = await page.evaluate(() =>
      /demo-workspace/i.test(document.title)
    );
    if (!onDemo) {
      throw new Error(
        "Connected window is not the demo workspace (title=" +
          (await page.title()) +
          "). Aborting to avoid driving the wrong editor."
      );
    }

    await page.evaluate(`(${overlayInstallerSource().toString()})()`);
    await sleep(4000);
    await dismissFirstRunDialogs(page);
    await closeSecondarySidebar(page);
    await sleep(500);

    const ctx = makeCtx(page, browser);
    await fn(ctx);
    console.log(`[recorder] ${label} complete`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    await shutdownHost(child, userDataDir);
  }
}
