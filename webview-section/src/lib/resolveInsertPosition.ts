/**
 * Focus tracking ref shape used by Section Editor webview.
 *
 * The unitOp variant optionally carries `opId`/`secHeading` so we can
 * verify that the *most recently focused textarea* corresponds to the
 * section resolved from an incoming message payload before reusing its
 * caret position. Without this check the caret from section A could be
 * applied when inserting into section B.
 */
// `liveValue` mirrors the focused textarea's current (possibly uncommitted)
// value. Section drafts (useDraftValue) decouple the live textarea from App's
// committed document state, so insertions must splice into `liveValue` — the
// exact string `cursorPos` indexes — instead of the lagging committed content.
export type FocusTarget =
  | { area: 'labnoteSection'; sectionIndex: number; cursorPos?: number; liveValue?: string }
  | {
      area: 'unitOp';
      opIndex: number;
      secIndex: number;
      opId?: string;
      secHeading?: string;
      linkedWfIndex?: number;
      cursorPos?: number;
      liveValue?: string;
    }
  | { area: 'tailContent'; cursorPos?: number; liveValue?: string };

/**
 * Pick the insertion offset for a `sampleDefinitionCreated`-style message.
 *
 * Rules:
 * - Use `activeRef.cursorPos` only when the focused textarea matches the
 *   `resolved` unit-op section (same `opId` AND same `secHeading`).
 * - Otherwise fall back to the section's content length (append at end).
 * - The returned offset is always clamped to `[0, secContent.length]` so a
 *   stale/oversized caret can never splice past the end of the content.
 */
export function resolveInsertPosition(
  active: FocusTarget | null,
  resolved: { opId: string; secHeading: string },
  secContent: string,
): number {
  if (!active || active.area !== 'unitOp') return secContent.length;
  if (!active.opId || !active.secHeading) return secContent.length;
  if (active.opId !== resolved.opId) return secContent.length;
  if (active.secHeading !== resolved.secHeading) return secContent.length;
  if (active.cursorPos === undefined) return secContent.length;
  return Math.max(0, Math.min(active.cursorPos, secContent.length));
}
