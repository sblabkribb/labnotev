import { mockVscode } from './setup';
import { createDebouncedLabsamplesHandler } from '../extension';

// Reference mockVscode so the import is preserved even though this test only
// drives the pure debounce helper (the global vscode mock is still applied
// via setup.ts).
void mockVscode;

/**
 * `createDebouncedLabsamplesHandler` is the rendezvous for the labsamples
 * JSON FileSystemWatcher events. Even when VS Code fires
 * `onDidChange` / `onDidCreate` / `onDidDelete` back-to-back (e.g. after a
 * `git pull` lands several files in the same tick), the user should see
 * exactly one TreeView refresh and one webview broadcast.
 */
describe('createDebouncedLabsamplesHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('collapses a burst of events into a single refresh + broadcast', () => {
    const refresh = vi.fn();
    const broadcast = vi.fn();
    const handler = createDebouncedLabsamplesHandler(refresh, broadcast, 100);

    handler();
    handler();
    handler();
    expect(refresh).not.toHaveBeenCalled();
    expect(broadcast).not.toHaveBeenCalled();

    vi.advanceTimersByTime(99);
    expect(refresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(broadcast).toHaveBeenCalledTimes(1);
  });

  it('fires once per quiescent window', () => {
    const refresh = vi.fn();
    const broadcast = vi.fn();
    const handler = createDebouncedLabsamplesHandler(refresh, broadcast, 100);

    handler();
    vi.advanceTimersByTime(100);
    expect(refresh).toHaveBeenCalledTimes(1);

    handler();
    handler();
    vi.advanceTimersByTime(100);
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(broadcast).toHaveBeenCalledTimes(2);
  });

  it('uses the supplied delay value', () => {
    const refresh = vi.fn();
    const broadcast = vi.fn();
    const handler = createDebouncedLabsamplesHandler(refresh, broadcast, 250);

    handler();
    vi.advanceTimersByTime(100);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(150);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(broadcast).toHaveBeenCalledTimes(1);
  });
});
