/**
 * Phase 3 regression test: WorkflowTreeViewProvider defers disk I/O until
 * the view is actually expanded. Constructing the provider must not call
 * ensureWorkflowResources/loadWorkflows/loadUnitOperations. The first
 * `getChildren` invocation performs the load; `refresh()` invalidates the
 * flag so the next `getChildren` re-reads from disk.
 */

vi.mock('vscode', () => ({
  TreeItem: class {
    label: string;
    collapsibleState: number;
    constructor(label: string, collapsibleState: number) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    }
  },
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2,
  },
  ThemeIcon: class {
    id: string;
    constructor(id: string) {
      this.id = id;
    }
  },
  EventEmitter: class {
    event = vi.fn();
    fire = vi.fn();
    dispose = vi.fn();
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
    getConfiguration: vi.fn(() => ({ get: vi.fn() })),
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
  },
  window: {
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
  },
  commands: {
    registerCommand: vi.fn(),
  },
  Uri: {
    file: (p: string) => ({ fsPath: p }),
  },
}));

vi.mock('../lib/workflowDataLoader', () => ({
  loadWorkflows: vi.fn(),
  loadUnitOperations: vi.fn(),
  groupWorkflowsByCategory: vi.fn(),
  ensureWorkflowResources: vi.fn(),
}));

describe('WorkflowTreeViewProvider lazy loading (Phase 3)', () => {
  const emptyWorkflows = {
    version: '0.0',
    language: 'English',
    lastUpdated: '2026-01-01',
    workflows: [] as Array<{
      id: string;
      name: string;
      description: string;
      category: string;
    }>,
  };
  const emptyOps = {
    version: '0.0',
    language: 'English',
    lastUpdated: '2026-01-01',
    unitOperations: [] as Array<{
      id: string;
      name: string;
      description: string;
    }>,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { loadWorkflows, loadUnitOperations, groupWorkflowsByCategory } =
      await import('../lib/workflowDataLoader');
    vi.mocked(loadWorkflows).mockResolvedValue(emptyWorkflows);
    vi.mocked(loadUnitOperations).mockResolvedValue(emptyOps);
    vi.mocked(groupWorkflowsByCategory).mockReturnValue({});
  });

  it('does not perform disk I/O when the provider is constructed', async () => {
    const { WorkflowTreeViewProvider } = await import('../views/WorkflowTreeViewProvider');
    const { ensureWorkflowResources, loadWorkflows, loadUnitOperations } =
      await import('../lib/workflowDataLoader');

    new WorkflowTreeViewProvider('/extension/path', '/workspace');

    expect(vi.mocked(ensureWorkflowResources)).not.toHaveBeenCalled();
    expect(vi.mocked(loadWorkflows)).not.toHaveBeenCalled();
    expect(vi.mocked(loadUnitOperations)).not.toHaveBeenCalled();
  });

  it('loads data lazily on the first getChildren call', async () => {
    const { WorkflowTreeViewProvider } = await import('../views/WorkflowTreeViewProvider');
    const { ensureWorkflowResources, loadWorkflows, loadUnitOperations } =
      await import('../lib/workflowDataLoader');

    const provider = new WorkflowTreeViewProvider('/extension/path', '/workspace');
    await provider.getChildren();

    expect(vi.mocked(ensureWorkflowResources)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(loadWorkflows)).toHaveBeenCalledTimes(1);
    // hw + sw
    expect(vi.mocked(loadUnitOperations)).toHaveBeenCalledTimes(2);
  });

  it('does not reload on the second getChildren call without refresh', async () => {
    const { WorkflowTreeViewProvider } = await import('../views/WorkflowTreeViewProvider');
    const { loadWorkflows } = await import('../lib/workflowDataLoader');

    const provider = new WorkflowTreeViewProvider('/extension/path', '/workspace');
    await provider.getChildren();
    await provider.getChildren();

    expect(vi.mocked(loadWorkflows)).toHaveBeenCalledTimes(1);
  });

  it('re-reads from disk on getChildren after refresh()', async () => {
    const { WorkflowTreeViewProvider } = await import('../views/WorkflowTreeViewProvider');
    const { loadWorkflows } = await import('../lib/workflowDataLoader');

    const provider = new WorkflowTreeViewProvider('/extension/path', '/workspace');
    await provider.getChildren();
    expect(vi.mocked(loadWorkflows)).toHaveBeenCalledTimes(1);

    provider.refresh();
    // refresh alone must not perform I/O — it only flips the flag.
    expect(vi.mocked(loadWorkflows)).toHaveBeenCalledTimes(1);

    await provider.getChildren();
    expect(vi.mocked(loadWorkflows)).toHaveBeenCalledTimes(2);
  });
});
