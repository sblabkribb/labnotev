import * as path from 'path';
import { mockVscode } from './setup';

vi.mock('vscode', () => mockVscode);

// Spy on the fs calls sendInitMessage uses to load linked workflow files.
const readFileSync = vi.fn(() => '---\nexperimenter: x\n---\n');
const existsSync = vi.fn(() => true);
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return { ...actual, default: actual, readFileSync, existsSync };
});

const docDir = path.resolve('/workspace/exp01');

function makePanel() {
  const postMessage = vi.fn();
  return {
    panel: {
      webview: {
        asWebviewUri: vi.fn((u: { fsPath: string }) => ({ toString: () => `webview://${u.fsPath}` })),
        postMessage,
      },
    },
    postMessage,
  };
}

const LABNOTE = `---
title: Exp
experiment_type: labnote
---

## 🗂️ Related Workflows

[ ] [Safe WF](./safe.labnote.md)
[x] [Evil WF](../../../etc/evil.labnote.md)
`;

describe('SectionEditorProvider.sendInitMessage linked workflow path guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads only links that stay inside the document folder', async () => {
    const { SectionEditorProvider } = await import('../sectionEditorProvider');
    const ctx = { subscriptions: [], extensionUri: { fsPath: '/test' }, extensionPath: '/test' } as any;
    const provider = new SectionEditorProvider(ctx) as any;

    const document = {
      uri: {
        fsPath: path.join(docDir, 'README.labnote.md'),
        toString: () => `file://${path.join(docDir, 'README.labnote.md')}`,
      },
      getText: () => LABNOTE,
    };
    const { panel, postMessage } = makePanel();

    await provider.sendInitMessage(document, panel, 'labnote');

    // The escaping link must never be read from disk.
    const readPaths = readFileSync.mock.calls.map((c) => String((c as unknown[])[0]));
    expect(readPaths.some((p) => p.includes('etc'))).toBe(false);
    expect(readPaths.some((p) => p === path.join(docDir, 'safe.labnote.md'))).toBe(true);

    const initCall = postMessage.mock.calls.find((c) => (c[0] as any)?.type === 'init');
    expect(initCall).toBeDefined();
    expect((initCall![0] as any).data.linkedWorkflows).toHaveLength(1);
  });
});
