import { buildOpenCommand } from '../lib/openInOs';

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
