import type { ReactNode } from 'react';
import { render, act } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { SectionEditor } from '../components/SectionEditor';
import * as vscodeApi from '../vscodeApi';

function wrap(ui: ReactNode) {
  return <MantineProvider>{ui}</MantineProvider>;
}

describe('SectionEditor debounces display-only parsing (ImageThumbnails)', () => {
  beforeEach(() => {
    vi.spyOn(vscodeApi, 'postMessage').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('thumbnail for newly typed image link appears only after the debounce window', () => {
    vi.useFakeTimers();

    const { container, rerender } = render(
      wrap(
        <SectionEditor index={0} heading="H" content="" onChange={() => {}} docBaseUri="https://base" />
      )
    );

    expect(container.querySelectorAll('img').length).toBe(0);

    // Simulate the content prop changing (as it would on each keystroke).
    rerender(
      wrap(
        <SectionEditor index={0} heading="H" content="![a](images/a.png)" onChange={() => {}} docBaseUri="https://base" />
      )
    );

    // Debounced content has not updated yet -> still no thumbnail.
    expect(container.querySelectorAll('img').length).toBe(0);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // After the debounce window, the thumbnail is parsed and rendered.
    expect(container.querySelectorAll('img').length).toBe(1);
  });
});
