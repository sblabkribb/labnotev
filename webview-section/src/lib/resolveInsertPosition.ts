/**
 * Focus tracking ref shape used by Section Editor webview.
 *
 * The unitOp variant optionally carries `opId`/`secHeading` so we can
 * verify that the *most recently focused textarea* corresponds to the
 * section resolved from an incoming message payload before reusing its
 * caret position. Without this check the caret from section A could be
 * applied when inserting into section B.
 */
export type FocusTarget =
  | { area: 'labnoteSection'; sectionIndex: number; cursorPos?: number }
  | {
      area: 'unitOp';
      opIndex: number;
      secIndex: number;
      opId?: string;
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
 *   `resolved` unit-op section (same `opId` AND same `secHeading`).
 * - Otherwise fall back to the section's content length (append at end).
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
  return active.cursorPos ?? secContent.length;
}
