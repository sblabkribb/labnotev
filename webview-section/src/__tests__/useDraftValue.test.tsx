import { renderHook, act } from '@testing-library/react';
import { useDraftValue } from '../hooks/useDraftValue';

describe('useDraftValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates the local draft immediately but does NOT commit synchronously', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useDraftValue('a', onCommit, 250));

    act(() => {
      result.current[1]('ab');
    });

    // draft reflects the new value right away
    expect(result.current[0]).toBe('ab');
    // but the parent commit is deferred
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits the latest value once after the debounce delay', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useDraftValue('a', onCommit, 250));

    act(() => {
      result.current[1]('ab');
      result.current[1]('abc');
      result.current[1]('abcd');
    });
    expect(onCommit).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('abcd');
  });

  it('flush() commits the pending draft immediately and cancels the timer', () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useDraftValue('a', onCommit, 250));

    act(() => {
      result.current[1]('abXY');
    });
    act(() => {
      result.current[2](); // flush
    });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('abXY');

    // The previously scheduled debounce must not fire a second commit.
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('adopts an external prop change into the draft', () => {
    const onCommit = vi.fn();
    const { result, rerender } = renderHook(
      ({ v }) => useDraftValue(v, onCommit, 250),
      { initialProps: { v: 'a' } }
    );

    rerender({ v: 'external' });

    expect(result.current[0]).toBe('external');
  });

  it('does not reset the draft when the prop echoes back a committed value', () => {
    const onCommit = vi.fn();
    const { result, rerender } = renderHook(
      ({ v }) => useDraftValue(v, onCommit, 250),
      { initialProps: { v: 'a' } }
    );

    // Type and commit -> parent will echo the same value back on next render.
    act(() => {
      result.current[1]('typed');
    });
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(onCommit).toHaveBeenCalledWith('typed');

    // Keep typing further; the draft is now ahead of the echoed prop.
    act(() => {
      result.current[1]('typed-more');
    });
    // Parent echoes the previously committed value ('typed'), which equals
    // lastCommitted -> must NOT clobber the newer draft.
    rerender({ v: 'typed' });

    expect(result.current[0]).toBe('typed-more');
  });

  // Issue 2-6 regression: while the user is mid-edit (draft diverged, debounce
  // pending), an external `documentChanged` updates the prop. The external value
  // must be adopted, and a later blur (flush) must NOT re-commit the abandoned
  // draft over the external change.
  it('adopts an external change mid-edit and flush() does not clobber it', () => {
    const onCommit = vi.fn();
    const { result, rerender } = renderHook(
      ({ v }) => useDraftValue(v, onCommit, 250),
      { initialProps: { v: 'a' } }
    );

    act(() => {
      result.current[1]('user typing'); // diverged draft + pending timer
    });

    // External documentChanged arrives before the user finished.
    rerender({ v: 'external update' });
    expect(result.current[0]).toBe('external update');

    // Blur commits the current draft, which now equals the adopted external
    // value -> no commit of the abandoned 'user typing' draft.
    act(() => {
      result.current[2](); // flush
    });

    expect(onCommit).not.toHaveBeenCalledWith('user typing');
    expect(result.current[0]).toBe('external update');
  });

  it('does not commit a stale draft after an external adoption (timer self-heals)', () => {
    const onCommit = vi.fn();
    const { result, rerender } = renderHook(
      ({ v }) => useDraftValue(v, onCommit, 250),
      { initialProps: { v: 'a' } }
    );

    act(() => {
      result.current[1]('stale'); // schedules a commit for 'stale'
    });
    // External mutation arrives before the timer fires.
    rerender({ v: 'external' });
    expect(result.current[0]).toBe('external');

    act(() => {
      vi.advanceTimersByTime(250);
    });

    // The leftover timer must be a no-op: it must NOT commit the stale draft.
    expect(onCommit).not.toHaveBeenCalledWith('stale');
  });
});
