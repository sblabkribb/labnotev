import * as path from 'path';
import { isPathInsideDir } from './isPathInsideDir';

/** Image extensions that should render inline via `![](...)` (matches webview IMAGE_PATH_EXT). */
const IMAGE_EXT_RE = /\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i;

/** True when the path/name points at an image that should use inline `![]()` syntax. */
export function isImageFile(name: string): boolean {
  return IMAGE_EXT_RE.test(name);
}

/**
 * Percent-encode only the characters that break a GitHub markdown link
 * destination: space, `(` and `)`. Path separators and unicode (e.g. Korean)
 * are intentionally left intact — both GitHub and VS Code render them fine.
 */
export function encodeAttachmentHref(rel: string): string {
  return rel
    .replace(/ /g, '%20')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

/** Reverse of {@link encodeAttachmentHref}. No-op on already-raw paths (backward compatible). */
export function decodeAttachmentHref(href: string): string {
  return href
    .replace(/%20/g, ' ')
    .replace(/%28/g, '(')
    .replace(/%29/g, ')');
}

/**
 * Build a markdown link for an attachment. Images use inline `![label](href)`
 * so they render on GitHub; other files use `[label](href)`. The visible label
 * stays human-readable while the href is percent-encoded.
 */
export function formatAttachmentMarkdown(label: string, rel: string): string {
  const prefix = isImageFile(rel) ? '!' : '';
  return `${prefix}[${label}](${encodeAttachmentHref(rel)})`;
}

/**
 * If `selectedPath` resolves inside `docDir`, returns a markdown link using
 * forward slashes (`![name](rel)` for images, `[name](rel)` otherwise) with the
 * href percent-encoded. Otherwise returns null (caller should copy into e.g.
 * resources/attachments).
 */
export function buildInDocDirAttachmentMarkdownLink(docDir: string, selectedPath: string): string | null {
  const resolvedDoc = path.resolve(docDir);
  const resolvedSel = path.resolve(selectedPath);
  if (!isPathInsideDir(resolvedDoc, resolvedSel)) return null;

  const rel = path.relative(resolvedDoc, resolvedSel).split(path.sep).join('/');
  if (rel.includes('..')) return null;

  const baseName = path.basename(resolvedSel);
  const href = rel || baseName;
  return formatAttachmentMarkdown(baseName, href);
}
