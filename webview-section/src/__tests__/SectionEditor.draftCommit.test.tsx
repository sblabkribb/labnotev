import type { ReactNode } from 'react';
import { render, act, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { SectionEditor } from '../components/SectionEditor';
import * as vscodeApi from '../vscodeApi';

function wrap(ui: ReactNode) {
  return <MantineProvider>{ui}</MantineProvider>;
}

describe('SectionEditor defers parent commits via a local draft', () => {
  beforeEach(() => {
    vi.spyOn(vscodeApi, 'postMessage').mockImplementation(() => {});
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('shows typed text immediately but does NOT call onChange synchronously', () => {
    const onChange = vi.fn();
    const { container } = render(
      wrap(<SectionEditor index={0} heading="H" content="a" onChange={onChange} />)
    );
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;

    act(() => {
      fireEvent.change(ta, { target: { value: 'ab' } });
    });

    // Draft is reflected in the DOM immediately...
    expect(ta.value).toBe('ab');
    // ...but the parent is not yet told.
    expect(onChange).not.toHaveBeenCalled();
  });

  it('commits the final value once after the debounce window', () => {
    const onChange = vi.fn();
    const { container } = render(
      wrap(<SectionEditor index={2} heading="H" content="a" onChange={onChange} />)
    );
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;

    act(() => {
      fireEvent.change(ta, { target: { value: 'ab' } });
      fireEvent.change(ta, { target: { value: 'abc' } });
    });
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(2, 'abc');
  });

  it('flushes the pending draft on blur (focusout)', () => {
    const onChange = vi.fn();
    const { container } = render(
      wrap(<SectionEditor index={1} heading="H" content="a" onChange={onChange} />)
    );
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;

    act(() => {
      fireEvent.change(ta, { target: { value: 'abXY' } });
    });
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      fireEvent.blur(ta);
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(1, 'abXY');
  });
});
