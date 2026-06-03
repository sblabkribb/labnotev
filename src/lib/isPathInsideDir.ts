import * as path from 'path';

/** True if `candidatePath` is `parentDir` or a file/directory inside it (resolved paths). */
export function isPathInsideDir(parentDir: string, candidatePath: string): boolean {
  const parent = path.resolve(parentDir);
  const candidate = path.resolve(candidatePath);
  const rel = path.relative(parent, candidate);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}

/**
 * Resolve a (webview-supplied) relative path against `baseDir`, returning the
 * absolute path only when it stays inside `baseDir`; otherwise null. Rejects
 * empty/non-string input and any `..` traversal segment before resolving, so
 * crafted message payloads cannot escape the document folder.
 */
export function resolveContainedPath(baseDir: string, relPath: string): string | null {
  if (typeof relPath !== 'string' || relPath.length === 0) return null;
  const normalized = relPath.replace(/\\/g, '/');
  if (normalized.includes('..')) return null;
  const abs = path.resolve(baseDir, relPath);
  if (!isPathInsideDir(baseDir, abs)) return null;
  return abs;
}
