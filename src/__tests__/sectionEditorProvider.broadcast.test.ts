import { mockVscode } from './setup';

/**
 * Lightweight regression tests for `SectionEditorProvider._allEditors`
 * lifecycle and `broadcastSampleDefsUpdated()` fan-out.
 *
 * The full `resolveCustomTextEditor` flow sets up the webview HTML and many
 * event listeners, which is too heavy to wire up here. We inject editor
 * entries directly into the private `_allEditors` set to verify only the
 * surface that v0.55.0 added.
 */
describe('SectionEditorProvider broadcastSampleDefsUpdated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts a sampleDefsUpdated message to every tracked editor', async () => {
    const { SectionEditorProvider } = await import('../sectionEditorProvider');
    const ctx = {
      subscriptions: [],
      extensionUri: { fsPath: '/test' },
      extensionPath: '/test',
    } as any;
    const provider = new SectionEditorProvider(ctx);

    const makeEditor = (uri: string) => ({
      document: {
        uri: {
          toString: () => uri,
          fsPath: uri.replace('file://', ''),
        },
      },
      webviewPanel: {
        webview: { postMessage: vi.fn() },
      },
      mode: 'labnote',
    });
    const a = makeEditor('file:///a.labnote.md');
    const b = makeEditor('file:///b.labnote.md');
    (provider as any)._allEditors.add(a);
    (provider as any)._allEditors.add(b);

    provider.broadcastSampleDefsUpdated();

    expect(a.webviewPanel.webview.postMessage).toHaveBeenCalledTimes(1);
    expect(b.webviewPanel.webview.postMessage).toHaveBeenCalledTimes(1);
    const sentToA = (a.webviewPanel.webview.postMessage as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sentToA.type).toBe('sampleDefsUpdated');
    expect(sentToA.data).toHaveProperty('sampleDefs');
  });

  it('is a safe no-op when no editors are tracked', async () => {
    const { SectionEditorProvider } = await import('../sectionEditorProvider');
    const ctx = {
      subscriptions: [],
      extensionUri: { fsPath: '/test' },
      extensionPath: '/test',
    } as any;
    const provider = new SectionEditorProvider(ctx);
    expect(() => provider.broadcastSampleDefsUpdated()).not.toThrow();
  });

  it('skips an editor that has been removed from _allEditors', async () => {
    const { SectionEditorProvider } = await import('../sectionEditorProvider');
    const ctx = {
      subscriptions: [],
      extensionUri: { fsPath: '/test' },
      extensionPath: '/test',
    } as any;
    const provider = new SectionEditorProvider(ctx);

    const editor = {
      document: { uri: { toString: () => 'file:///c.labnote.md', fsPath: '/c.labnote.md' } },
      webviewPanel: { webview: { postMessage: vi.fn() } },
      mode: 'labnote',
    };
    (provider as any)._allEditors.add(editor);
    (provider as any)._allEditors.delete(editor);

    provider.broadcastSampleDefsUpdated();
    expect(editor.webviewPanel.webview.postMessage).not.toHaveBeenCalled();
  });

  // Reference mockVscode so the import isn't tree-shaken even though we
  // rely on the global mock applied by `setup.ts`.
  void mockVscode;
});
