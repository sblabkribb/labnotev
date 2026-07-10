/**
 * Command-level ordering guarantees for `labnotev.deleteWorkflow`.
 *
 * Sample cleanup permanently rewrites labsample JSON, while the workflow file
 * itself only moves to the trash. If cleanup ran first and the file deletion
 * then failed, the user would be left with a still-present workflow whose
 * sample definitions had already been stripped. Cleanup must therefore run
 * only AFTER the file deletion succeeds. (Code review MEDIUM.)
 */
import { mockVscode } from './setup';

vi.mock('vscode', () => mockVscode);

const removeSourcesForDocument = vi.fn(() => [] as unknown[]);
const getGlobalLabsamplesFolder = vi.fn(() => '/test/workspace/labsamples');
vi.mock('../lib/sampleStorage', () => ({
  removeSourcesForDocument,
  getGlobalLabsamplesFolder,
}));

vi.mock('../commands/utilityCommands', () => ({
  showOrphanRemovedNotice: vi.fn(),
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return { ...actual, default: actual, existsSync: vi.fn(() => false) };
});

const WORKFLOW_PATH = '/ws/labnote/001_Exp/001_WD010_design.labnote.md';

async function registerAndGetDeleteCommand() {
  const { registerWorkflowCommands } = await import('../commands/workflowCommands');
  const providers = {
    workflowTreeProvider: { refresh: vi.fn(), getWorkspaceRoot: vi.fn(() => '/ws') },
    sectionEditorProvider: { broadcastSampleDefsUpdated: vi.fn() },
  } as any;
  registerWorkflowCommands({ subscriptions: [] } as any, providers);
  const call = mockVscode.commands.registerCommand.mock.calls.find(
    (c: any[]) => c[0] === 'labnotev.deleteWorkflow'
  );
  return call![1] as (uri?: unknown) => Promise<void>;
}

describe('labnotev.deleteWorkflow ordering', () => {
  let callOrder: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    callOrder = [];
    removeSourcesForDocument.mockImplementation(() => {
      callOrder.push('cleanup');
      return [];
    });
    (mockVscode.window.showWarningMessage as any).mockResolvedValue('Delete');
    (mockVscode.window.showInformationMessage as any).mockResolvedValue(undefined);
    (mockVscode.window as any).tabGroups = { all: [] };
  });

  it('does NOT run sample cleanup when the file deletion fails', async () => {
    (mockVscode.workspace.fs as any).delete = vi.fn(() => {
      callOrder.push('delete');
      return Promise.reject(new Error('EPERM'));
    });

    const deleteWorkflow = await registerAndGetDeleteCommand();
    await deleteWorkflow({ fsPath: WORKFLOW_PATH });

    expect(callOrder).toEqual(['delete']);
    expect(removeSourcesForDocument).not.toHaveBeenCalled();
  });

  it('runs sample cleanup only after the file deletion succeeds', async () => {
    (mockVscode.workspace.fs as any).delete = vi.fn(() => {
      callOrder.push('delete');
      return Promise.resolve();
    });

    const deleteWorkflow = await registerAndGetDeleteCommand();
    await deleteWorkflow({ fsPath: WORKFLOW_PATH });

    expect(callOrder).toEqual(['delete', 'cleanup']);
  });
});
