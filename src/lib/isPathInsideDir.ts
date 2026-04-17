import * as path from 'path';

/** True if `candidatePath` is `parentDir` or a file/directory inside it (resolved paths). */
export function isPathInsideDir(parentDir: string, candidatePath: string): boolean {
  const parent = path.resolve(parentDir);
  const candidate = path.resolve(candidatePath);
  const rel = path.relative(parent, candidate);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel));
}
