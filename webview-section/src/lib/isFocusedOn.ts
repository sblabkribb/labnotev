import type { FocusTarget } from './resolveInsertPosition';

/**
 * Payload identifying the section a user clicked the attach-file icon for.
 * Mirrors the data sent over `attachFile` postMessage minus the cursorPos
 * field that this module helps decide whether to populate.
 */
export type AttachPayload = {
  area: 'unitOp' | 'labnoteSection' | 'tailContent' | 'linkedUnitOp';
  opIndex?: number;
  secIndex?: number;
  sectionIndex?: number;
  linkedWfIndex?: number;
};

/**
 * Issue #20: returns true only when the currently focused textarea (tracked
 * via `activeSectionRef`) exactly identifies the section the paperclip click
 * is targeting AND a caret position has been recorded for it. Callers should
 * forward `active.cursorPos` to the extension only when this returns true;
 * otherwise the attach handler falls back to appending at the section end so
 * that a stale caret from a different section never gets misapplied.
 */
export function isFocusedOn(payload: AttachPayload, active: FocusTarget | null): boolean {
  if (!active) return false;
  if (typeof active.cursorPos !== 'number') return false;

  // `FocusTarget` only carries 'labnoteSection' | 'unitOp' | 'tailContent', so
  // a 'linkedUnitOp' payload (currently unused by callers) is conservatively
  // rejected here. Mirrors the dead branch in App.tsx without granting it a
  // matching FocusTarget shape.
  if (payload.area === 'linkedUnitOp') return false;
  if (active.area !== payload.area) return false;

  if (active.area === 'labnoteSection' && payload.area === 'labnoteSection') {
    return active.sectionIndex === payload.sectionIndex;
  }
  if (active.area === 'unitOp' && payload.area === 'unitOp') {
    return active.opIndex === payload.opIndex
      && active.secIndex === payload.secIndex
      && active.linkedWfIndex === payload.linkedWfIndex;
  }
  if (active.area === 'tailContent' && payload.area === 'tailContent') {
    return true;
  }
  return false;
}
