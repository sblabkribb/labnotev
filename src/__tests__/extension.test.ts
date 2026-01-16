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

    it('should register newNote command', () => {
      activate(mockContext as unknown as Parameters<typeof activate>[0]);

      expect(mockVscode.commands.registerCommand).toHaveBeenCalledWith(
        'labnotevis.newNote',
        expect.any(Function)
      );
    });

    it('should add subscriptions to context', () => {
      activate(mockContext as unknown as Parameters<typeof activate>[0]);

      expect(mockContext.subscriptions.length).toBeGreaterThan(0);
    });
  });

  describe('newNote command', () => {
    it('should show error when no workspace folder', async () => {
      const originalWorkspaceFolders = mockVscode.workspace.workspaceFolders;
      mockVscode.workspace.workspaceFolders = undefined as unknown as typeof originalWorkspaceFolders;

      activate(mockContext as unknown as Parameters<typeof activate>[0]);

      // Get the registered command handler
      const commandCall = mockVscode.commands.registerCommand.mock.calls.find(
        (call) => call[0] === 'labnotevis.newNote'
      );
      const commandHandler = commandCall?.[1] as () => Promise<void>;

      await commandHandler();

      expect(mockVscode.window.showErrorMessage).toHaveBeenCalledWith(
        'Please open a folder first'
      );

      mockVscode.workspace.workspaceFolders = originalWorkspaceFolders;
    });

    it('should prompt for file name', async () => {
      mockVscode.window.showInputBox.mockResolvedValue('my-note');

      activate(mockContext as unknown as Parameters<typeof activate>[0]);

      const commandCall = mockVscode.commands.registerCommand.mock.calls.find(
        (call) => call[0] === 'labnotevis.newNote'
      );
      const commandHandler = commandCall?.[1] as () => Promise<void>;

      await commandHandler();

      expect(mockVscode.window.showInputBox).toHaveBeenCalledWith({
        prompt: 'Enter note name',
        placeHolder: 'my-note',
      });
    });

    it('should create file and open editor when name provided', async () => {
      mockVscode.window.showInputBox.mockResolvedValue('test-note');

      activate(mockContext as unknown as Parameters<typeof activate>[0]);

      const commandCall = mockVscode.commands.registerCommand.mock.calls.find(
        (call) => call[0] === 'labnotevis.newNote'
      );
      const commandHandler = commandCall?.[1] as () => Promise<void>;

      await commandHandler();

      expect(mockVscode.workspace.fs.writeFile).toHaveBeenCalled();
      expect(mockVscode.commands.executeCommand).toHaveBeenCalledWith(
        'vscode.openWith',
        expect.anything(),
        LabNoteEditorProvider.viewType
      );
    });

    it('should not create file when user cancels', async () => {
      mockVscode.window.showInputBox.mockResolvedValue(undefined);

      activate(mockContext as unknown as Parameters<typeof activate>[0]);

      const commandCall = mockVscode.commands.registerCommand.mock.calls.find(
        (call) => call[0] === 'labnotevis.newNote'
      );
      const commandHandler = commandCall?.[1] as () => Promise<void>;

      await commandHandler();

      expect(mockVscode.workspace.fs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('should exist and be callable', () => {
      expect(deactivate).toBeDefined();
      expect(() => deactivate()).not.toThrow();
    });
  });
});
