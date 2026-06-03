/**
 * Compute the viewport rect of a textarea's caret position.
 *
 * Uses the classic "mirror div" technique: build an off-screen div that
 * mirrors every style of the textarea that affects text layout (font,
 * padding, border, width, wrap rules, tab size, letter/word spacing), copy
 * `value.slice(0, pos)` into it and append a zero-width marker span. The
 * span's bounding client rect is an accurate approximation of where the
 * real caret sits in the viewport — accurate enough to decide whether the
 * caret is visible and how far to scroll to reveal it.
 *
 * We deliberately compute this *only* when a scroll decision is needed
 * (i.e. right after an imperative focus-at request). No per-keystroke work.
 */
// Style properties that affect where a given character offset renders.
// Keeping this list in sync with HighlightedTextarea's textareaStyle is what
// makes the mirror approximation match the real caret/selection geometry.
const MIRROR_COPIED_STYLES: Array<keyof CSSStyleDeclaration> = [
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
  'MozTabSize' as keyof CSSStyleDeclaration,
];

/**
 * Build an off-screen div that mirrors a textarea's text-layout styles. The
 * caller fills it with text (and optionally `<mark>` spans), appends it to the
 * body, measures, then removes it. Shared by `getTextareaCaretRect` (caret
 * geometry) and `getElementMatchRects` (search-match geometry) so both stay in
 * lock-step with the textarea's wrap rules.
 */
function createStyleMirror(textarea: HTMLTextAreaElement, doc: Document): HTMLDivElement {
  const computed = window.getComputedStyle(textarea);
  const mirror = doc.createElement('div');
  for (const key of MIRROR_COPIED_STYLES) {
    const value = computed[key as unknown as number];
    if (typeof value === 'string') {
      (mirror.style as unknown as Record<string, string>)[key as string] = value;
    }
  }
  // Match textarea wrap behaviour. <textarea>'s default is
  // `white-space: pre-wrap; word-wrap: break-word;` regardless of CSS, so
  // force the same on the mirror even if computed values disagree.
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.top = '0';
  mirror.style.left = '0';
  // Keep height auto so the mirror grows to fit and spans land on the correct
  // visual line even when the textarea would otherwise overflow.
  mirror.style.height = 'auto';
  mirror.style.overflow = 'hidden';
  return mirror;
}

export function getTextareaCaretRect(
  textarea: HTMLTextAreaElement,
  pos: number
): DOMRect | null {
  const doc = textarea.ownerDocument;
  if (!doc) return null;

  const computed = window.getComputedStyle(textarea);
  const mirror = createStyleMirror(textarea, doc);

  const text = textarea.value.slice(0, pos);
  mirror.textContent = text;

  const marker = doc.createElement('span');
  // Zero-width joiner so the span has measurable dimensions even at EOL.
  marker.textContent = '\u200b';
  mirror.appendChild(marker);

  doc.body.appendChild(mirror);
  const taRect = textarea.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();

  // marker rect is in viewport coordinates but offset from the mirror's
  // position (which we placed at (0,0) of the document body). Translate it
  // so it reads relative to the textarea's on-screen position, then back to
  // the viewport by adding the textarea's own rect origin.
  const relativeTop = markerRect.top - mirrorRect.top;
  const relativeLeft = markerRect.left - mirrorRect.left;
  const viewportTop = taRect.top + relativeTop - textarea.scrollTop;
  const viewportLeft = taRect.left + relativeLeft - textarea.scrollLeft;

  doc.body.removeChild(mirror);

  // Use line-height-ish fallback for height so the rect has a meaningful
  // vertical extent even though the marker is a zero-width joiner.
  const lineHeightPx = parseFloat(computed.lineHeight);
  const height = Number.isFinite(lineHeightPx) && lineHeightPx > 0
    ? lineHeightPx
    : markerRect.height || parseFloat(computed.fontSize) * 1.2 || 16;

  // DOMRect constructor is fine in modern webviews (Electron/VS Code).
  return new DOMRect(viewportLeft, viewportTop, markerRect.width || 1, height);
}

/**
 * Decide whether and how far to scroll the window so the caret rect is
 * visible, honouring a `'none' | 'nearest' | 'center'` policy.
 *
 * - `'none'`: never scrolls.
 * - `'nearest'`: scrolls only when the caret is above or below the viewport
 *   by more than `margin` pixels. This is what TreeView inserts use —
 *   visible caret stays put, offscreen caret is pulled back with minimal
 *   movement.
 * - `'center'`: pulls the caret to the vertical centre of the viewport.
 *   Used by "Go to definition" so the definition pops into the middle.
 */
export function scrollCaretIntoView(
  caretRect: DOMRect,
  mode: 'none' | 'nearest' | 'center',
  margin = 40
): void {
  if (mode === 'none') return;
  const vh = window.innerHeight || document.documentElement.clientHeight;
  if (mode === 'center') {
    const target = caretRect.top - vh / 2 + caretRect.height / 2;
    if (Math.abs(target) > 1) {
      window.scrollBy({ top: target, behavior: 'auto' });
    }
  } else if (caretRect.top < margin) {
    window.scrollBy({ top: caretRect.top - margin, behavior: 'auto' });
  } else if (caretRect.bottom > vh - margin) {
    window.scrollBy({ top: caretRect.bottom - (vh - margin), behavior: 'auto' });
  }
}

/**
 * Editor-mode find (#30): compute the viewport rects of one or more match
 * ranges inside a <textarea>.
 *
 * Uses the same mirror-div technique as `getTextareaCaretRect`, but wraps each
 * match range in a `<mark>` and reads `mark.getClientRects()` — which returns
 * one rect per visual line, so a match that wraps across lines yields multiple
 * rects automatically. One mirror is built per call (not per match) to keep
 * measurement cheap.
 *
 * Returns an array parallel to `ranges`: `result[i]` holds the viewport rects
 * for `ranges[i]`. Coordinates are viewport-relative (like
 * `getTextareaCaretRect`); the caller converts them to its container's
 * coordinate space. Textarea-only by design — single-line `<input>` controls
 * scroll horizontally and would mis-wrap in the mirror, so they are not
 * highlighted (see plan).
 */
export function getElementMatchRects(
  textarea: HTMLTextAreaElement,
  ranges: Array<{ start: number; end: number }>
): DOMRect[][] {
  const doc = textarea.ownerDocument;
  if (!doc || ranges.length === 0) return ranges.map(() => []);

  const mirror = createStyleMirror(textarea, doc);

  const value = textarea.value;
  const marks: HTMLElement[] = [];
  let cursor = 0;
  // Build text + <mark> structure in range order. Ranges from collectMatches
  // are already non-overlapping and in ascending order within an element.
  for (const range of ranges) {
    const clampedStart = Math.max(cursor, Math.min(range.start, value.length));
    const clampedEnd = Math.max(clampedStart, Math.min(range.end, value.length));
    if (clampedStart > cursor) {
      mirror.appendChild(doc.createTextNode(value.slice(cursor, clampedStart)));
    }
    const mark = doc.createElement('mark');
    mark.textContent = value.slice(clampedStart, clampedEnd);
    mirror.appendChild(mark);
    marks.push(mark);
    cursor = clampedEnd;
  }
  if (cursor < value.length) {
    mirror.appendChild(doc.createTextNode(value.slice(cursor)));
  }

  doc.body.appendChild(mirror);
  const taRect = textarea.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();

  const result: DOMRect[][] = marks.map((mark) => {
    const rects: DOMRect[] = [];
    const clientRects = mark.getClientRects();
    for (let i = 0; i < clientRects.length; i++) {
      const r = clientRects[i];
      const viewportTop = taRect.top + (r.top - mirrorRect.top) - textarea.scrollTop;
      const viewportLeft = taRect.left + (r.left - mirrorRect.left) - textarea.scrollLeft;
      rects.push(new DOMRect(viewportLeft, viewportTop, r.width, r.height));
    }
    return rects;
  });

  doc.body.removeChild(mirror);
  return result;
}
