/**
 * Focus tracking ref shape used by Section Editor webview.
 *
 * The unitOp variant optionally carries `opId`/`secHeading` so we can
 * verify that the *most recently focused textarea* corresponds to the
 * section resolved from an incoming message payload before reusing its
 * caret position. Without this check the caret from section A could be
 * applied when inserting into section B.
 */
// `cursorPos` is the last reported caret offset of the focused textarea, used
// only as a fallback when the live DOM node is unavailable. The authoritative
// source for both content and caret at insertion time is the focused textarea
// DOM node itself (App tracks it as `activeSectionRef.current.el`), which never
// drifts from what the user sees — unlike a value snapshot, which goes stale
// after a programmatic insertion (issues #33, #34).
export type FocusTarget =
  | { area: 'labnoteSection'; sectionIndex: number; cursorPos?: number }
  | {
      area: 'unitOp';
      opIndex: number;
      secIndex: number;
      opId?: string;
      /**
       * Unique instance id of the focused unit op (`UnitOperationBlock.id`).
       * Issue #34: `opId` is a reusable code, so it cannot disambiguate two
       * unit ops sharing the same code. When present, matching is done by
       * `uoId` instead so inserts land in the exact op the user edited.
       */
      uoId?: string;
      secHeading?: string;
      linkedWfIndex?: number;
      cursorPos?: number;
    }
  | { area: 'tailContent'; cursorPos?: number };

/**
 * Pick the insertion offset for a `sampleDefinitionCreated`-style message.
 *
 * Rules:
 * - Use `activeRef.cursorPos` only when the focused textarea matches the
 *   `resolved` unit-op section. When both sides carry a unique instance id
 *   (`uoId`), match on that (issue #34); otherwise fall back to matching the
 *   reusable `opId` code. The section must always match on `secHeading`.
 * - Otherwise fall back to the section's content length (append at end).
 * - The returned offset is always clamped to `[0, secContent.length]` so a
 *   stale/oversized caret can never splice past the end of the content.
 */
export function resolveInsertPosition(
  active: FocusTarget | null,
  resolved: { opId: string; secHeading: string; uoId?: string },
  secContent: string,
): number {
  if (!active || active.area !== 'unitOp') return secContent.length;
  if (!active.secHeading) return secContent.length;
  if (resolved.uoId !== undefined && active.uoId !== undefined) {
    if (active.uoId !== resolved.uoId) return secContent.length;
  } else {
    if (!active.opId) return secContent.length;
    if (active.opId !== resolved.opId) return secContent.length;
  }
  if (active.secHeading !== resolved.secHeading) return secContent.length;
  if (active.cursorPos === undefined) return secContent.length;
  return Math.max(0, Math.min(active.cursorPos, secContent.length));
}
