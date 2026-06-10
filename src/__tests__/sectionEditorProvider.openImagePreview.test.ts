import * as path from 'path';
import { mockVscode } from './setup';

vi.mock('vscode', () => mockVscode);

/**
 * Regression for the Section Editor -> image preview path. The webview posts
 * an `openImagePreview` message; the provider must forward it to the
 * `labnotev.openImagePreview` command using the SAME argument contract the
 * markdown ImageLinkProvider uses: `{ imagePath: string; altText: string }`.
 *
 * Previously the provider passed a raw `vscode.Uri`, so the command handler
 * (which reads `args.imagePath`) silently no-op'd.
 */

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
  return { panel, send: (msg: unknown) => messageHandler(msg) };
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
  } as any;
  const { panel, send } = makePanel();
  await provider.resolveCustomTextEditor(document, panel as any, {} as any);
  return { provider, send };
}

describe('SectionEditorProvider openImagePreview message', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards a string imagePath + altText to the openImagePreview command', async () => {
    const { send } = await setupProvider();

    await send({ type: 'openImagePreview', data: { imagePath: 'images/cell.png' } });

    const call = (mockVscode.commands.executeCommand as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === 'labnotev.openImagePreview'
    );
    expect(call).toBeDefined();
    const args = call![1] as { imagePath: unknown; altText: unknown };
    expect(typeof args.imagePath).toBe('string');
    expect(args.imagePath).toContain(path.join(docDir, 'images', 'cell.png'));
    expect(args.altText).toBe('');
  });

  it('does not forward when the image path escapes the document folder', async () => {
    const { send } = await setupProvider();

    await send({ type: 'openImagePreview', data: { imagePath: '../../etc/passwd' } });

    const call = (mockVscode.commands.executeCommand as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === 'labnotev.openImagePreview'
    );
    expect(call).toBeUndefined();
  });
});
