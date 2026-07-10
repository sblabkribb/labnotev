import * as fs from 'fs';
import * as path from 'path';

/**
 * Guards against shipping a `vscode.l10n.t()` string that has no Korean
 * translation. Every static message key used in the extension host must exist
 * in `l10n/bundle.l10n.ko.json`, otherwise the ko locale silently falls back
 * to English. (H-3 in the code review.)
 */

const SRC_DIR = path.resolve(__dirname, '..');
const BUNDLE_PATH = path.resolve(__dirname, '..', '..', 'l10n', 'bundle.l10n.ko.json');

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      out.push(...collectTsFiles(full));
    } else if (entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

function unescapeLiteral(raw: string): string {
  return raw
    .replace(/\\(['"\\`])/g, '$1')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t');
}

function extractL10nKeys(source: string): string[] {
  // Match l10n.t( <optional whitespace/newline> <quote> <content> <quote>.
  const re = /l10n\.t\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g;
  const keys: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    keys.push(unescapeLiteral(m[2]));
  }
  return keys;
}

describe('l10n ko bundle coverage', () => {
  const bundle = JSON.parse(fs.readFileSync(BUNDLE_PATH, 'utf8')) as Record<string, string>;
  const files = collectTsFiles(SRC_DIR);

  const usedKeys = new Set<string>();
  for (const file of files) {
    for (const key of extractL10nKeys(fs.readFileSync(file, 'utf8'))) {
      usedKeys.add(key);
    }
  }

  it('every l10n.t() key used in src has a Korean translation', () => {
    const missing = [...usedKeys].filter(key => !(key in bundle)).sort();
    expect(missing).toEqual([]);
  });

  it('has no stale keys that are never used in src', () => {
    const stale = Object.keys(bundle).filter(key => !usedKeys.has(key)).sort();
    expect(stale).toEqual([]);
  });
});
