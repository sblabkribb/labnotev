// Shared helpers to launch the Extension Development Host with a remote
// debugging port and connect Playwright to it over CDP.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import net from "node:net";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const RECORDER_DIR = path.resolve(__dirname, "..");
export const REPO_ROOT = path.resolve(RECORDER_DIR, "..", "..");
export const DEMO_WORKSPACE = path.join(RECORDER_DIR, "demo-workspace");
export const IMG_OUT = path.join(REPO_ROOT, "docs", "manual", "assets", "img");
export const DEFAULT_PORT = 9222;

/**
 * Resolve the editor CLI used as the Extension Development Host.
 *
 * We prefer genuine Microsoft VS Code over Cursor because:
 *  - VS Code has no account/login gate, so the captured background is a clean
 *    workbench instead of a "Log In / Sign Up" welcome screen;
 *  - launching it does not collide with the user's running Cursor session.
 *
 * Order: LABNOTE_EDITOR_CLI env override > detected MS VS Code > "code" on PATH.
 */
export function editorCli() {
  if (process.env.LABNOTE_EDITOR_CLI) return process.env.LABNOTE_EDITOR_CLI;
  const home = os.homedir();
  const candidates = [
    path.join(
      home,
      "AppData",
      "Local",
      "Programs",
      "Microsoft VS Code",
      "bin",
      "code.cmd"
    ),
    "C:\\Program Files\\Microsoft VS Code\\bin\\code.cmd",
    "C:\\Program Files (x86)\\Microsoft VS Code\\bin\\code.cmd",
    "/usr/bin/code",
    "/usr/local/bin/code",
    "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return "code";
}

/** Reset the demo workspace to a clean, known state before each run. */
export function resetDemoWorkspace() {
  const labnoteDir = path.join(DEMO_WORKSPACE, "labnote");
  if (fs.existsSync(labnoteDir)) {
    fs.rmSync(labnoteDir, { recursive: true, force: true });
  }
  fs.mkdirSync(DEMO_WORKSPACE, { recursive: true });
  const marker = path.join(DEMO_WORKSPACE, "README.md");
  if (!fs.existsSync(marker)) {
    fs.writeFileSync(
      marker,
      "# Demo Workspace\n\nUsed by the Labnote Assistant snapshot recorder.\n",
      "utf8"
    );
  }
}

export function ensureImgOut() {
  fs.mkdirSync(IMG_OUT, { recursive: true });
}

/**
 * Check whether a TCP port is already accepting connections.
 * If it is, another Electron instance is likely exposing CDP there, and
 * connecting would risk driving the user's real editor window.
 */
export function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.setTimeout(1000);
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => resolve(false));
  });
}

/**
 * SAFETY: refuse to run if the debug port is already open. This is the guard
 * that prevents the recorder from attaching to an already-running Cursor/Code
 * instance (which would let it type into the user's live session).
 */
export async function assertPortFree(port = DEFAULT_PORT) {
  if (await isPortInUse(port)) {
    throw new Error(
      `Debug port ${port} is already in use. Another Cursor/VS Code instance ` +
        `may be exposing it. Close other editor windows (or set LABNOTE_CDP_PORT ` +
        `to a free port) before recording, so the tool cannot attach to your ` +
        `live editor session.`
    );
  }
}

/**
 * Launch the Extension Development Host. Returns the child process.
 * Uses an isolated user-data dir so it never disturbs the user's real editor.
 */
export function launchHost({ port = DEFAULT_PORT } = {}) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "labnote-edh-"));
  // Seed settings to suppress first-run noise (welcome tab, walkthroughs,
  // update/telemetry prompts) so the captured background is a clean workbench.
  try {
    const userDir = path.join(userDataDir, "User");
    fs.mkdirSync(userDir, { recursive: true });
    fs.writeFileSync(
      path.join(userDir, "settings.json"),
      JSON.stringify(
        {
          "workbench.startupEditor": "none",
          "workbench.welcomePage.walkthroughs.openOnInstall": false,
          "chat.commandCenter.enabled": false,
          "window.commandCenter": false,
          "telemetry.telemetryLevel": "off",
          "update.mode": "none",
          "extensions.ignoreRecommendations": true,
          "workbench.tips.enabled": false,
        },
        null,
        2
      ),
      "utf8"
    );
  } catch {
    /* best effort */
  }
  // Pass the workspace folder as a file:// URI so it is unambiguously opened
  // as a folder (a bare positional path can be misparsed on some builds).
  const folderUri =
    "file:///" + DEMO_WORKSPACE.replace(/\\/g, "/").replace(/^\/+/, "");
  const args = [
    `--extensionDevelopmentPath=${REPO_ROOT}`,
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--new-window",
    // Disable all other installed extensions (e.g. Vim, Copilot) so the demo
    // environment is clean; the extension under development stays active via
    // --extensionDevelopmentPath.
    "--disable-extensions",
    "--disable-workspace-trust",
    "--skip-release-notes",
    `--folder-uri=${folderUri}`,
  ];
  const cli = editorCli();
  const useShell = process.platform === "win32";
  // With shell:true on Windows, a CLI path containing spaces must be quoted.
  const cmd = useShell && /\s/.test(cli) ? `"${cli}"` : cli;
  console.log(`[recorder] host CLI: ${cli}`);
  const child = spawn(cmd, args, {
    stdio: "inherit",
    shell: useShell,
  });
  child.on("error", (err) => {
    console.error(`[recorder] failed to spawn "${cli}":`, err.message);
  });
  return { child, userDataDir, port };
}

/** Poll the CDP endpoint until it is reachable or a timeout elapses. */
export async function connectCdp({ port = DEFAULT_PORT, timeoutMs = 60000 } = {}) {
  const endpoint = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const browser = await chromium.connectOverCDP(endpoint);
      return browser;
    } catch (err) {
      lastErr = err;
      await sleep(1000);
    }
  }
  throw new Error(
    `Could not connect to CDP at ${endpoint} within ${timeoutMs}ms: ${
      lastErr && lastErr.message
    }`
  );
}

/**
 * Find the workbench page (the main editor window) among CDP contexts.
 * The workbench document title ends with the app name; we pick the page that
 * exposes the VS Code global `monaco`-style workbench container.
 */
export async function findWorkbenchPage(browser, { timeoutMs = 60000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const context of browser.contexts()) {
      for (const page of context.pages()) {
        try {
          const ok = await page.evaluate(() => {
            return !!document.querySelector(".monaco-workbench");
          });
          if (ok) return page;
        } catch {
          /* page not ready */
        }
      }
    }
    await sleep(1000);
  }
  throw new Error("Workbench page (.monaco-workbench) not found over CDP");
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Close the Extension Development Host window(s). Killing the spawned child
 * only kills the shell/launcher wrapper, so on Windows we terminate any
 * process whose command line references the unique isolated user-data dir.
 */
export async function shutdownHost(child, userDataDir) {
  try {
    child?.kill();
  } catch {
    /* ignore */
  }
  if (process.platform !== "win32" || !userDataDir) return;
  const dirName = path.basename(userDataDir);
  await new Promise((resolve) => {
    const ps = spawn(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${dirName}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
      ],
      { stdio: "ignore" }
    );
    ps.on("exit", resolve);
    ps.on("error", resolve);
  });
}
