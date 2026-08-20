import { spawn, execFileSync, type ChildProcess } from 'child_process';
import * as fs from 'fs';

/**
 * Build the OS launcher command + argv for opening `filePath` with the default
 * application. The path is always passed as a single, separate argv entry so
 * that no shell parsing occurs.
 *
 * Windows uses `explorer.exe <path>` (ShellExecute under the hood) rather than
 * `cmd /c start`. Routing through `cmd` — even with a quoted path — is unsafe:
 * `cmd` still performs `%VAR%` environment expansion inside quotes and treats
 * `&`, `^`, etc. as metacharacters, so a file named `report&calc.xlsx` could
 * chain an unintended command. `explorer.exe` receives the path verbatim.
 */
export function buildOpenCommand(
  platform: NodeJS.Platform,
  filePath: string
): { command: string; args: string[] } {
  if (platform === 'win32') {
    return { command: 'explorer.exe', args: [filePath] };
  }
  if (platform === 'darwin') {
    return { command: 'open', args: [filePath] };
  }
  return { command: 'xdg-open', args: [filePath] };
}

/**
 * WSL reports `process.platform === 'linux'` but has no desktop session, so
 * the `xdg-open` used for regular Linux is normally not installed and always
 * fails. Detected via the WSL-specific env vars set by the Windows interop
 * layer, falling back to sniffing `/proc/version` (present on any real Linux
 * kernel, so this never throws outside of exotic sandboxes — guarded anyway).
 */
export function isWsl(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  readProcVersion: () => string = () => fs.readFileSync('/proc/version', 'utf8')
): boolean {
  if (platform !== 'linux') return false;
  if (env.WSL_DISTRO_NAME || env.WSL_INTEROP) return true;
  try {
    return /microsoft/i.test(readProcVersion());
  } catch {
    return false;
  }
}

/**
 * Converts a WSL-side path (e.g. `/tmp/x.html`) to the `\\wsl.localhost\...`
 * form Windows can open, via the `wslpath` utility that ships with WSL.
 * Returns `undefined` if `wslpath` is unavailable or fails, so callers can
 * fall back to the regular `xdg-open` attempt.
 */
export function toWslWindowsPath(
  filePath: string,
  runWslpath: (p: string) => string = (p) => execFileSync('wslpath', ['-w', p], { encoding: 'utf8' })
): string | undefined {
  try {
    const converted = runWslpath(filePath).trim();
    return converted || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Open a local file with the OS default application (ShellExecute / open / xdg-open).
 * Avoids vscode.env.openExternal(file: URI) on Windows, which can fail with 0x2 for paths
 * containing non-ASCII characters while still showing VS Code's own error dialog.
 *
 * On WSL, routes through `explorer.exe` with a `wslpath`-translated Windows
 * path — the same mechanism as native Windows — instead of the usually-missing
 * `xdg-open`, so a plain `xdg-open` failure there doesn't unnecessarily fall
 * back to `revealFileInOS`.
 */
export async function openFileInOsDefaultApp(filePath: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let child: ChildProcess | undefined;
    try {
      const wslWinPath = isWsl() ? toWslWindowsPath(filePath) : undefined;
      const { command, args } = wslWinPath !== undefined
        ? { command: 'explorer.exe', args: [wslWinPath] }
        : buildOpenCommand(process.platform, filePath);
      child = spawn(command, args, { detached: true, stdio: 'ignore' });
    } catch {
      resolve(false);
      return;
    }

    if (!child) {
      resolve(false);
      return;
    }

    child.once('error', () => resolve(false));
    child.once('spawn', () => {
      child!.unref();
      resolve(true);
    });
  });
}
