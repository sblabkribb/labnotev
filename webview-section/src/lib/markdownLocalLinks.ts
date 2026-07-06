/** `[label](href)` but not `![...](...)` image syntax (negative lookbehind). */
export const MARKDOWN_FILE_LINK_RE = /(?<!!)\[([^\]]*)\]\(([^)]+)\)/g;

export const IMAGE_PATH_EXT = /\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i;

export function isImagePath(href: string): boolean {
  return IMAGE_PATH_EXT.test(href);
}

/**
 * Reverse of the extension's `encodeAttachmentHref` (Issue #37). Decodes only
 * `%20/%28/%29` so display/open paths resolve to the real file. Kept as a local
 * copy because the webview build cannot import from the extension `src/`.
 */
export function decodeAttachmentHref(href: string): string {
  return href
    .replace(/%20/g, ' ')
    .replace(/%28/g, '(')
    .replace(/%29/g, ')');
}

/** Relative experiment-folder hrefs only; rejects URLs and path traversal. */
export function normalizeLocalMarkdownHref(raw: string): string | null {
  let href = raw.trim();
  // Run the security checks on the raw (still-encoded) string first, then
  // decode only at the end so encoded sequences can't smuggle in `..`.
  if (!href || href.includes('..')) return null;
  if (href.startsWith('#')) return null;
  if (/:\/\/|^[a-z][a-z0-9+.-]*:/i.test(href)) return null;
  if (href.startsWith('./')) href = href.slice(2);
  if (/^[\\/]/.test(href) || /^[a-zA-Z]:[\\/]/i.test(href)) return null;
  return decodeAttachmentHref(href);
}

export function isWorkflowDocLink(href: string): boolean {
  const lower = href.toLowerCase();
  return lower.endsWith('.labnote.md');
}
