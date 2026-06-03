import { collectMatches } from '../lib/findMatches';

function setup(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  // Mantine/textarea `.value` must be set programmatically for controlled-like
  // setups; here we rely on the `value`/textContent below.
  return root;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('collectMatches', () => {
  it('returns no matches for an empty query', () => {
    setup('<textarea></textarea>');
    const ta = document.querySelector('textarea')!;
    ta.value = 'hello world';
    expect(collectMatches('', false)).toEqual([]);
  });

  it('finds all occurrences in a single textarea', () => {
    setup('<textarea></textarea>');
    const ta = document.querySelector('textarea')!;
    ta.value = 'aXaXa';
    const matches = collectMatches('a', false);
    expect(matches).toHaveLength(3);
    expect(matches.map((m) => m.start)).toEqual([0, 2, 4]);
    expect(matches.every((m) => m.el === ta)).toBe(true);
  });

  it('is case-insensitive by default and case-sensitive when requested', () => {
    setup('<textarea></textarea>');
    const ta = document.querySelector('textarea')!;
    ta.value = 'Foo foo FOO';

    expect(collectMatches('foo', false)).toHaveLength(3);

    const sensitive = collectMatches('foo', true);
    expect(sensitive).toHaveLength(1);
    expect(sensitive[0].start).toBe(4);
  });

  it('collects across textarea and input in DOM order', () => {
    setup('<input type="text" /><textarea></textarea>');
    const input = document.querySelector('input')!;
    const ta = document.querySelector('textarea')!;
    input.value = 'match here';
    ta.value = 'another match';

    const matches = collectMatches('match', false);
    expect(matches).toHaveLength(2);
    // input comes first in DOM order.
    expect(matches[0].el).toBe(input);
    expect(matches[1].el).toBe(ta);
  });

  it('excludes elements marked with data-find-skip', () => {
    setup('<input type="text" data-find-skip /><textarea></textarea>');
    const input = document.querySelector('input')!;
    const ta = document.querySelector('textarea')!;
    input.value = 'skip me';
    ta.value = 'keep me';

    const matches = collectMatches('me', false);
    expect(matches).toHaveLength(1);
    expect(matches[0].el).toBe(ta);
  });

  it('does not match non-text inputs', () => {
    setup('<input type="checkbox" /><input type="number" />');
    const matches = collectMatches('a', false);
    expect(matches).toEqual([]);
  });

  it('handles overlapping-free advancement without infinite loops', () => {
    setup('<textarea></textarea>');
    const ta = document.querySelector('textarea')!;
    ta.value = 'aaaa';
    // 'aa' should match at 0 and 2 (non-overlapping advancement).
    const matches = collectMatches('aa', false);
    expect(matches.map((m) => [m.start, m.end])).toEqual([
      [0, 2],
      [2, 4],
    ]);
  });
});
