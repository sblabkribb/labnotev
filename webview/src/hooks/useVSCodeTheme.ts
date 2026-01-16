import { useState, useEffect } from 'react';

export type VSCodeTheme = 'light' | 'dark';

/**
 * Hook to detect VSCode theme (light/dark)
 * VSCode adds vscode-light or vscode-dark class to body
 */
export function useVSCodeTheme(): VSCodeTheme {
  const [theme, setTheme] = useState<VSCodeTheme>(() => {
    return document.body.classList.contains('vscode-light') ? 'light' : 'dark';
  });

  useEffect(() => {
    // Create a mutation observer to watch for class changes on body
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const isLight = document.body.classList.contains('vscode-light');
          setTheme(isLight ? 'light' : 'dark');
        }
      });
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return theme;
}
