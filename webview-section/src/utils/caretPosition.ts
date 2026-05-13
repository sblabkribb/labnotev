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
export function getTextareaCaretRect(
  textarea: HTMLTextAreaElement,
  pos: number
): DOMRect | null {
  const doc = textarea.ownerDocument;
  if (!doc) return null;

  const computed = window.getComputedStyle(textarea);
  const mirror = doc.createElement('div');

  // These properties affect where a given character offset renders.
  // Keeping this list in sync with HighlightedTextarea's textareaStyle is
  // what makes the approximation match the real caret.
  const copied: Array<keyof CSSStyleDeclaration> = [
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
  for (const key of copied) {
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
  // Keep height auto so the mirror grows to fit and the span lands on the
  // correct visual line even when the textarea would otherwise overflow.
  mirror.style.height = 'auto';
  mirror.style.overflow = 'hidden';

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
