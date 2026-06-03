/** `[label](href)` but not `![...](...)` image syntax (negative lookbehind). */
export const MARKDOWN_FILE_LINK_RE = /(?<!!)\[([^\]]*)\]\(([^)]+)\)/g;

export const IMAGE_PATH_EXT = /\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i;

export function isImagePath(href: string): boolean {
  return IMAGE_PATH_EXT.test(href);
}

/** Relative experiment-folder hrefs only; rejects URLs and path traversal. */
export function normalizeLocalMarkdownHref(raw: string): string | null {
  let href = raw.trim();
  if (!href || href.includes('..')) return null;
  if (href.startsWith('#')) return null;
  if (/:\/\/|^[a-z][a-z0-9+.-]*:/i.test(href)) return null;
  if (href.startsWith('./')) href = href.slice(2);
  if (/^[\\/]/.test(href) || /^[a-zA-Z]:[\\/]/i.test(href)) return null;
  return href;
}

export function isWorkflowDocLink(href: string): boolean {
  const lower = href.toLowerCase();
  return lower.endsWith('.labnote.md');
}
