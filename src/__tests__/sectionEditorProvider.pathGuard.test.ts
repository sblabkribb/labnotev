import * as path from 'path';
import { mockVscode } from './setup';

vi.mock('vscode', () => mockVscode);

// serializeWorkflowMd is exercised elsewhere; stub it so this test focuses on
// the path-containment guard rather than markdown serialization.
vi.mock('../lib/workflowSectionParser', async () => {
  const actual = await vi.importActual<typeof import('../lib/workflowSectionParser')>(
    '../lib/workflowSectionParser'
  );
  return { ...actual, serializeWorkflowMd: vi.fn(() => 'SERIALIZED') };
});

async function makeProvider() {
  const { SectionEditorProvider } = await import('../sectionEditorProvider');
  const ctx = { subscriptions: [], extensionUri: { fsPath: '/test' }, extensionPath: '/test' } as any;
  return new SectionEditorProvider(ctx);
}

const docDir = path.resolve('/workspace/exp01');
const document = { uri: { fsPath: path.join(docDir, 'README.labnote.md') } } as any;

function stubOpenedDoc() {
  // Each linked workflow write opens the target document; return a minimal
  // TextDocument stub whose save() we can observe.
  const save = vi.fn(() => Promise.resolve(true));
  mockVscode.workspace.openTextDocument.mockImplementation((uri: any) =>
    Promise.resolve({
      uri,
      getText: () => 'OLD',
      positionAt: (n: number) => ({ line: 0, character: n }),
      save,
    } as any)
  );
  return { save };
}

describe('SectionEditorProvider.writeChangedWorkflows path guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes a linked workflow whose relative link stays inside the document folder', async () => {
    const provider = await makeProvider();
    stubOpenedDoc();

    await provider.writeChangedWorkflows(document, [
      { link: '001_WD010_design.labnote.md', workflow: {} },
    ]);

    expect(mockVscode.workspace.openTextDocument).toHaveBeenCalledTimes(1);
    const openedUri = mockVscode.workspace.openTextDocument.mock.calls[0][0] as { fsPath: string };
    expect(openedUri.fsPath).toBe(path.join(docDir, '001_WD010_design.labnote.md'));
    expect(mockVscode.workspace.applyEdit).toHaveBeenCalledTimes(1);
  });

  it('does NOT write when the link escapes the document folder (path traversal)', async () => {
    const provider = await makeProvider();
    stubOpenedDoc();

    await provider.writeChangedWorkflows(document, [
      { link: '../../etc/evil.md', workflow: {} },
      { link: path.resolve('/etc/passwd'), workflow: {} },
    ]);

    expect(mockVscode.workspace.openTextDocument).not.toHaveBeenCalled();
    expect(mockVscode.workspace.applyEdit).not.toHaveBeenCalled();
  });

  it('skips only the malicious entries while writing the safe ones', async () => {
    const provider = await makeProvider();
    stubOpenedDoc();

    await provider.writeChangedWorkflows(document, [
      { link: '../evil.md', workflow: {} },
      { link: 'sub/ok.labnote.md', workflow: {} },
    ]);

    expect(mockVscode.workspace.openTextDocument).toHaveBeenCalledTimes(1);
    const openedUri = mockVscode.workspace.openTextDocument.mock.calls[0][0] as { fsPath: string };
    expect(openedUri.fsPath).toBe(path.join(docDir, 'sub', 'ok.labnote.md'));
    expect(mockVscode.workspace.applyEdit).toHaveBeenCalledTimes(1);
  });
});
