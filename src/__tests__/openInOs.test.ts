import { buildOpenCommand, isWsl, toWslWindowsPath } from '../lib/openInOs';

describe('buildOpenCommand', () => {
  it('uses explorer.exe with the path as a single argument on win32', () => {
    const { command, args } = buildOpenCommand('win32', 'C:\\notes\\report.xlsx');
    expect(command).toBe('explorer.exe');
    expect(args).toEqual(['C:\\notes\\report.xlsx']);
  });

  it('does not let cmd metacharacters split into extra arguments on win32', () => {
    // A file named with `&` / `%` must be passed verbatim as ONE argument so
    // no shell parsing (cmd command chaining or env expansion) can occur.
    const evil = 'C:\\notes\\report&calc%PATH%.xlsx';
    const { command, args } = buildOpenCommand('win32', evil);
    expect(command).toBe('explorer.exe');
    expect(args).toEqual([evil]);
    expect(args).toHaveLength(1);
  });

  it('uses open on darwin', () => {
    const { command, args } = buildOpenCommand('darwin', '/tmp/report.xlsx');
    expect(command).toBe('open');
    expect(args).toEqual(['/tmp/report.xlsx']);
  });

  it('uses xdg-open on linux', () => {
    const { command, args } = buildOpenCommand('linux', '/tmp/report.xlsx');
    expect(command).toBe('xdg-open');
    expect(args).toEqual(['/tmp/report.xlsx']);
  });
});

// Regression guard: WSL reports process.platform === 'linux' but almost never
// has `xdg-open` installed (no desktop session), so `openFileInOsDefaultApp`
// must detect WSL and route through `explorer.exe` instead — otherwise the
// PDF export report never opens and silently falls back to revealFileInOS.
describe('isWsl', () => {
  it('is false on non-linux platforms regardless of env/proc hints', () => {
    expect(isWsl('win32', { WSL_DISTRO_NAME: 'Ubuntu' }, () => 'microsoft')).toBe(false);
    expect(isWsl('darwin', { WSL_INTEROP: '/run/x' }, () => 'microsoft')).toBe(false);
  });

  it('is true on linux when WSL_DISTRO_NAME is set', () => {
    expect(isWsl('linux', { WSL_DISTRO_NAME: 'Ubuntu-24.04' }, () => 'Linux version x')).toBe(true);
  });

  it('is true on linux when WSL_INTEROP is set', () => {
    expect(isWsl('linux', { WSL_INTEROP: '/run/WSL/1_interop' }, () => 'Linux version x')).toBe(true);
  });

  it('falls back to sniffing /proc/version for "microsoft" when no env vars are set', () => {
    expect(isWsl('linux', {}, () => 'Linux version 6.6.87.2-microsoft-standard-WSL2')).toBe(true);
  });

  it('is false on a regular Linux desktop (no WSL env vars, no "microsoft" in /proc/version)', () => {
    expect(isWsl('linux', {}, () => 'Linux version 6.8.0-generic')).toBe(false);
  });

  it('is false when /proc/version cannot be read', () => {
    expect(
      isWsl('linux', {}, () => {
        throw new Error('ENOENT');
      })
    ).toBe(false);
  });
});

describe('toWslWindowsPath', () => {
  it('returns the trimmed wslpath output', () => {
    const result = toWslWindowsPath('/tmp/report.html', () => '\\\\wsl.localhost\\Ubuntu-24.04\\tmp\\report.html\n');
    expect(result).toBe('\\\\wsl.localhost\\Ubuntu-24.04\\tmp\\report.html');
  });

  it('returns undefined when wslpath throws (not installed / not WSL)', () => {
    const result = toWslWindowsPath('/tmp/report.html', () => {
      throw new Error('command not found');
    });
    expect(result).toBeUndefined();
  });

  it('returns undefined when wslpath outputs an empty string', () => {
    expect(toWslWindowsPath('/tmp/report.html', () => '   ')).toBeUndefined();
  });
});
