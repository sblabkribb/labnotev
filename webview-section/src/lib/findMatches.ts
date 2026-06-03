/**
 * Editor-mode find (#30): collect plain-text matches across all editable
 * fields in the Section Editor webview.
 *
 * The Section Editor keeps its content inside many independent `<textarea>`
 * and `<input>` form controls, so the VS Code webview's native find widget
 * (which only searches rendered DOM text nodes) cannot see it. Instead we scan
 * the live form controls directly. Collecting from the DOM (rather than the
 * React data model) keeps a single source of truth for both matching and
 * highlighting and needs no prop plumbing.
 */

export type SearchableElement = HTMLTextAreaElement | HTMLInputElement;

export interface FindMatch {
  /** The form control that owns this match. */
  el: SearchableElement;
  /** Inclusive start offset into `el.value`. */
  start: number;
  /** Exclusive end offset into `el.value`. */
  end: number;
}

/**
 * Find every occurrence of `query` across all searchable controls, in DOM
 * order (which mirrors visual top-to-bottom order). Both `<textarea>` and
 * `<input type="text">` are searched. Elements tagged with `data-find-skip`
 * (e.g. the read-only Experiment Type field) are excluded.
 *
 * Matching is plain-text (no regex); case-insensitive unless `caseSensitive`.
 * An empty/whitespace-free guard returns `[]` for a blank query so the caller
 * clears highlights.
 */
export function collectMatches(
  query: string,
  caseSensitive: boolean,
  root: ParentNode = document
): FindMatch[] {
  if (!query) return [];

  const needle = caseSensitive ? query : query.toLowerCase();
  if (needle.length === 0) return [];

  const matches: FindMatch[] = [];
  const controls = root.querySelectorAll<SearchableElement>(
    'textarea, input[type="text"]'
  );

  controls.forEach((el) => {
    if (el.hasAttribute('data-find-skip')) return;
    const raw = el.value ?? '';
    if (!raw) return;
    const haystack = caseSensitive ? raw : raw.toLowerCase();

    let from = 0;
    while (true) {
      const idx = haystack.indexOf(needle, from);
      if (idx === -1) break;
      matches.push({ el, start: idx, end: idx + needle.length });
      // Advance past this match. `needle.length >= 1` here, so no infinite loop.
      from = idx + needle.length;
    }
  });

  return matches;
}
