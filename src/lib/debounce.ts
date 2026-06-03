/**
 * Collapse a burst of calls into a single trailing invocation. Each call resets
 * the timer; once `delay` ms pass without another call, `fn` runs with the
 * arguments from the most recent call. Pure and timer-based so tests can drive
 * it with `vi.useFakeTimers`.
 */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  delay: number
): (...args: A) => void {
  let pending: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => {
      pending = undefined;
      fn(...args);
    }, delay);
  };
}
