import { useState } from 'react';
import type { ReactNode } from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { HighlightedTextarea } from '../components/HighlightedTextarea';

function renderWithMantine(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

// Controlled wrapper so each `change` actually updates the `value` prop,
// which is what drives HighlightedTextarea's resize effect.
function Wrapper({ initial }: { initial: string }) {
  const [v, setV] = useState(initial);
  return <HighlightedTextarea value={v} onChange={setV} ariaLabel="ta" />;
}

describe('HighlightedTextarea resize coalescing (rAF)', () => {
  it('coalesces multiple rapid value changes into a single requestAnimationFrame', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');

    const { container } = renderWithMantine(<Wrapper initial="a" />);
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;

    // Flush any rAF scheduled during mount so the coalescing guard is reset,
    // then start counting from a clean slate.
    act(() => {
      rafSpy.mock.calls.forEach(([cb]) => cb(0));
    });
    rafSpy.mockClear();

    // Three rapid edits within the same frame (rAF not flushed in between).
    act(() => {
      fireEvent.change(ta, { target: { value: 'ab' } });
      fireEvent.change(ta, { target: { value: 'abc' } });
      fireEvent.change(ta, { target: { value: 'abcd' } });
    });

    // The guard must collapse the three resize triggers into one rAF.
    expect(rafSpy).toHaveBeenCalledTimes(1);

    rafSpy.mockRestore();
  });
});
