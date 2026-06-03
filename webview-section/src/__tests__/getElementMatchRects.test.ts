import { getElementMatchRects } from '../utils/caretPosition';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('getElementMatchRects', () => {
  function makeTextarea(value: string): HTMLTextAreaElement {
    const ta = document.createElement('textarea');
    ta.value = value;
    document.body.appendChild(ta);
    return ta;
  }

  it('returns an empty array per range for an empty ranges list', () => {
    const ta = makeTextarea('hello');
    expect(getElementMatchRects(ta, [])).toEqual([]);
  });

  it('returns an array parallel to the input ranges', () => {
    const ta = makeTextarea('foo bar foo');
    const result = getElementMatchRects(ta, [
      { start: 0, end: 3 },
      { start: 8, end: 11 },
    ]);
    expect(result).toHaveLength(2);
    expect(Array.isArray(result[0])).toBe(true);
    expect(Array.isArray(result[1])).toBe(true);
  });

  it('removes its measurement mirror from the DOM after measuring', () => {
    const ta = makeTextarea('some content here');
    const before = document.body.childElementCount;
    getElementMatchRects(ta, [{ start: 0, end: 4 }]);
    // Only the textarea should remain; the temporary mirror div is cleaned up.
    expect(document.body.childElementCount).toBe(before);
    expect(document.body.querySelector('div')).toBeNull();
  });

  it('clamps out-of-bounds ranges without throwing', () => {
    const ta = makeTextarea('abc');
    expect(() => getElementMatchRects(ta, [{ start: 1, end: 999 }])).not.toThrow();
  });
});
