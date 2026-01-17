import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockVscode } from './setup';

// We will test the command handlers through the extension activation
// Import after mocking
import { activate } from '../extension';

describe('Labnote Commands', () => {
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

  describe('labnotev.insertDate command', () => {
    it('should be registered', () => {
      activate(mockContext as unknown as Parameters<typeof activate>[0]);

      expect(mockVscode.commands.registerCommand).toHaveBeenCalledWith(
        'labnotev.insertDate',
        expect.any(Function)
      );
    });

    it('should show warning when no active editor', async () => {
      const originalActiveEditor = mockVscode.window.activeTextEditor;
      mockVscode.window.activeTextEditor = undefined;

      activate(mockContext as unknown as Parameters<typeof activate>[0]);

      const commandCall = mockVscode.commands.registerCommand.mock.calls.find(
        (call) => call[0] === 'labnotev.insertDate'
      );
      const commandHandler = commandCall?.[1] as () => Promise<void>;

      await commandHandler();

      expect(mockVscode.window.showWarningMessage).toHaveBeenCalledWith(
        'No active editor'
      );

      mockVscode.window.activeTextEditor = originalActiveEditor;
    });

    it('should insert date at cursor position', async () => {
      const mockEdit = vi.fn().mockResolvedValue(true);
      const mockEditor = {
        document: {
          languageId: 'markdown',
        },
        selection: {
          active: { line: 0, character: 0 },
        },
        edit: mockEdit,
      };
      mockVscode.window.activeTextEditor = mockEditor;

      activate(mockContext as unknown as Parameters<typeof activate>[0]);

      const commandCall = mockVscode.commands.registerCommand.mock.calls.find(
        (call) => call[0] === 'labnotev.insertDate'
      );
      const commandHandler = commandCall?.[1] as () => Promise<void>;

      await commandHandler();

      expect(mockEdit).toHaveBeenCalled();
    });
  });

  describe('labnotev.insertDateTime command', () => {
    it('should be registered', () => {
      activate(mockContext as unknown as Parameters<typeof activate>[0]);

      expect(mockVscode.commands.registerCommand).toHaveBeenCalledWith(
        'labnotev.insertDateTime',
        expect.any(Function)
      );
    });

    it('should show warning when no active editor', async () => {
      const originalActiveEditor = mockVscode.window.activeTextEditor;
      mockVscode.window.activeTextEditor = undefined;

      activate(mockContext as unknown as Parameters<typeof activate>[0]);

      const commandCall = mockVscode.commands.registerCommand.mock.calls.find(
        (call) => call[0] === 'labnotev.insertDateTime'
      );
      const commandHandler = commandCall?.[1] as () => Promise<void>;

      await commandHandler();

      expect(mockVscode.window.showWarningMessage).toHaveBeenCalledWith(
        'No active editor'
      );

      mockVscode.window.activeTextEditor = originalActiveEditor;
    });

    it('should insert datetime at cursor position', async () => {
      const mockEdit = vi.fn().mockResolvedValue(true);
      const mockEditor = {
        document: {
          languageId: 'markdown',
        },
        selection: {
          active: { line: 0, character: 0 },
        },
        edit: mockEdit,
      };
      mockVscode.window.activeTextEditor = mockEditor;

      activate(mockContext as unknown as Parameters<typeof activate>[0]);

      const commandCall = mockVscode.commands.registerCommand.mock.calls.find(
        (call) => call[0] === 'labnotev.insertDateTime'
      );
      const commandHandler = commandCall?.[1] as () => Promise<void>;

      await commandHandler();

      expect(mockEdit).toHaveBeenCalled();
    });
  });

  describe('labnotev.updateDateField command', () => {
    it('should be registered', () => {
      activate(mockContext as unknown as Parameters<typeof activate>[0]);

      expect(mockVscode.commands.registerCommand).toHaveBeenCalledWith(
        'labnotev.updateDateField',
        expect.any(Function)
      );
    });

    it('should show warning when no active editor', async () => {
      const originalActiveEditor = mockVscode.window.activeTextEditor;
      mockVscode.window.activeTextEditor = undefined;

      activate(mockContext as unknown as Parameters<typeof activate>[0]);

      const commandCall = mockVscode.commands.registerCommand.mock.calls.find(
        (call) => call[0] === 'labnotev.updateDateField'
      );
      const commandHandler = commandCall?.[1] as () => Promise<void>;

      await commandHandler();

      expect(mockVscode.window.showWarningMessage).toHaveBeenCalledWith(
        'No active editor'
      );

      mockVscode.window.activeTextEditor = originalActiveEditor;
    });

    it('should update date field on current line', async () => {
      const mockEdit = vi.fn().mockResolvedValue(true);
      const mockLine = {
        text: "last_updated_date: '2025-01-15'",
        range: { start: { line: 2, character: 0 }, end: { line: 2, character: 30 } },
      };
      const mockEditor = {
        document: {
          languageId: 'markdown',
          lineAt: vi.fn().mockReturnValue(mockLine),
        },
        selection: {
          active: { line: 2, character: 0 },
        },
        edit: mockEdit,
      };
      mockVscode.window.activeTextEditor = mockEditor;

      activate(mockContext as unknown as Parameters<typeof activate>[0]);

      const commandCall = mockVscode.commands.registerCommand.mock.calls.find(
        (call) => call[0] === 'labnotev.updateDateField'
      );
      const commandHandler = commandCall?.[1] as () => Promise<void>;

      await commandHandler();

      expect(mockEdit).toHaveBeenCalled();
    });

    it('should show warning when no date field found', async () => {
      const mockEdit = vi.fn().mockResolvedValue(true);
      const mockLine = {
        text: 'Some text without date',
        range: { start: { line: 2, character: 0 }, end: { line: 2, character: 22 } },
      };
      const mockEditor = {
        document: {
          languageId: 'markdown',
          lineAt: vi.fn().mockReturnValue(mockLine),
        },
        selection: {
          active: { line: 2, character: 0 },
        },
        edit: mockEdit,
      };
      mockVscode.window.activeTextEditor = mockEditor;

      activate(mockContext as unknown as Parameters<typeof activate>[0]);

      const commandCall = mockVscode.commands.registerCommand.mock.calls.find(
        (call) => call[0] === 'labnotev.updateDateField'
      );
      const commandHandler = commandCall?.[1] as () => Promise<void>;

      await commandHandler();

      expect(mockVscode.window.showWarningMessage).toHaveBeenCalledWith(
        'No date field or date pattern found on current line'
      );
    });
  });

  describe('labnotev.updateAllDateFields command', () => {
    it('should be registered', () => {
      activate(mockContext as unknown as Parameters<typeof activate>[0]);

      expect(mockVscode.commands.registerCommand).toHaveBeenCalledWith(
        'labnotev.updateAllDateFields',
        expect.any(Function)
      );
    });
  });
});
