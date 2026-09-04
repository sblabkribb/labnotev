import { describe, it, expect } from 'vitest';
import { CORE_VERSION } from '../index';

describe('@labnotev/core smoke', () => {
  it('is importable and exposes a version', () => {
    expect(typeof CORE_VERSION).toBe('string');
    expect(CORE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('runs in the core vitest project without the vscode mock', async () => {
    // The core project registers no setupFiles, so the extension's
    // vi.mock('vscode') is never loaded and resolving it must fail.
    await expect(import('vscode')).rejects.toBeTruthy();
  });
});
