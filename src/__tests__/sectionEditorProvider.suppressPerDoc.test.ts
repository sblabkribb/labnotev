import * as path from 'path';
import { mockVscode } from './setup';

vi.mock('vscode', () => mockVscode);

/**
 * While document A is being saved, its own change events are suppressed so the
 * webview is not re-synced mid-write. That suppression must NOT leak to other
 * open documents: a change arriving for document B during A's save still has to
 * reach B's webview. A single shared boolean flag broke this; suppression is
 * tracked per-document instead.
 */

const WORKFLOW_MD = `---
title: WD010 X
experimenter: t
created_date: 2026-01-01
last_updated_date: 2026-01-01
end_date: ''
---

## [WD010 X]

> d

## Related Unit Operations
`;

function makePanel() {
  const postMessage = vi.fn();
  return {
    webview: {
      options: {},
      html: '',
      asWebviewUri: vi.fn((u: { fsPath: string }) => ({ toString: () => `webview://${u.fsPath}` })),
      cspSource: 'vscode-webview://test',
      onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
      postMessage,
    },
    active: false,
    onDidChangeViewState: vi.fn(() => ({ dispose: vi.fn() })),
    onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
  };
}

function makeDoc(name: string) {
  const fsPath = path.join(path.resolve('/workspace'), name);
  return {
    uri: { fsPath, toString: () => `file://${fsPath}` },
    getText: () => WORKFLOW_MD,
    positionAt: (o: number) => ({ line: 0, character: o }),
    save: vi.fn(() => Promise.resolve(true)),
  } as any;
}

describe('SectionEditorProvider per-document change suppression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps syncing document B while document A is mid-save', async () => {
    const { SectionEditorProvider, buildUnitOperationBlock } = await import('../sectionEditorProvider');
    const ctx = { subscriptions: [], extensionUri: { fsPath: '/test' }, extensionPath: '/test' } as any;
    const provider = new SectionEditorProvider(ctx);

    const docA = makeDoc('A.labnote.md');
    const docB = makeDoc('B.labnote.md');
    const panelA = makePanel();
    const panelB = makePanel();

    await provider.resolveCustomTextEditor(docA, panelA as any, {} as any);
    const listenerA = mockVscode.workspace.onDidChangeTextDocument.mock.calls.at(-1)![0] as (e: unknown) => void;
    await provider.resolveCustomTextEditor(docB, panelB as any, {} as any);
    const listenerB = mockVscode.workspace.onDidChangeTextDocument.mock.calls.at(-1)![0] as (e: unknown) => void;

    // Hold A's applyEdit open so the suppression window stays active.
    let resolveEdit!: () => void;
    const editPromise = new Promise<boolean>((res) => { resolveEdit = () => res(true); });
    mockVscode.workspace.applyEdit.mockReturnValueOnce(editPromise as any);

    const op = buildUnitOperationBlock('HW001', 'Op', 'd', 'hw', 't');
    const savePromise = provider.appendUnitOpToDocument(docA, op);

    // Mid-save: a change to A is suppressed, a change to B is not.
    listenerA({ document: docA, contentChanges: [{}] });
    listenerB({ document: docB, contentChanges: [{}] });

    const aDocChanged = panelA.webview.postMessage.mock.calls.some((c) => (c[0] as any)?.type === 'documentChanged');
    const bDocChanged = panelB.webview.postMessage.mock.calls.some((c) => (c[0] as any)?.type === 'documentChanged');
    expect(aDocChanged).toBe(false);
    expect(bDocChanged).toBe(true);

    resolveEdit();
    await savePromise;
  });
});
