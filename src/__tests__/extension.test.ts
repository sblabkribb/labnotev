import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockVscode } from './setup';

// Import after mocking
import { activate, deactivate } from '../extension';

describe('Extension', () => {
  let mockContext: {
    subscriptions: Array<{ dispose: () => void }>;
    extensionUri: { fsPath: string };
    extensionPath: string;
  };

  beforeEach(() => {
    mockContext = {
      subscriptions: [],
      extensionUri: {
        fsPath: '/test/extension',
      },
      extensionPath: '/test/extension',
    };
  });

  describe('activate', () => {
    it('should register createLabnote command', async () => {
      await activate(mockContext as unknown as Parameters<typeof activate>[0]);

      expect(mockVscode.commands.registerCommand).toHaveBeenCalledWith(
        'labnotev.createLabnote',
        expect.any(Function)
      );
    });

    it('should add subscriptions to context', async () => {
      await activate(mockContext as unknown as Parameters<typeof activate>[0]);

      expect(mockContext.subscriptions.length).toBeGreaterThan(0);
    });

    it('should register Section Editor custom editor provider', async () => {
      await activate(mockContext as unknown as Parameters<typeof activate>[0]);

      expect(mockVscode.window.registerCustomEditorProvider).toHaveBeenCalledWith(
        'labnotev.sectionEditor',
        expect.any(Object),
        expect.objectContaining({
          webviewOptions: { retainContextWhenHidden: true },
        })
      );
    });
  });

  describe('deactivate', () => {
    it('should exist and be callable', () => {
      expect(deactivate).toBeDefined();
      expect(() => deactivate()).not.toThrow();
    });
  });
});
