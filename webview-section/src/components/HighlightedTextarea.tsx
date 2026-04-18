import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { SampleHighlighter, highlightSampleIds } from './SampleHighlighter';
import type { SampleDefMap } from '../types';

export interface HighlightedTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onCursorChange?: (pos: number) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
  onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
  minRows?: number;
  availableTypes?: string[];
  sampleTypeColors?: Record<string, string>;
  sampleDefs?: SampleDefMap;
  /** Bumping `tick` (any new object) imperatively focuses the textarea and moves the caret to `pos`. */
  requestFocusAt?: { pos: number; tick: number } | null;
  ariaLabel?: string;
}

/**
 * Textarea with a synchronized highlight overlay for sample tokens.
 *
 * Ownership boundary:
 * - This component owns the textarea + overlay layer, auto-resize, scroll
 *   sync, and caret-focus imperatives. Toolbars, thumbnails, attachment
 *   lists, table modals, and table-editing hooks stay with the caller.
 *
 * Layer invariant (must not regress):
 * - Overlay `z-index` is strictly greater than the transparent textarea's
 *   `z-index` so sample spans in the overlay can receive hover events
 *   (HoverCard). The overlay itself stays `pointer-events: none`, so clicks
 *   on non-sample regions still reach the textarea for caret positioning.
 */
export const HighlightedTextarea = forwardRef<HTMLTextAreaElement, HighlightedTextareaProps>(
  function HighlightedTextarea(
    {
      value,
      onChange,
      onFocus,
      onCursorChange,
      onKeyDown,
      onPaste,
      minRows = 4,
      availableTypes,
      sampleTypeColors,
      sampleDefs,
      requestFocusAt,
      ariaLabel,
    },
    forwardedRef
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const [hasSamples, setHasSamples] = useState(false);

    useImperativeHandle(forwardedRef, () => textareaRef.current as HTMLTextAreaElement, []);

    useEffect(() => {
      setHasSamples(highlightSampleIds(value, availableTypes));
    }, [value, availableTypes]);

    useEffect(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }, [value]);

    useEffect(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      const resize = () => {
        ta.style.height = 'auto';
        ta.style.height = ta.scrollHeight + 'px';
      };
      const observer = new ResizeObserver(resize);
      observer.observe(ta);
      return () => observer.disconnect();
    }, []);

    const reportCursor = () => {
      if (textareaRef.current && onCursorChange) {
        onCursorChange(textareaRef.current.selectionStart);
      }
    };

    useEffect(() => {
      if (!requestFocusAt) return;
      const ta = textareaRef.current;
      if (!ta) return;
      requestAnimationFrame(() => {
        ta.focus();
        ta.selectionStart = ta.selectionEnd = requestFocusAt.pos;
        reportCursor();
      });
      // Only re-run when `tick` changes; `reportCursor` intentionally not in deps.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requestFocusAt?.tick]);

    const syncScroll = () => {
      if (textareaRef.current && overlayRef.current) {
        overlayRef.current.scrollTop = textareaRef.current.scrollTop;
        overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
      }
    };

    /**
     * Phase B-2: Forward clicks on interactive sample spans to the textarea
     * so the caret lands at the clicked position instead of being trapped by
     * the HoverCard target. The overlay mirrors the textarea (same font,
     * padding, line-height), so the character offset inside the overlay's
     * text nodes maps 1:1 to the textarea value.
     */
    const handleSampleMouseDown = (e: React.MouseEvent<HTMLSpanElement>) => {
      const ta = textareaRef.current;
      const overlay = overlayRef.current;
      if (!ta || !overlay) return;

      const doc = document as Document & {
        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
        caretRangeFromPoint?: (x: number, y: number) => Range | null;
      };

      let targetNode: Node | null = null;
      let targetOffset = 0;
      if (doc.caretPositionFromPoint) {
        const pos = doc.caretPositionFromPoint(e.clientX, e.clientY);
        if (pos) {
          targetNode = pos.offsetNode;
          targetOffset = pos.offset;
        }
      } else if (doc.caretRangeFromPoint) {
        const range = doc.caretRangeFromPoint(e.clientX, e.clientY);
        if (range) {
          targetNode = range.startContainer;
          targetOffset = range.startOffset;
        }
      }

      // Walk overlay text nodes and accumulate lengths until we hit the target.
      // Fall back to the end of the clicked span so the caret still lands near
      // the token if caret-from-point APIs are unavailable (older browsers).
      let offset = -1;
      if (targetNode) {
        const walker = document.createTreeWalker(overlay, NodeFilter.SHOW_TEXT);
        let running = 0;
        let node: Node | null;
        while ((node = walker.nextNode())) {
          if (node === targetNode) {
            offset = running + targetOffset;
            break;
          }
          running += node.textContent?.length ?? 0;
        }
      }
      if (offset < 0) {
        // Fallback: use the character offset up to the end of the clicked span.
        const span = e.currentTarget;
        const walker = document.createTreeWalker(overlay, NodeFilter.SHOW_TEXT);
        let running = 0;
        let node: Node | null;
        while ((node = walker.nextNode())) {
          if (span.contains(node)) {
            running += node.textContent?.length ?? 0;
          } else if (span.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING) {
            running += node.textContent?.length ?? 0;
          } else {
            break;
          }
        }
        offset = running;
      }

      e.preventDefault();
      ta.focus();
      ta.setSelectionRange(offset, offset);
      reportCursor();
    };

    const textareaStyle: React.CSSProperties = {
      fontFamily: 'monospace',
      fontSize: '13px',
      lineHeight: '1.55',
      width: '100%',
      padding: '8px',
      border: '1px solid var(--mantine-color-default-border)',
      borderRadius: '4px',
      resize: 'none',
      overflow: 'hidden',
      minHeight: `${minRows * 1.55 * 13 + 16}px`,
      background: hasSamples ? 'transparent' : 'var(--mantine-color-body)',
      color: hasSamples ? 'transparent' : 'var(--mantine-color-text)',
      caretColor: 'var(--mantine-color-text)',
      position: hasSamples ? 'relative' : undefined,
      zIndex: hasSamples ? 2 : undefined,
    };

    const overlayStyle: React.CSSProperties = {
      fontFamily: 'monospace',
      fontSize: '13px',
      lineHeight: '1.55',
      padding: '8px',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'none',
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
      overflow: 'hidden',
      zIndex: 3,
      color: 'var(--mantine-color-text)',
    };

    return (
      <div style={{ position: 'relative' }}>
        {hasSamples && (
          <div ref={overlayRef} style={overlayStyle}>
            <SampleHighlighter
              text={value}
              interactive
              availableTypes={availableTypes}
              sampleTypeColors={sampleTypeColors}
              sampleDefs={sampleDefs}
              onSampleClick={handleSampleMouseDown}
            />
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.currentTarget.value);
            reportCursor();
          }}
          onFocus={() => {
            onFocus?.();
            reportCursor();
          }}
          onClick={reportCursor}
          onKeyUp={reportCursor}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onScroll={syncScroll}
          aria-label={ariaLabel}
          style={textareaStyle}
        />
      </div>
    );
  }
);
