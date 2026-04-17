import { spawn, type ChildProcess } from 'child_process';

/**
 * Open a local file with the OS default application (ShellExecute / open / xdg-open).
 * Avoids vscode.env.openExternal(file: URI) on Windows, which can fail with 0x2 for paths
 * containing non-ASCII characters while still showing VS Code's own error dialog.
 */
export async function openFileInOsDefaultApp(filePath: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let child: ChildProcess | undefined;
    try {
      if (process.platform === 'win32') {
        child = spawn('cmd.exe', ['/c', 'start', '""', filePath], {
          detached: true,
          stdio: 'ignore',
          windowsVerbatimArguments: true,
        });
      } else if (process.platform === 'darwin') {
        child = spawn('open', [filePath], { detached: true, stdio: 'ignore' });
      } else {
        child = spawn('xdg-open', [filePath], { detached: true, stdio: 'ignore' });
      }
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
