/**
 * PDF/CSV export helpers - pure functions (no `vscode` import) so they can be
 * unit tested directly. Command handlers in `commands/exportCommands.ts` do
 * the file-system and VS Code API calls and pass plain data in.
 */
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { resolveContainedPath } from './isPathInsideDir';
import { parseWorkflowChecklistFromReadme } from './workflowStructure';

// ---------------------------------------------------------------------------
// Candidate selection (which files can be exported from an experiment folder)
// ---------------------------------------------------------------------------

export interface ExportCandidate {
  absPath: string;
  label: string;
  /** Default checkbox state offered to the user in the QuickPick. */
  checked: boolean;
}

/**
 * Builds the list of files a user can pick from when exporting an experiment
 * folder: the README itself, then Related Workflows checklist entries (in
 * checklist order, pre-checked), then any other `###_*.labnote.md` sibling
 * files not on the checklist (unchecked). Deduplicated by resolved absolute
 * path — a README checklist can reference the same workflow file twice.
 */
export function buildExportCandidates(
  readmeAbsPath: string,
  readmeContent: string,
  siblingFileNames: string[]
): ExportCandidate[] {
  const dir = path.dirname(readmeAbsPath);
  const readmeResolved = path.resolve(readmeAbsPath);
  const candidates: ExportCandidate[] = [
    { absPath: readmeResolved, label: path.basename(readmeAbsPath), checked: true },
  ];
  const seen = new Set([readmeResolved]);

  for (const item of parseWorkflowChecklistFromReadme(readmeContent)) {
    const abs = resolveContainedPath(dir, item.fileName);
    if (!abs || seen.has(abs) || !siblingFileNames.includes(path.basename(abs))) continue;
    seen.add(abs);
    candidates.push({ absPath: abs, label: item.title, checked: true });
  }

  for (const fileName of [...siblingFileNames].sort()) {
    if (fileName.toLowerCase() === 'readme.labnote.md') continue;
    const abs = path.resolve(dir, fileName);
    if (seen.has(abs)) continue;
    seen.add(abs);
    candidates.push({ absPath: abs, label: fileName, checked: false });
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Reading sources: front matter for the cover, raw body for rendering
// ---------------------------------------------------------------------------

export interface ExportSource {
  absPath: string;
  fileName: string;
  dirPath: string;
  coverTitle: string;
  coverAuthor: string;
  createdDate: string;
  lastUpdatedDate: string;
  /** Markdown body (front matter stripped), unchanged from disk. */
  body: string;
}

function extractFrontMatterFields(raw: string): { fields: Record<string, string>; body: string } {
  const normalized = raw.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { fields: {}, body: normalized };

  const fields: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.length >= 2 && ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"')))) {
      value = value.slice(1, -1);
    }
    fields[key] = value;
  }
  return { fields, body: normalized.slice(match[0].length).replace(/^\n+/, '') };
}

/**
 * Reads and dedupes (by resolved absolute path) each requested file. Cover
 * fields are read as plain strings from front matter and never recomputed —
 * created/last-updated dates must match exactly what is on disk.
 */
export function collectExportSources(absPaths: string[]): ExportSource[] {
  const seen = new Set<string>();
  const sources: ExportSource[] = [];
  for (const p of absPaths) {
    const resolved = path.resolve(p);
    if (seen.has(resolved) || !fs.existsSync(resolved)) continue;
    seen.add(resolved);

    const raw = fs.readFileSync(resolved, 'utf8');
    const { fields, body } = extractFrontMatterFields(raw);
    sources.push({
      absPath: resolved,
      fileName: path.basename(resolved),
      dirPath: path.dirname(resolved),
      coverTitle: fields.title || path.basename(resolved),
      coverAuthor: fields.author || fields.experimenter || '',
      createdDate: fields.created_date || '',
      lastUpdatedDate: fields.last_updated_date || '',
      body,
    });
  }
  return sources;
}

// ---------------------------------------------------------------------------
// Markdown -> HTML fallback (only used if `markdown.api.render` is unavailable)
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Minimal, best-effort Markdown -> HTML conversion (headings, paragraphs,
 * `- ` lists, `![]()` images). Used only when the built-in
 * `markdown.api.render` command cannot be executed (e.g. the bundled
 * markdown extension is disabled) so export still produces something.
 */
export function renderMarkdownFallback(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${escapeHtml(heading[2])}</h${level}>`);
      continue;
    }

    const listItem = line.match(/^\s*[-*]\s+(.*)$/);
    if (listItem) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${escapeHtml(listItem[1])}</li>`);
      continue;
    }

    closeList();
    if (line.trim() === '') continue;

    const withImages = escapeHtml(line).replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (_m, alt, src) => `<img src="${src}" alt="${alt}" />`
    );
    out.push(`<p>${withImages}</p>`);
  }
  closeList();
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Post-processing rendered HTML: attachment image links + absolute file:// srcs
// ---------------------------------------------------------------------------

const IMAGE_EXT_RE = /\.(png|jpg|jpeg|gif|webp|svg|bmp)(?:[?#].*)?$/i;

/** Turns attachment-style links (`<a href="foo.png">foo.png</a>`) into `<img>` tags. */
export function attachmentLinksToImages(html: string): string {
  return html.replace(
    /<a\s+([^>]*?)href="([^"]+)"([^>]*)>([^<]*)<\/a>/gi,
    (match, _before, href, _after, text) => {
      if (!IMAGE_EXT_RE.test(href)) return match;
      return `<img src="${href}" alt="${text.trim()}" />`;
    }
  );
}

/**
 * Rewrites relative `<img src>` values to absolute `file://` URIs resolved
 * against `baseDir`. The report is opened as a plain file in the user's
 * browser (not a VS Code webview), so no CSP/asWebviewUri handling is needed —
 * just a correct absolute path.
 */
export function rewriteImageSources(html: string, baseDir: string): string {
  return html.replace(/(<img\b[^>]*\bsrc=")([^"]+)(")/gi, (match, pre, src, post) => {
    if (/^(?:https?:|data:|file:)/i.test(src)) return match;
    try {
      const abs = path.resolve(baseDir, decodeURIComponent(src));
      return `${pre}${pathToFileURL(abs).href}${post}`;
    } catch {
      return match;
    }
  });
}

export function postProcessBodyHtml(html: string, baseDir: string): string {
  return rewriteImageSources(attachmentLinksToImages(html), baseDir);
}

// ---------------------------------------------------------------------------
// Final HTML document assembly
// ---------------------------------------------------------------------------

export interface RenderedSource extends ExportSource {
  /** Result of `markdown.api.render(source.body)` (or the fallback renderer). */
  bodyHtml: string;
}

export interface CoverLabels {
  author: string;
  created: string;
  lastUpdated: string;
}

const PRINT_CSS = `
  @page { margin: 18mm 16mm; }
  body {
    font-family: "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
    color: #1a1a1a;
    max-width: 800px;
    margin: 0 auto;
    line-height: 1.5;
  }
  h1, h2, h3, h4 { line-height: 1.3; }
  .cover { margin-bottom: 24px; }
  .cover h1 { margin-bottom: 4px; }
  .meta { color: #555; font-size: 0.9em; }
  .source { margin-top: 24px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
  thead { display: table-header-group; }
  tr, img, pre { break-inside: avoid; page-break-inside: avoid; }
  img { max-width: 100%; }
  pre { white-space: pre-wrap; background: #f5f5f5; padding: 8px; border-radius: 4px; }
  code { background: #f5f5f5; padding: 0 3px; border-radius: 3px; }
  blockquote { border-left: 3px solid #ccc; padding-left: 8px; color: #555; margin-left: 0; }
`;

function renderMetaLine(source: ExportSource, labels: CoverLabels): string {
  return `<p class="meta">${labels.author}: ${escapeHtml(source.coverAuthor)} &middot; ${labels.created}: ${escapeHtml(source.createdDate)} &middot; ${labels.lastUpdated}: ${escapeHtml(source.lastUpdatedDate)}</p>`;
}

/**
 * Assembles the full export HTML: a cover block from the first source (its
 * title/author/created/last-updated, taken verbatim from front matter), the
 * first source's body, then each remaining source under its own heading and
 * meta line so multi-file exports still show accurate dates per file.
 */
export function buildExportHtml(sources: RenderedSource[], labels: CoverLabels): string {
  if (sources.length === 0) {
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body></body></html>';
  }

  const [first, ...rest] = sources;
  const firstBody = postProcessBodyHtml(first.bodyHtml, first.dirPath);

  const restHtml = rest
    .map((source) => {
      const body = postProcessBodyHtml(source.bodyHtml, source.dirPath);
      return `<section class="source">
  <h2>${escapeHtml(source.coverTitle)}</h2>
  ${renderMetaLine(source, labels)}
  ${body}
</section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(first.coverTitle)}</title>
<style>${PRINT_CSS}</style>
</head>
<body>
<header class="cover">
  <h1>${escapeHtml(first.coverTitle)}</h1>
  ${renderMetaLine(first, labels)}
</header>
<section class="source">
${firstBody}
</section>
${restHtml}
</body>
</html>`;
}
