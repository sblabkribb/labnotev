import * as path from 'path';
import { mockVscode } from './setup';

vi.mock('vscode', () => mockVscode);

// Spy on writeFileSync while keeping the rest of fs real.
const writeFileSync = vi.fn();
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return { ...actual, default: actual, writeFileSync };
});

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

describe('SectionEditorProvider.writeChangedWorkflows path guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes a linked workflow whose relative link stays inside the document folder', async () => {
    const provider = await makeProvider();

    provider.writeChangedWorkflows(document, [
      { link: '001_WD010_design.labnote.md', workflow: {} },
    ]);

    expect(writeFileSync).toHaveBeenCalledTimes(1);
    expect(writeFileSync.mock.calls[0][0]).toBe(
      path.join(docDir, '001_WD010_design.labnote.md')
    );
  });

  it('does NOT write when the link escapes the document folder (path traversal)', async () => {
    const provider = await makeProvider();

    provider.writeChangedWorkflows(document, [
      { link: '../../etc/evil.md', workflow: {} },
      { link: path.resolve('/etc/passwd'), workflow: {} },
    ]);

    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('skips only the malicious entries while writing the safe ones', async () => {
    const provider = await makeProvider();

    provider.writeChangedWorkflows(document, [
      { link: '../evil.md', workflow: {} },
      { link: 'sub/ok.labnote.md', workflow: {} },
    ]);

    expect(writeFileSync).toHaveBeenCalledTimes(1);
    expect(writeFileSync.mock.calls[0][0]).toBe(path.join(docDir, 'sub', 'ok.labnote.md'));
  });
});
