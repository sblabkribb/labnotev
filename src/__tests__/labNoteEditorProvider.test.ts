import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockVscode } from './setup';

// Mock sampleStorage module
vi.mock('../lib/sampleStorage', () => ({
  getLabsamplesFolder: vi.fn(() => '/test/workspace/resources/labsamples'),
  loadSamplesByType: vi.fn(() => ({})),
  saveSamplesByType: vi.fn(),
  SampleRecord: {},
}));

// Import after mocking
import { LabNoteEditorProvider } from '../labNoteEditorProvider';
import * as sampleStorage from '../lib/sampleStorage';

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
      expect(LabNoteEditorProvider.viewType).toBe('labnotev.editor');
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
          fsPath: '/test/workspace/test.md',
          toString: () => 'file:///test/workspace/test.md',
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
        onDidChangeViewState: vi.fn(() => ({ dispose: vi.fn() })),
        active: true,
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
          documentUri: 'file:///test/workspace/test.md',
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

      it('should handle getSamples message and return samples for type', async () => {
        let messageHandler: (message: { type: string; sampleType?: string; requestId?: string }) => Promise<void>;
        mockWebviewPanel.webview.onDidReceiveMessage.mockImplementation((handler: typeof messageHandler) => {
          messageHandler = handler;
          return { dispose: vi.fn() };
        });

        // Mock loadSamplesByType to return sample data
        vi.mocked(sampleStorage.loadSamplesByType).mockReturnValue({
          'DNA-123': { type: 'DNA', alias: '샘플A', descriptions: ['설명A'], sources: ['test.md'] },
          'DNA-456': { type: 'DNA', alias: null, descriptions: [], sources: ['test.md'] },
        });

        await provider.resolveCustomTextEditor(
          mockDocument as unknown as Parameters<typeof provider.resolveCustomTextEditor>[0],
          mockWebviewPanel as unknown as Parameters<typeof provider.resolveCustomTextEditor>[1],
          { isCancellationRequested: false, onCancellationRequested: vi.fn() }
        );

        await messageHandler!({
          type: 'getSamples',
          sampleType: 'DNA',
          requestId: 'req-samples-1',
        });

        expect(sampleStorage.loadSamplesByType).toHaveBeenCalledWith(
          '/test/workspace/resources/labsamples',
          'DNA'
        );
        expect(mockWebviewPanel.webview.postMessage).toHaveBeenCalledWith({
          type: 'samples',
          requestId: 'req-samples-1',
          samples: {
            'DNA-123': { type: 'DNA', alias: '샘플A', descriptions: ['설명A'], sources: ['test.md'] },
            'DNA-456': { type: 'DNA', alias: null, descriptions: [], sources: ['test.md'] },
          },
        });
      });

      it('should handle getSamples message with empty result when no samples', async () => {
        let messageHandler: (message: { type: string; sampleType?: string; requestId?: string }) => Promise<void>;
        mockWebviewPanel.webview.onDidReceiveMessage.mockImplementation((handler: typeof messageHandler) => {
          messageHandler = handler;
          return { dispose: vi.fn() };
        });

        // Mock loadSamplesByType to return empty object
        vi.mocked(sampleStorage.loadSamplesByType).mockReturnValue({});

        await provider.resolveCustomTextEditor(
          mockDocument as unknown as Parameters<typeof provider.resolveCustomTextEditor>[0],
          mockWebviewPanel as unknown as Parameters<typeof provider.resolveCustomTextEditor>[1],
          { isCancellationRequested: false, onCancellationRequested: vi.fn() }
        );

        await messageHandler!({
          type: 'getSamples',
          sampleType: 'RNA',
          requestId: 'req-samples-2',
        });

        expect(mockWebviewPanel.webview.postMessage).toHaveBeenCalledWith({
          type: 'samples',
          requestId: 'req-samples-2',
          samples: {},
        });
      });

      it('should handle saveSample message and save to JSON file', async () => {
        let messageHandler: (message: { 
          type: string; 
          sampleType?: string; 
          sampleId?: string;
          alias?: string | null;
          description?: string | null;
          requestId?: string 
        }) => Promise<void>;
        mockWebviewPanel.webview.onDidReceiveMessage.mockImplementation((handler: typeof messageHandler) => {
          messageHandler = handler;
          return { dispose: vi.fn() };
        });

        // Mock loadSamplesByType to return empty (new sample)
        vi.mocked(sampleStorage.loadSamplesByType).mockReturnValue({});

        await provider.resolveCustomTextEditor(
          mockDocument as unknown as Parameters<typeof provider.resolveCustomTextEditor>[0],
          mockWebviewPanel as unknown as Parameters<typeof provider.resolveCustomTextEditor>[1],
          { isCancellationRequested: false, onCancellationRequested: vi.fn() }
        );

        await messageHandler!({
          type: 'saveSample',
          sampleType: 'DNA',
          sampleId: 'DNA-789',
          alias: '새샘플',
          description: '새로운 샘플 설명',
          requestId: 'req-save-1',
        });

        // Should call saveSamplesByType with correct arguments
        expect(sampleStorage.saveSamplesByType).toHaveBeenCalledWith(
          '/test/workspace/resources/labsamples',
          'DNA',
          {
            'DNA-789': {
              type: 'DNA',
              alias: '새샘플',
              descriptions: ['새로운 샘플 설명'],
              sources: ['test.md'],
            },
          }
        );
        
        expect(mockWebviewPanel.webview.postMessage).toHaveBeenCalledWith({
          type: 'sampleSaved',
          requestId: 'req-save-1',
          success: true,
        });
      });

      it('should handle saveSample message and merge with existing samples', async () => {
        let messageHandler: (message: { 
          type: string; 
          sampleType?: string; 
          sampleId?: string;
          alias?: string | null;
          description?: string | null;
          requestId?: string 
        }) => Promise<void>;
        mockWebviewPanel.webview.onDidReceiveMessage.mockImplementation((handler: typeof messageHandler) => {
          messageHandler = handler;
          return { dispose: vi.fn() };
        });

        // Mock existing samples
        vi.mocked(sampleStorage.loadSamplesByType).mockReturnValue({
          'DNA-123': { type: 'DNA', alias: '기존샘플', descriptions: ['기존설명'], sources: ['old.md'] },
        });

        await provider.resolveCustomTextEditor(
          mockDocument as unknown as Parameters<typeof provider.resolveCustomTextEditor>[0],
          mockWebviewPanel as unknown as Parameters<typeof provider.resolveCustomTextEditor>[1],
          { isCancellationRequested: false, onCancellationRequested: vi.fn() }
        );

        await messageHandler!({
          type: 'saveSample',
          sampleType: 'DNA',
          sampleId: 'DNA-456',
          alias: '새샘플',
          description: null,
          requestId: 'req-save-2',
        });

        // Should call saveSamplesByType with merged data
        expect(sampleStorage.saveSamplesByType).toHaveBeenCalledWith(
          '/test/workspace/resources/labsamples',
          'DNA',
          expect.objectContaining({
            'DNA-123': { type: 'DNA', alias: '기존샘플', descriptions: ['기존설명'], sources: ['old.md'] },
            'DNA-456': {
              type: 'DNA',
              alias: '새샘플',
              descriptions: [],
              sources: ['test.md'],
            },
          })
        );

        expect(mockWebviewPanel.webview.postMessage).toHaveBeenCalledWith({
          type: 'sampleSaved',
          requestId: 'req-save-2',
          success: true,
        });
      });
    });
  });
});
