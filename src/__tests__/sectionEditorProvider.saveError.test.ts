import * as path from 'path';
import { mockVscode } from './setup';

vi.mock('vscode', () => mockVscode);

const docDir = path.resolve('/workspace/exp01');

function makePanel() {
  let messageHandler: (msg: unknown) => unknown = () => undefined;
  const postMessage = vi.fn();
  const panel = {
    webview: {
      options: {},
      html: '',
      asWebviewUri: vi.fn((u: { fsPath: string }) => ({ toString: () => `webview://${u.fsPath}` })),
      cspSource: 'vscode-webview://test',
      onDidReceiveMessage: vi.fn((h: (msg: unknown) => unknown) => {
        messageHandler = h;
        return { dispose: vi.fn() };
      }),
      postMessage,
    },
    active: true,
    onDidChangeViewState: vi.fn(() => ({ dispose: vi.fn() })),
    onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
  };
  return { panel, send: (msg: unknown) => messageHandler(msg), postMessage };
}

async function setupProvider() {
  const { SectionEditorProvider } = await import('../sectionEditorProvider');
  const ctx = { subscriptions: [], extensionUri: { fsPath: '/test' }, extensionPath: '/test' } as any;
  const provider = new SectionEditorProvider(ctx);
  const document = {
    uri: {
      fsPath: path.join(docDir, 'README.labnote.md'),
      toString: () => `file://${path.join(docDir, 'README.labnote.md')}`,
    },
    getText: () => '---\nexperiment_type: labnote\n---\n',
    positionAt: (o: number) => ({ line: 0, character: o }),
    save: vi.fn(() => Promise.resolve(true)),
  } as any;
  const captured = makePanel();
  await provider.resolveCustomTextEditor(document, captured.panel as any, {} as any);
  return captured;
}

describe('SectionEditorProvider save error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts saveFailed (not saveCompleted) and surfaces an error when the save throws', async () => {
    mockVscode.workspace.applyEdit.mockRejectedValueOnce(new Error('disk full'));
    const { send, postMessage } = await setupProvider();

    await send({ type: 'save', data: { labNote: { frontMatter: {}, sections: [] } } });

    const types = postMessage.mock.calls.map((c) => (c[0] as any)?.type);
    expect(types).toContain('saveFailed');
    expect(types).not.toContain('saveCompleted');
    expect(mockVscode.window.showErrorMessage).toHaveBeenCalled();
  });

  it('posts saveCompleted on a successful save', async () => {
    const { send, postMessage } = await setupProvider();

    await send({ type: 'save', data: { labNote: { frontMatter: {}, sections: [] } } });

    const types = postMessage.mock.calls.map((c) => (c[0] as any)?.type);
    expect(types).toContain('saveCompleted');
    expect(types).not.toContain('saveFailed');
  });
});
