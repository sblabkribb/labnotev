import { useEffect, useState } from 'react';
import type { FindMatch } from '../lib/findMatches';
import { getElementMatchRects } from '../utils/caretPosition';

/**
 * Editor-mode find (#30): draws translucent highlight boxes over every match
 * inside a <textarea>. Rendered as an absolutely-positioned child of the app's
 * `position: relative` wrapper; box coordinates are stored relative to that
 * wrapper so they stay correct on scroll without recomputation (textareas have
 * no internal scroll — they auto-resize with `overflow: hidden`).
 *
 * Single-line <input> matches are intentionally not boxed here (the mirror
 * technique mis-wraps horizontally-scrolling inputs); the active <input> match
 * is shown via the browser's native selection instead.
 */

// Skip drawing when there are too many matches — the count still shows in the
// FindBar, but measuring/painting thousands of boxes would jank the editor.
const MAX_HIGHLIGHT_MATCHES = 500;
const RECOMPUTE_DEBOUNCE_MS = 150;

interface HighlightBox {
  top: number;
  left: number;
  width: number;
  height: number;
  active: boolean;
}

interface SearchHighlightLayerProps {
  matches: FindMatch[];
  activeIndex: number;
  /** The `position: relative` wrapper the layer is rendered into. */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function SearchHighlightLayer({ matches, activeIndex, containerRef }: SearchHighlightLayerProps) {
  const [boxes, setBoxes] = useState<HighlightBox[]>([]);

  useEffect(() => {
    if (matches.length === 0 || matches.length > MAX_HIGHLIGHT_MATCHES) {
      setBoxes([]);
      return;
    }

    let cancelled = false;
    const compute = () => {
      const container = containerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();

      // Group match indices by their owning <textarea>; inputs are skipped
      // (native selection covers the active one).
      const byElement = new Map<HTMLTextAreaElement, number[]>();
      matches.forEach((m, idx) => {
        if (m.el.tagName !== 'TEXTAREA') return;
        const el = m.el as HTMLTextAreaElement;
        const list = byElement.get(el);
        if (list) list.push(idx);
        else byElement.set(el, [idx]);
      });

      const next: HighlightBox[] = [];
      byElement.forEach((indices, el) => {
        const ranges = indices.map((i) => ({ start: matches[i].start, end: matches[i].end }));
        const rectsPerRange = getElementMatchRects(el, ranges);
        rectsPerRange.forEach((rects, j) => {
          const isActive = indices[j] === activeIndex;
          for (const r of rects) {
            next.push({
              top: r.top - containerRect.top,
              left: r.left - containerRect.left,
              width: r.width,
              height: r.height,
              active: isActive,
            });
          }
        });
      });

      if (!cancelled) setBoxes(next);
    };

    const timer = setTimeout(compute, RECOMPUTE_DEBOUNCE_MS);
    const onResize = () => compute();
    window.addEventListener('resize', onResize);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, [matches, activeIndex, containerRef]);

  if (boxes.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      {boxes.map((b, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: b.top,
            left: b.left,
            width: b.width,
            height: b.height,
            // Translucent so the text underneath stays readable (mirrors the
            // native find widget's overlay behaviour). Active match is warmer
            // and more opaque to stand out from the rest.
            background: b.active ? 'rgba(255,140,0,0.55)' : 'rgba(255,213,0,0.40)',
            borderRadius: 2,
            pointerEvents: 'none',
          }}
        />
      ))}
    </div>
  );
}
