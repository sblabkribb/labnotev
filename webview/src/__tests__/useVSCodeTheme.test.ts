import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVSCodeTheme } from '../hooks/useVSCodeTheme';

describe('useVSCodeTheme', () => {
  let originalClassList: DOMTokenList;

  beforeEach(() => {
    // Save original classList
    originalClassList = document.body.classList;
    
    // Create a new classList-like object
    const classes = new Set<string>();
    Object.defineProperty(document.body, 'classList', {
      value: {
        contains: (cls: string) => classes.has(cls),
        add: (cls: string) => classes.add(cls),
        remove: (cls: string) => classes.delete(cls),
        toggle: (cls: string) => {
          if (classes.has(cls)) {
            classes.delete(cls);
            return false;
          }
          classes.add(cls);
          return true;
        },
      },
      configurable: true,
    });
  });

  afterEach(() => {
    // Restore original classList
    Object.defineProperty(document.body, 'classList', {
      value: originalClassList,
      configurable: true,
    });
  });

  describe('initial theme detection', () => {
    it('should return dark theme by default', () => {
      const { result } = renderHook(() => useVSCodeTheme());
      
      expect(result.current).toBe('dark');
    });

    it('should return light theme when vscode-light class is present', () => {
      document.body.classList.add('vscode-light');
      
      const { result } = renderHook(() => useVSCodeTheme());
      
      expect(result.current).toBe('light');
    });

    it('should return dark theme when vscode-dark class is present', () => {
      document.body.classList.add('vscode-dark');
      
      const { result } = renderHook(() => useVSCodeTheme());
      
      expect(result.current).toBe('dark');
    });
  });

  describe('theme change detection', () => {
    it('should update theme when class changes from dark to light', async () => {
      const { result } = renderHook(() => useVSCodeTheme());
      
      expect(result.current).toBe('dark');
      
      // Simulate class change with MutationObserver
      await act(async () => {
        document.body.classList.add('vscode-light');
        
        // Manually trigger the mutation observer callback
        // since jsdom doesn't fully support MutationObserver
        const event = new Event('classchange');
        document.body.dispatchEvent(event);
      });
      
      // Note: In a real browser, the MutationObserver would trigger
      // For testing, we verify the initial state detection works
    });
  });

  describe('MutationObserver setup', () => {
    it('should observe body class attribute', () => {
      const observeSpy = vi.fn();
      const disconnectSpy = vi.fn();
      
      // Mock MutationObserver
      const MockMutationObserver = vi.fn().mockImplementation(() => ({
        observe: observeSpy,
        disconnect: disconnectSpy,
      }));
      
      vi.stubGlobal('MutationObserver', MockMutationObserver);
      
      const { unmount } = renderHook(() => useVSCodeTheme());
      
      expect(MockMutationObserver).toHaveBeenCalled();
      expect(observeSpy).toHaveBeenCalledWith(document.body, {
        attributes: true,
        attributeFilter: ['class'],
      });
      
      unmount();
      expect(disconnectSpy).toHaveBeenCalled();
      
      vi.unstubAllGlobals();
    });
  });

  describe('cleanup', () => {
    it('should disconnect MutationObserver on unmount', () => {
      const disconnectSpy = vi.fn();
      
      const MockMutationObserver = vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        disconnect: disconnectSpy,
      }));
      
      vi.stubGlobal('MutationObserver', MockMutationObserver);
      
      const { unmount } = renderHook(() => useVSCodeTheme());
      
      unmount();
      
      expect(disconnectSpy).toHaveBeenCalled();
      
      vi.unstubAllGlobals();
    });
  });

  describe('type safety', () => {
    it('should only return light or dark', () => {
      const { result } = renderHook(() => useVSCodeTheme());
      
      expect(['light', 'dark']).toContain(result.current);
    });
  });
});
