import * as fs from 'fs';

/**
 * Write a file atomically: data is first written to a sibling temp file and
 * then renamed over the target. rename(2) is atomic on POSIX, and Node maps it
 * to a replace-existing move on Windows, so a reader never observes a
 * partially written file and a previously valid file survives an interrupted
 * write. On failure the temp file is removed on a best-effort basis.
 *
 * The temp path is prefixed with the full target path so callers/tests that
 * match on the destination filename still see it.
 */
export function writeFileAtomic(
  filePath: string,
  data: string,
  encoding: BufferEncoding = 'utf8'
): void {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, data, encoding);
  try {
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // Ignore cleanup failure; surface the original rename error.
    }
    throw err;
  }
}
