import '@testing-library/jest-dom/vitest';

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
