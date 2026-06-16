import { resolveInsertPosition, type FocusTarget } from '../lib/resolveInsertPosition';

describe('resolveInsertPosition', () => {
  const resolved = { opId: 'UHW010', secHeading: 'Input' };
  const secContent = 'line1\nline2\nline3';

  it('returns cursorPos when activeRef matches resolved opId + secHeading', () => {
    const active: FocusTarget = {
      area: 'unitOp',
      opIndex: 0,
      secIndex: 1,
      opId: 'UHW010',
      secHeading: 'Input',
      cursorPos: 7,
    };
    expect(resolveInsertPosition(active, resolved, secContent)).toBe(7);
  });

  it('falls back to content.length when opId differs', () => {
    const active: FocusTarget = {
      area: 'unitOp',
      opIndex: 0,
      secIndex: 1,
      opId: 'UHW020',
      secHeading: 'Input',
      cursorPos: 7,
    };
    expect(resolveInsertPosition(active, resolved, secContent)).toBe(secContent.length);
  });

  it('falls back to content.length when secHeading differs', () => {
    const active: FocusTarget = {
      area: 'unitOp',
      opIndex: 0,
      secIndex: 1,
      opId: 'UHW010',
      secHeading: 'Output',
      cursorPos: 7,
    };
    expect(resolveInsertPosition(active, resolved, secContent)).toBe(secContent.length);
  });

  it('falls back to content.length when activeRef is null', () => {
    expect(resolveInsertPosition(null, resolved, secContent)).toBe(secContent.length);
  });

  it('falls back to content.length when activeRef area is not unitOp', () => {
    const active: FocusTarget = { area: 'labnoteSection', sectionIndex: 0, cursorPos: 3 };
    expect(resolveInsertPosition(active, resolved, secContent)).toBe(secContent.length);
  });

  it('falls back to content.length when cursorPos is undefined', () => {
    const active: FocusTarget = {
      area: 'unitOp',
      opIndex: 0,
      secIndex: 1,
      opId: 'UHW010',
      secHeading: 'Input',
    };
    expect(resolveInsertPosition(active, resolved, secContent)).toBe(secContent.length);
  });

  it('returns 0 when matched and cursorPos is 0 (empty content case)', () => {
    const active: FocusTarget = {
      area: 'unitOp',
      opIndex: 0,
      secIndex: 1,
      opId: 'UHW010',
      secHeading: 'Input',
      cursorPos: 0,
    };
    expect(resolveInsertPosition(active, resolved, '')).toBe(0);
  });

  it('falls back when activeRef lacks opId (legacy shape)', () => {
    const active: FocusTarget = {
      area: 'unitOp',
      opIndex: 0,
      secIndex: 1,
      cursorPos: 7,
    };
    expect(resolveInsertPosition(active, resolved, secContent)).toBe(secContent.length);
  });

  it('clamps a cursorPos beyond content length down to content length', () => {
    const active: FocusTarget = {
      area: 'unitOp',
      opIndex: 0,
      secIndex: 1,
      opId: 'UHW010',
      secHeading: 'Input',
      cursorPos: 999,
    };
    expect(resolveInsertPosition(active, resolved, secContent)).toBe(secContent.length);
  });

  it('clamps a negative cursorPos up to 0', () => {
    const active: FocusTarget = {
      area: 'unitOp',
      opIndex: 0,
      secIndex: 1,
      opId: 'UHW010',
      secHeading: 'Input',
      cursorPos: -5,
    };
    expect(resolveInsertPosition(active, resolved, secContent)).toBe(0);
  });

  // Issue #34: when both sides carry a unique uoId, matching uses uoId — even
  // a matching opId code on a different instance must not reuse the caret.
  it('returns cursorPos when uoId matches on both sides', () => {
    const active: FocusTarget = {
      area: 'unitOp',
      opIndex: 1,
      secIndex: 1,
      opId: 'UHW010',
      uoId: 'unitop-2',
      secHeading: 'Input',
      cursorPos: 7,
    };
    expect(
      resolveInsertPosition(active, { opId: 'UHW010', secHeading: 'Input', uoId: 'unitop-2' }, secContent),
    ).toBe(7);
  });

  it('falls back to content.length when uoId differs even if opId matches', () => {
    const active: FocusTarget = {
      area: 'unitOp',
      opIndex: 0,
      secIndex: 1,
      opId: 'UHW010',
      uoId: 'unitop-1',
      secHeading: 'Input',
      cursorPos: 7,
    };
    expect(
      resolveInsertPosition(active, { opId: 'UHW010', secHeading: 'Input', uoId: 'unitop-2' }, secContent),
    ).toBe(secContent.length);
  });

  it('falls back to opId matching when resolved has no uoId (legacy)', () => {
    const active: FocusTarget = {
      area: 'unitOp',
      opIndex: 0,
      secIndex: 1,
      opId: 'UHW010',
      uoId: 'unitop-1',
      secHeading: 'Input',
      cursorPos: 7,
    };
    expect(resolveInsertPosition(active, resolved, secContent)).toBe(7);
  });
});
