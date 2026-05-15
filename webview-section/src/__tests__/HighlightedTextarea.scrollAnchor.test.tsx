import { resizeToContent } from '../components/HighlightedTextarea';

// jsdom leaves `document.scrollingElement` null. The helper falls back to
// `document.documentElement` which is always present, so we patch scrollTop
// on documentElement directly.
function patchScrollTop(initial: number) {
  let value = initial;
  const setSpy = vi.fn((v: number) => { value = v; });
  Object.defineProperty(document.documentElement, 'scrollTop', {
    configurable: true,
    get() { return value; },
    set: setSpy,
  });
  return {
    get current() { return value; },
    forceTo(v: number) { value = v; },
    setSpy,
  };
}

function patchScrollHeight(el: HTMLElement, height: number) {
  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    get() { return height; },
  });
}

afterEach(() => {
  // Each test patches documentElement.scrollTop; reset between tests so the
  // spy/state doesn't leak.
  Object.defineProperty(document.documentElement, 'scrollTop', {
    configurable: true,
    writable: true,
    value: 0,
  });
});

describe('HighlightedTextarea scroll anchor (Issue #21)', () => {
  it('restores outer scrollTop when style.height="auto" triggers a layout-induced shift', () => {
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);

    patchScrollHeight(ta, 800);
    const scroll = patchScrollTop(500);

    // Simulate the browser pulling scrollTop upward when the textarea
    // momentarily collapses to min-height during the `auto` step. This is
    // exactly the visible side effect users reported in Issue #21.
    let heightValue = '';
    Object.defineProperty(ta.style, 'height', {
      configurable: true,
      get() { return heightValue; },
      set(v: string) {
        heightValue = v;
        if (v === 'auto') {
          scroll.forceTo(0);
        }
      },
    });

    resizeToContent(ta);

    expect(heightValue).toBe('800px');
    expect(scroll.current).toBe(500);
    expect(scroll.setSpy).toHaveBeenCalledWith(500);

    document.body.removeChild(ta);
  });

  it('does not write to scrollTop when no shift occurred', () => {
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);

    patchScrollHeight(ta, 400);
    const scroll = patchScrollTop(120);

    resizeToContent(ta);

    expect(ta.style.height).toBe('400px');
    expect(scroll.current).toBe(120);
    expect(scroll.setSpy).not.toHaveBeenCalled();

    document.body.removeChild(ta);
  });
});
