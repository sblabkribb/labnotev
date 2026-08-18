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

async function setupProvider(initialContent: string) {
  const { SectionEditorProvider } = await import('../sectionEditorProvider');
  const ctx = { subscriptions: [], extensionUri: { fsPath: '/test' }, extensionPath: '/test' } as any;
  const provider = new SectionEditorProvider(ctx);
  const document = {
    uri: {
      fsPath: path.join(docDir, 'README.labnote.md'),
      toString: () => `file://${path.join(docDir, 'README.labnote.md')}`,
    },
    getText: () => initialContent,
    positionAt: (o: number) => ({ line: 0, character: o }),
    save: vi.fn(() => Promise.resolve(true)),
  } as any;
  const captured = makePanel();
  await provider.resolveCustomTextEditor(document, captured.panel as any, {} as any);
  return captured;
}

// Regression guard: handleSave previously stamped last_updated_date with
// `new Date().toISOString().split('T')[0]` (UTC), which drifts by a day from
// the Seoul-based dates used at creation (getSeoulDateString) and by the
// updateAllDateFields/updateDateField commands — most visibly right around
// midnight KST. Saving must use the same Seoul convention everywhere so a
// PDF export's "last updated" cover date matches what the user expects.
describe('SectionEditorProvider save date stamping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stamps labnote last_updated_date using Seoul date, not UTC', async () => {
    const { getSeoulDateString } = await import('../lib/dateUtils');
    const expected = getSeoulDateString();

    const { send } = await setupProvider('---\nexperiment_type: labnote\n---\n');

    await send({
      type: 'save',
      data: {
        labNote: {
          frontMatter: { title: 'T', author: 'A', experiment_type: 'labnote', sample_tracking: false },
          sections: [],
        },
      },
    });

    const applyEditCalls = (mockVscode.workspace.applyEdit as ReturnType<typeof vi.fn>).mock.calls;
    expect(applyEditCalls.length).toBeGreaterThan(0);
    const workspaceEdit = applyEditCalls[0][0];
    const replacedText: string = workspaceEdit.replace.mock.calls[0][2];
    expect(replacedText).toContain(`last_updated_date: ${expected}`);
  });

  it('stamps workflow last_updated_date using Seoul date, not UTC', async () => {
    const { getSeoulDateString } = await import('../lib/dateUtils');
    const expected = getSeoulDateString();

    const { send } = await setupProvider('---\ntitle: WD010 Test\nexperimenter: Tester\n---\n\n## [WD010 Test]\n');

    await send({
      type: 'save',
      data: {
        workflow: {
          frontMatter: { title: 'WD010 Test', experimenter: 'Tester', created_date: '2026-01-01', end_date: '' },
          workflowHeader: '[WD010 Test]',
          workflowDescription: '',
          unitOperations: [],
          tailContent: '',
        },
      },
    });

    const applyEditCalls = (mockVscode.workspace.applyEdit as ReturnType<typeof vi.fn>).mock.calls;
    expect(applyEditCalls.length).toBeGreaterThan(0);
    const workspaceEdit = applyEditCalls[0][0];
    const replacedText: string = workspaceEdit.replace.mock.calls[0][2];
    expect(replacedText).toContain(`last_updated_date: ${expected}`);
  });
});
