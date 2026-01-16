import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock VSCode API
const mockVSCodeApi = {
  postMessage: vi.fn(),
  getState: vi.fn(),
  setState: vi.fn(),
};

(globalThis as unknown as { acquireVsCodeApi: () => typeof mockVSCodeApi }).acquireVsCodeApi = () => mockVSCodeApi;

// Mock window.matchMedia
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

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

export { mockVSCodeApi };
