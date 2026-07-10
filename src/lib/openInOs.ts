import { spawn, type ChildProcess } from 'child_process';

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
 * Open a local file with the OS default application (ShellExecute / open / xdg-open).
 * Avoids vscode.env.openExternal(file: URI) on Windows, which can fail with 0x2 for paths
 * containing non-ASCII characters while still showing VS Code's own error dialog.
 */
export async function openFileInOsDefaultApp(filePath: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let child: ChildProcess | undefined;
    try {
      const { command, args } = buildOpenCommand(process.platform, filePath);
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
