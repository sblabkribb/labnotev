import { isFocusedOn, type AttachPayload } from '../lib/isFocusedOn';
import type { FocusTarget } from '../lib/resolveInsertPosition';

// Issue #20 hotfix: the paperclip ActionIcon lives outside the textarea, so
// `activeSectionRef.current` may point at a *different* section than the one
// being attached to (or to no section at all). We must only forward cursorPos
// to the extension when the focused textarea unambiguously matches the click
// payload, otherwise the link gets inserted at a stale caret in the wrong
// section.

describe('isFocusedOn', () => {
  it('matches labnoteSection by sectionIndex', () => {
    const payload: AttachPayload = { area: 'labnoteSection', sectionIndex: 2 };
    const active: FocusTarget = { area: 'labnoteSection', sectionIndex: 2, cursorPos: 7 };
    expect(isFocusedOn(payload, active)).toBe(true);
  });

  it('rejects labnoteSection with mismatched sectionIndex', () => {
    const payload: AttachPayload = { area: 'labnoteSection', sectionIndex: 2 };
    const active: FocusTarget = { area: 'labnoteSection', sectionIndex: 3, cursorPos: 0 };
    expect(isFocusedOn(payload, active)).toBe(false);
  });

  it('matches unitOp by opIndex+secIndex (extra opId on active is ignored)', () => {
    const payload: AttachPayload = { area: 'unitOp', opIndex: 0, secIndex: 1 };
    const active: FocusTarget = {
      area: 'unitOp',
      opIndex: 0,
      secIndex: 1,
      opId: 'x',
      cursorPos: 4,
    };
    expect(isFocusedOn(payload, active)).toBe(true);
  });

  it('rejects when areas differ', () => {
    const payload: AttachPayload = { area: 'unitOp', opIndex: 0, secIndex: 1 };
    const active: FocusTarget = { area: 'tailContent', cursorPos: 0 };
    expect(isFocusedOn(payload, active)).toBe(false);
  });

  it('rejects when active is null', () => {
    const payload: AttachPayload = { area: 'tailContent' };
    expect(isFocusedOn(payload, null)).toBe(false);
  });

  it('rejects when active has no cursorPos', () => {
    const payload: AttachPayload = { area: 'tailContent' };
    const active: FocusTarget = { area: 'tailContent' };
    expect(isFocusedOn(payload, active)).toBe(false);
  });

  it('matches tailContent without indices', () => {
    const payload: AttachPayload = { area: 'tailContent' };
    const active: FocusTarget = { area: 'tailContent', cursorPos: 12 };
    expect(isFocusedOn(payload, active)).toBe(true);
  });

  it('rejects unitOp with mismatched linkedWfIndex', () => {
    const payload: AttachPayload = { area: 'unitOp', opIndex: 0, secIndex: 1, linkedWfIndex: 1 };
    const active: FocusTarget = {
      area: 'unitOp',
      opIndex: 0,
      secIndex: 1,
      linkedWfIndex: undefined,
      cursorPos: 4,
    };
    expect(isFocusedOn(payload, active)).toBe(false);
  });
});
