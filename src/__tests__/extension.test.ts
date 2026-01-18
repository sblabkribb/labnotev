import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockVscode } from './setup';

// Import after mocking
import { activate, deactivate } from '../extension';
import { LabNoteEditorProvider } from '../labNoteEditorProvider';

describe('Extension', () => {
  let mockContext: {
    subscriptions: Array<{ dispose: () => void }>;
    extensionUri: { fsPath: string };
  };

  beforeEach(() => {
    mockContext = {
      subscriptions: [],
      extensionUri: {
        fsPath: '/test/extension',
      },
    };
  });

  describe('activate', () => {
    it('should register custom editor provider', () => {
      activate(mockContext as unknown as Parameters<typeof activate>[0]);

      expect(mockVscode.window.registerCustomEditorProvider).toHaveBeenCalledWith(
        LabNoteEditorProvider.viewType,
        expect.any(LabNoteEditorProvider),
        expect.objectContaining({
          webviewOptions: {
            retainContextWhenHidden: true,
          },
          supportsMultipleEditorsPerDocument: false,
        })
      );
    });

    it('should register createLabnote command', () => {
      activate(mockContext as unknown as Parameters<typeof activate>[0]);

      expect(mockVscode.commands.registerCommand).toHaveBeenCalledWith(
        'labnotev.createLabnote',
        expect.any(Function)
      );
    });

    it('should add subscriptions to context', () => {
      activate(mockContext as unknown as Parameters<typeof activate>[0]);

      expect(mockContext.subscriptions.length).toBeGreaterThan(0);
    });
  });

  describe('deactivate', () => {
    it('should exist and be callable', () => {
      expect(deactivate).toBeDefined();
      expect(() => deactivate()).not.toThrow();
    });
  });
});
