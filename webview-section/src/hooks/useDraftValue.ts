import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Decouple a controlled textarea's per-keystroke value from its parent's
 * document state. Typing updates a local `draft` immediately (so only this
 * subtree re-renders), and the parent `onCommit` is called on a trailing
 * debounce or on an explicit `flush()` (e.g. on blur / unmount).
 *
 * Why this exists: section text is lifted to App's top-level `labNote`/
 * `workflow` state. Committing on every keystroke re-runs App's render and
 * re-creates one element per section/unit-op (O(N)), even though memoized
 * children skip re-rendering. Buffering the upward propagation removes that
 * per-keystroke cost; visible UI (textarea, overlay, debounced thumbnails)
 * reads the local draft so there is no perceived lag.
 *
 * Invariants:
 * - `draft` mirrors keystrokes synchronously.
 * - External prop changes (sample insert, TreeView edits, re-init) are adopted
 *   into the draft during render so the same render already shows the truth —
 *   important because callers measure caret geometry in a rAF right after such
 *   an external change.
 * - An echo of a value this hook just committed does NOT reset the draft, so
 *   the caret/undo stack survive while the user keeps typing.
 * - The debounce timer only commits when the draft actually diverges from the
 *   last committed value, so a timer left over after an external adoption is a
 *   self-healing no-op (it never re-commits a stale draft).
 *
 * Returns `[draft, setDraft, flush]`.
 */
export function useDraftValue(
  value: string,
  onCommit: (value: string) => void,
  delay = 250
): [string, (value: string) => void, () => void] {
  const [draft, setDraftState] = useState(value);

  // Latest values read by the timer/flush without re-creating callbacks.
  const draftRef = useRef(value);
  const lastCommittedRef = useRef(value);
  const prevValueRef = useRef(value);
  const onCommitRef = useRef(onCommit);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onCommitRef.current = onCommit;
  }, [onCommit]);

  // React to prop transitions at render time (derived-state pattern). We key on
  // whether the prop actually CHANGED since the last render — not on a diff
  // against `lastCommitted` — so a stale prop that simply predates our own
  // pending commit never clobbers a newer draft.
  if (value !== prevValueRef.current) {
    prevValueRef.current = value;
    if (value !== lastCommittedRef.current) {
      // Genuine external mutation (sample insert, re-init, ...): adopt as the
      // new source of truth immediately so the same render shows the truth.
      lastCommittedRef.current = value;
      draftRef.current = value;
      setDraftState(value);
    }
    // else: the parent merely echoed back a value we just committed -> keep the
    // draft (and caret/undo) untouched.
  }

  const commit = useCallback((next: string) => {
    if (next === lastCommittedRef.current) return;
    lastCommittedRef.current = next;
    onCommitRef.current(next);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const setDraft = useCallback(
    (next: string) => {
      draftRef.current = next;
      setDraftState(next);
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        // Self-healing: only commit if the draft still diverges. An external
        // adoption that happened after scheduling makes the refs equal again,
        // so this becomes a no-op rather than re-committing a stale value.
        commit(draftRef.current);
      }, delay);
    },
    [clearTimer, commit, delay]
  );

  const flush = useCallback(() => {
    clearTimer();
    commit(draftRef.current);
  }, [clearTimer, commit]);

  // Commit any pending draft when the component unmounts (e.g. the section is
  // collapsed or the mode switches right after typing) so edits are not lost.
  useEffect(() => {
    return () => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        if (draftRef.current !== lastCommittedRef.current) {
          lastCommittedRef.current = draftRef.current;
          onCommitRef.current(draftRef.current);
        }
      }
    };
  }, []);

  return [draft, setDraft, flush];
}
