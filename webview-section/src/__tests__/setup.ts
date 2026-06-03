import * as matchers from '@testing-library/jest-dom/matchers';

// vitest 4 loads externalized setup files under a different module instance of
// `vitest`, so jest-dom's own `import { expect } from 'vitest'; expect.extend()`
// (via '@testing-library/jest-dom/vitest') registers matchers on an `expect`
// that is NOT the runner's global `expect` used by tests — producing
// "Invalid Chai property: toBeInTheDocument". Extend the global `expect`
// directly so the matchers land on the instance the tests actually use.
(globalThis as unknown as { expect: { extend: (m: unknown) => void } }).expect.extend(matchers);

// Mock window.matchMedia (required by Mantine)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver (required by Mantine)
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
(globalThis as any).ResizeObserver = ResizeObserverMock;

// Mock VS Code API
const mockVsCodeApi = {
  postMessage: vi.fn(),
  getState: vi.fn().mockReturnValue(undefined),
  setState: vi.fn(),
};

(globalThis as any).acquireVsCodeApi = vi.fn().mockReturnValue(mockVsCodeApi);
