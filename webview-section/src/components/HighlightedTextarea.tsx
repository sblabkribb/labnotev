import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActionIcon } from '@mantine/core';
import { SampleHighlighter, highlightSampleIds } from './SampleHighlighter';
import type { SampleDefMap } from '../types';
import { getTextareaCaretRect, scrollCaretIntoView } from '../utils/caretPosition';
import { postMessage } from '../vscodeApi';

/**
 * Auto-resize the textarea to fit its content while preserving the outer
 * page scroll position.
 *
 * Without the anchor, setting `style.height = 'auto'` briefly collapses the
 * textarea to its `min-height`. When that gap is large (e.g. a 50-line
 * section shrinks from ~800px back to ~97px), the browser pulls the outer
 * scroller upward to keep the focused textarea in view. By the time the
 * second assignment restores `scrollHeight + 'px'`, the page scroll has
 * already shifted — appearing to the user as "the screen jumps up every
 * keystroke" (Issue #21).
 *
 * Exported for unit testing; not part of the public component API.
 */
export function resizeToContent(ta: HTMLTextAreaElement): void {
  // Per spec `document.scrollingElement` is the documentElement in
  // standards-compliant pages, but some host environments (and jsdom)
  // leave it null. Fall back so the anchor still applies.
  const scroller = (document.scrollingElement
    || document.documentElement) as HTMLElement | null;
  const prevTop = scroller?.scrollTop ?? 0;

  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';

  if (scroller && scroller.scrollTop !== prevTop) {
    scroller.scrollTop = prevTop;
  }
}

export interface HighlightedTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onCursorChange?: (pos: number, value: string) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
  onPaste?: React.ClipboardEventHandler<HTMLTextAreaElement>;
  minRows?: number;
  availableTypes?: string[];
  sampleTypeColors?: Record<string, string>;
  sampleDefs?: SampleDefMap;
  /**
   * Bumping `tick` (any new object) imperatively focuses the textarea and
   * moves the caret to `pos`.
   *
   * `scroll` controls how the viewport follows the caret:
   * - `'none'`: keep current viewport (legacy behaviour; used for onClick
   *   `+Sample` and similar in-place actions where the user already sees the
   *   target section).
   * - `'nearest'` (default): scroll the textarea into view only if it is
   *   outside the viewport. This keeps TreeView inserts into already-visible
   *   sections stable while still following the caret when it would
   *   otherwise land offscreen (e.g. inserting into a long section whose
   *   bottom is below the fold).
   * - `'center'`: scroll the textarea so the caret area sits near the
   *   middle of the viewport (used by "Go to definition").
   */
  requestFocusAt?: { pos: number; tick: number; scroll?: 'none' | 'nearest' | 'center' } | null;
  ariaLabel?: string;
  /**
   * Optional context metadata bundled with the Send-to-Chat payload so the
   * extension can prepend a `Selected from <file> / UnitOp <id> / Section "..."`
   * header to the LLM prompt. Both props are flat strings (not a single object)
   * to keep this component's `memo` comparison stable when the caller does not
   * memoize a context object.
   */
  chatContextOpId?: string;
  chatContextSectionHeading?: string;
}

function SendToChatIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 14 21 3" />
      <path d="M21 3 14.5 21a.55.55 0 0 1-1 0L10 14l-7-3.5a.55.55 0 0 1 0-1Z" />
    </svg>
  );
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
 *   `z-index` so sample spans in the overlay can receive click events
 *   (definition Popover). The overlay itself stays `pointer-events: none`, so
 *   clicks on non-sample regions still reach the textarea for caret positioning.
 */
export const HighlightedTextarea = memo(forwardRef<HTMLTextAreaElement, HighlightedTextareaProps>(
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
      chatContextOpId,
      chatContextSectionHeading,
    },
    forwardedRef
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    // Derived synchronously so the overlay/transparent-text styles are correct
    // on the very first render (no flash of opaque text) and we avoid the extra
    // render an effect-driven state would cause on every value change.
    const hasSamples = useMemo(
      () => highlightSampleIds(value, availableTypes),
      [value, availableTypes]
    );
    const [selectionAnchor, setSelectionAnchor] = useState<{ top: number } | null>(null);
    // Pending clear timer for the post-blur grace window so the floating
    // button has time to receive its click before being unmounted.
    const blurClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // While true, the imperative focus useEffect is mid-flight — onFocus
    // fires synchronously from `ta.focus()` before `selectionStart` has been
    // repositioned, so any `reportCursor()` during that window would latch
    // the old caret into the parent's `activeSectionRef.cursorPos`. Guard
    // onFocus/onClick reporters against this stale read.
    const isApplyingFocusRef = useRef(false);

    useImperativeHandle(forwardedRef, () => textareaRef.current as HTMLTextAreaElement, []);

    // Coalesce resize triggers (value changes + ResizeObserver callbacks) into
    // a single rAF so multiple triggers within one frame cause at most one
    // synchronous reflow. `resizeToContent` itself stays synchronous (and
    // keeps the scroll-anchor restore from Issue #21); only the scheduling is
    // batched.
    const resizeRafRef = useRef<number | null>(null);
    const scheduleResize = useCallback(() => {
      if (resizeRafRef.current != null) return;
      resizeRafRef.current = requestAnimationFrame(() => {
        resizeRafRef.current = null;
        const ta = textareaRef.current;
        if (ta) resizeToContent(ta);
      });
    }, []);

    useEffect(() => () => {
      if (resizeRafRef.current != null) cancelAnimationFrame(resizeRafRef.current);
    }, []);

    useEffect(() => {
      scheduleResize();
    }, [value, scheduleResize]);

    useEffect(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      const observer = new ResizeObserver(() => scheduleResize());
      observer.observe(ta);
      return () => observer.disconnect();
    }, [scheduleResize]);

    // Issue #18-2 hotfix: in some webview environments React's synthetic
    // onKeyDown preventDefault is not enough to stop the textarea's native
    // Tab focus traversal. Register a capture-phase native keydown listener
    // that swallows the default Tab action *before* React's bubble phase.
    // The actual indent/outdent logic still runs from the React onKeyDown
    // path (see useTableEditing.handleKeyDown).
    useEffect(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      const block = (e: KeyboardEvent) => {
        if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
        }
      };
      ta.addEventListener('keydown', block, { capture: true });
      return () => ta.removeEventListener('keydown', block, { capture: true } as EventListenerOptions);
    }, []);

    // Stable identity so `handleSampleMouseDown` below (which is passed to
    // the memoized `SampleHighlighter`) doesn't recreate on every keystroke.
    const reportCursor = useCallback(() => {
      if (isApplyingFocusRef.current) return;
      if (textareaRef.current && onCursorChange) {
        onCursorChange(textareaRef.current.selectionStart, textareaRef.current.value);
      }
    }, [onCursorChange]);

    /**
     * Recompute the floating Send-to-Chat button position from the current
     * selection. When the textarea has no selection (start === end), hide the
     * button.
     */
    const updateSelectionAnchor = useCallback(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      if (ta.selectionStart === ta.selectionEnd) {
        setSelectionAnchor(null);
        return;
      }
      const caretRect = getTextareaCaretRect(ta, ta.selectionEnd);
      const taRect = ta.getBoundingClientRect();
      if (!caretRect) {
        // Caret rect unavailable (e.g. jsdom) — anchor near the textarea top
        // so the button still appears in tests/headless envs.
        setSelectionAnchor({ top: 4 });
        return;
      }
      setSelectionAnchor({ top: Math.max(0, caretRect.top - taRect.top) });
    }, []);

    const triggerSendToChat = useCallback(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const stop = ta.selectionEnd;
      if (start === stop) return;
      const selectedText = ta.value.slice(start, stop);
      if (!selectedText.trim()) return;
      postMessage({
        type: 'sendSelectionToChat',
        data: { selectedText, chatContextOpId, chatContextSectionHeading },
      });
    }, [chatContextOpId, chatContextSectionHeading]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const isSendKey =
          (e.ctrlKey || e.metaKey) &&
          e.altKey &&
          (e.key === 'l' || e.key === 'L');
        if (isSendKey) {
          e.preventDefault();
          triggerSendToChat();
          return;
        }
        onKeyDown?.(e);
      },
      [onKeyDown, triggerSendToChat]
    );

    useEffect(() => {
      return () => {
        if (blurClearTimerRef.current) {
          clearTimeout(blurClearTimerRef.current);
          blurClearTimerRef.current = null;
        }
      };
    }, []);

    useEffect(() => {
      if (!requestFocusAt) return;
      const ta = textareaRef.current;
      if (!ta) return;
      const scrollMode = requestFocusAt.scroll ?? 'nearest';
      const pos = requestFocusAt.pos;
      const rafId = requestAnimationFrame(() => {
        isApplyingFocusRef.current = true;
        try {
          // Order matters: set the selection first, then focus. This way the
          // synchronous onFocus fired by `ta.focus()` would read the already
          // updated `selectionStart`, though `isApplyingFocusRef` still
          // suppresses the report to avoid any edge cases.
          ta.selectionStart = ta.selectionEnd = pos;
          // `preventScroll: true` stops the browser from jumping the outer
          // container to the caret — we opt into scrolling explicitly based
          // on the real caret position computed below.
          ta.focus({ preventScroll: true });

          // Why not `ta.scrollIntoView({ block: 'nearest' })`?
          // This project auto-resizes the textarea to `scrollHeight` with
          // `overflow: hidden`, so the <textarea> element can be taller
          // than the viewport. `scrollIntoView` then aligns the textarea's
          // top/bottom edge to the viewport — when the top is above the
          // fold it pulls the textarea's *first line* into view, which the
          // user perceives as the caret "jumping to line 1" even though
          // selectionStart is correct. Instead, compute where the caret
          // actually lands and scroll only enough to reveal *that* point.
          if (scrollMode !== 'none') {
            const caretRect = getTextareaCaretRect(ta, pos);
            if (caretRect) {
              scrollCaretIntoView(caretRect, scrollMode);
            }
          }
        } finally {
          isApplyingFocusRef.current = false;
        }
        if (onCursorChange) onCursorChange(ta.selectionStart, ta.value);
      });
      // Cancel a pending rAF if `tick` changes before the callback fires, or
      // if the component unmounts. Without this, stale callbacks can race
      // with a newer focus request and leave the caret at the old offset.
      return () => {
        cancelAnimationFrame(rafId);
      };
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
     * the Popover target. The overlay mirrors the textarea (same font,
     * padding, line-height), so the character offset inside the overlay's
     * text nodes maps 1:1 to the textarea value.
     */
    const handleSampleMouseDown = useCallback((e: React.MouseEvent<HTMLSpanElement>) => {
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
    }, [reportCursor]);

    const textareaStyle: React.CSSProperties = {
      fontFamily: 'monospace',
      fontSize: '13px',
      lineHeight: '1.55',
      width: '100%',
      padding: '8px',
      border: '1px solid var(--mantine-color-default-border)',
      borderRadius: '4px',
      boxSizing: 'border-box',
      resize: 'none',
      overflow: 'hidden',
      minHeight: `${minRows * 1.55 * 13 + 18}px`,
      background: hasSamples ? 'transparent' : 'var(--mantine-color-body)',
      color: hasSamples ? 'transparent' : 'var(--mantine-color-text)',
      caretColor: 'var(--mantine-color-text)',
      position: hasSamples ? 'relative' : undefined,
      zIndex: hasSamples ? 2 : undefined,
    };

    // Overlay must match textarea's content-box geometry exactly: same padding,
    // same 1px border footprint (transparent so it's invisible), same
    // box-sizing. Otherwise wrap positions diverge by ~2px of content width and
    // a single word can slip onto the next line in the overlay only, making
    // the caret appear one visual line offset from the actual selectionStart.
    const overlayStyle: React.CSSProperties = {
      fontFamily: 'monospace',
      fontSize: '13px',
      lineHeight: '1.55',
      padding: '8px',
      border: '1px solid transparent',
      boxSizing: 'border-box',
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
            updateSelectionAnchor();
          }}
          onFocus={() => {
            onFocus?.();
            reportCursor();
            if (blurClearTimerRef.current) {
              clearTimeout(blurClearTimerRef.current);
              blurClearTimerRef.current = null;
            }
            updateSelectionAnchor();
          }}
          onBlur={() => {
            reportCursor();
            // Give the floating button a chance to receive its click before
            // it unmounts (mousedown on the button itself preventDefaults
            // blur, but defensive in case focus moves elsewhere).
            if (blurClearTimerRef.current) clearTimeout(blurClearTimerRef.current);
            blurClearTimerRef.current = setTimeout(() => {
              setSelectionAnchor(null);
              blurClearTimerRef.current = null;
            }, 150);
          }}
          onClick={() => {
            reportCursor();
            updateSelectionAnchor();
          }}
          onKeyUp={() => {
            reportCursor();
            updateSelectionAnchor();
          }}
          onMouseUp={updateSelectionAnchor}
          onSelect={updateSelectionAnchor}
          onKeyDown={handleKeyDown}
          onPaste={onPaste}
          onScroll={syncScroll}
          aria-label={ariaLabel}
          style={textareaStyle}
        />
        {selectionAnchor && (
          <ActionIcon
            size="xs"
            variant="filled"
            color="blue"
            aria-label="Send selection to Chat"
            title="Send to Chat (Ctrl+Alt+L)"
            onMouseDown={(e) => e.preventDefault()}
            onClick={triggerSendToChat}
            style={{
              position: 'absolute',
              right: 4,
              top: selectionAnchor.top,
              zIndex: 4,
            }}
          >
            <SendToChatIcon />
          </ActionIcon>
        )}
      </div>
    );
  }
));
