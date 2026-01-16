import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockVscode } from './setup';

// Import after mocking
import { LabNoteEditorProvider } from '../labNoteEditorProvider';

describe('LabNoteEditorProvider', () => {
  let provider: LabNoteEditorProvider;
  let mockContext: {
    extensionUri: { fsPath: string };
    subscriptions: Array<{ dispose: () => void }>;
  };

  beforeEach(() => {
    mockContext = {
      extensionUri: {
        fsPath: '/test/extension',
      },
      subscriptions: [],
    };
    provider = new LabNoteEditorProvider(mockContext as unknown as Parameters<typeof LabNoteEditorProvider.prototype.resolveCustomTextEditor>[0]['context'] & { extensionUri: { fsPath: string }; subscriptions: Array<{ dispose: () => void }> });
  });

  describe('viewType', () => {
    it('should have correct view type', () => {
      expect(LabNoteEditorProvider.viewType).toBe('labnotevis.editor');
    });
  });

  describe('resolveCustomTextEditor', () => {
    let mockDocument: {
      getText: () => string;
      uri: { fsPath: string; toString: () => string };
      lineCount: number;
    };
    let mockWebviewPanel: {
      webview: {
        options: unknown;
        html: string;
        postMessage: ReturnType<typeof vi.fn>;
        onDidReceiveMessage: ReturnType<typeof vi.fn>;
        asWebviewUri: ReturnType<typeof vi.fn>;
        cspSource: string;
      };
      onDidDispose: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockDocument = {
        getText: vi.fn(() => '# Test Document'),
        uri: {
          fsPath: '/test/workspace/test.labnote.md',
          toString: () => 'file:///test/workspace/test.labnote.md',
        },
        lineCount: 1,
      };

      mockWebviewPanel = {
        webview: {
          options: {},
          html: '',
          postMessage: vi.fn(),
          onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
          asWebviewUri: vi.fn((uri) => `vscode-webview://${uri.fsPath}`),
          cspSource: 'vscode-webview:',
        },
        onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
      };
    });

    it('should set webview options with enableScripts', async () => {
      await provider.resolveCustomTextEditor(
        mockDocument as unknown as Parameters<typeof provider.resolveCustomTextEditor>[0],
        mockWebviewPanel as unknown as Parameters<typeof provider.resolveCustomTextEditor>[1],
        { isCancellationRequested: false, onCancellationRequested: vi.fn() }
      );

      expect(mockWebviewPanel.webview.options).toEqual(
        expect.objectContaining({
          enableScripts: true,
        })
      );
    });

    it('should set webview HTML content', async () => {
      await provider.resolveCustomTextEditor(
        mockDocument as unknown as Parameters<typeof provider.resolveCustomTextEditor>[0],
        mockWebviewPanel as unknown as Parameters<typeof provider.resolveCustomTextEditor>[1],
        { isCancellationRequested: false, onCancellationRequested: vi.fn() }
      );

      expect(mockWebviewPanel.webview.html).toContain('<!DOCTYPE html>');
      expect(mockWebviewPanel.webview.html).toContain('<div id="root"></div>');
    });

    it('should include Content-Security-Policy', async () => {
      await provider.resolveCustomTextEditor(
        mockDocument as unknown as Parameters<typeof provider.resolveCustomTextEditor>[0],
        mockWebviewPanel as unknown as Parameters<typeof provider.resolveCustomTextEditor>[1],
        { isCancellationRequested: false, onCancellationRequested: vi.fn() }
      );

      expect(mockWebviewPanel.webview.html).toContain('Content-Security-Policy');
    });

    it('should register message handler', async () => {
      await provider.resolveCustomTextEditor(
        mockDocument as unknown as Parameters<typeof provider.resolveCustomTextEditor>[0],
        mockWebviewPanel as unknown as Parameters<typeof provider.resolveCustomTextEditor>[1],
        { isCancellationRequested: false, onCancellationRequested: vi.fn() }
      );

      expect(mockWebviewPanel.webview.onDidReceiveMessage).toHaveBeenCalled();
    });

    it('should register dispose handler', async () => {
      await provider.resolveCustomTextEditor(
        mockDocument as unknown as Parameters<typeof provider.resolveCustomTextEditor>[0],
        mockWebviewPanel as unknown as Parameters<typeof provider.resolveCustomTextEditor>[1],
        { isCancellationRequested: false, onCancellationRequested: vi.fn() }
      );

      expect(mockWebviewPanel.onDidDispose).toHaveBeenCalled();
    });

    describe('message handling', () => {
      it('should send update message on ready', async () => {
        let messageHandler: (message: { type: string }) => void;
        mockWebviewPanel.webview.onDidReceiveMessage.mockImplementation((handler: typeof messageHandler) => {
          messageHandler = handler;
          return { dispose: vi.fn() };
        });

        await provider.resolveCustomTextEditor(
          mockDocument as unknown as Parameters<typeof provider.resolveCustomTextEditor>[0],
          mockWebviewPanel as unknown as Parameters<typeof provider.resolveCustomTextEditor>[1],
          { isCancellationRequested: false, onCancellationRequested: vi.fn() }
        );

        messageHandler!({ type: 'ready' });

        expect(mockWebviewPanel.webview.postMessage).toHaveBeenCalledWith({
          type: 'update',
          content: '# Test Document',
          documentUri: 'file:///test/workspace/test.labnote.md',
        });
      });

      it('should handle save message', async () => {
        let messageHandler: (message: { type: string; content?: string }) => Promise<void>;
        mockWebviewPanel.webview.onDidReceiveMessage.mockImplementation((handler: typeof messageHandler) => {
          messageHandler = handler;
          return { dispose: vi.fn() };
        });

        await provider.resolveCustomTextEditor(
          mockDocument as unknown as Parameters<typeof provider.resolveCustomTextEditor>[0],
          mockWebviewPanel as unknown as Parameters<typeof provider.resolveCustomTextEditor>[1],
          { isCancellationRequested: false, onCancellationRequested: vi.fn() }
        );

        await messageHandler!({ type: 'save', content: '# Updated Content' });

        expect(mockVscode.workspace.applyEdit).toHaveBeenCalled();
      });

      it('should handle saveImage message', async () => {
        let messageHandler: (message: { type: string; data?: string; filename?: string }) => Promise<void>;
        mockWebviewPanel.webview.onDidReceiveMessage.mockImplementation((handler: typeof messageHandler) => {
          messageHandler = handler;
          return { dispose: vi.fn() };
        });

        mockVscode.workspace.fs.stat.mockRejectedValue(new Error('Not found'));

        await provider.resolveCustomTextEditor(
          mockDocument as unknown as Parameters<typeof provider.resolveCustomTextEditor>[0],
          mockWebviewPanel as unknown as Parameters<typeof provider.resolveCustomTextEditor>[1],
          { isCancellationRequested: false, onCancellationRequested: vi.fn() }
        );

        await messageHandler!({
          type: 'saveImage',
          data: 'base64data',
          filename: 'test.png',
        });

        expect(mockVscode.workspace.fs.createDirectory).toHaveBeenCalled();
        expect(mockVscode.workspace.fs.writeFile).toHaveBeenCalled();
      });

      it('should handle getAssetUri message', async () => {
        let messageHandler: (message: { type: string; relativePath?: string; requestId?: string }) => Promise<void>;
        mockWebviewPanel.webview.onDidReceiveMessage.mockImplementation((handler: typeof messageHandler) => {
          messageHandler = handler;
          return { dispose: vi.fn() };
        });

        await provider.resolveCustomTextEditor(
          mockDocument as unknown as Parameters<typeof provider.resolveCustomTextEditor>[0],
          mockWebviewPanel as unknown as Parameters<typeof provider.resolveCustomTextEditor>[1],
          { isCancellationRequested: false, onCancellationRequested: vi.fn() }
        );

        await messageHandler!({
          type: 'getAssetUri',
          relativePath: './assets/test.png',
          requestId: 'req123',
        });

        expect(mockWebviewPanel.webview.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'assetUri',
            requestId: 'req123',
          })
        );
      });
    });
  });
});
