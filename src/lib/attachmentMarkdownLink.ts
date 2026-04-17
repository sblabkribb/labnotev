import * as path from 'path';
import { isPathInsideDir } from './isPathInsideDir';

/**
 * If `selectedPath` resolves inside `docDir`, returns a markdown link `[basename](rel)` using forward slashes.
 * Otherwise returns null (caller should copy into e.g. resources/attachments).
 */
export function buildInDocDirAttachmentMarkdownLink(docDir: string, selectedPath: string): string | null {
  const resolvedDoc = path.resolve(docDir);
  const resolvedSel = path.resolve(selectedPath);
  if (!isPathInsideDir(resolvedDoc, resolvedSel)) return null;

  const rel = path.relative(resolvedDoc, resolvedSel).split(path.sep).join('/');
  if (rel.includes('..')) return null;

  const baseName = path.basename(resolvedSel);
  const href = rel || baseName;
  return `[${baseName}](${href})`;
}
