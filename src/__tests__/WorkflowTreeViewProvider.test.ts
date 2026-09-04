/**
 * Tests for WorkflowTreeViewProvider
 * Tree view for workflows and unit operations
 */
// Mock vscode
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
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
    getConfiguration: vi.fn(() => ({
      get: vi.fn(),
    })),
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
  },
  window: {
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showInputBox: vi.fn(),
    showQuickPick: vi.fn(),
  },
  commands: {
    registerCommand: vi.fn(),
  },
  Uri: {
    file: (path: string) => ({ fsPath: path }),
  },
}));

// Mock workflowDataLoader
vi.mock('../lib/workflowDataLoader', () => ({
  loadWorkflows: vi.fn(),
  loadUnitOperations: vi.fn(),
  groupWorkflowsByCategory: vi.fn(),
  ensureWorkflowResources: vi.fn(),
}));

describe('WorkflowTreeViewProvider', () => {
  const mockWorkflows = {
    version: '0.4.1',
    language: 'English',
    lastUpdated: '2025-08-15',
    workflows: [
      { id: 'WD010', name: 'General Design', description: 'Design workflow', category: 'Design' },
      { id: 'WD020', name: 'Evolution Design', description: 'Evolution', category: 'Design' },
      { id: 'WB010', name: 'DNA Assembly', description: 'Build workflow', category: 'Build' },
    ],
  };

  const mockHwUnitOps = {
    version: '0.4',
    language: 'English',
    lastUpdated: '2025-08-15',
    unitOperations: [
      { id: 'UHW010', name: 'Liquid Handling', equipment: 'Dispenser', description: 'HW operation' },
      { id: 'UHW020', name: '96 Channel', equipment: 'NGS system', description: 'HW operation' },
    ],
  };

  const mockSwUnitOps = {
    version: '0.3.2',
    language: 'English',
    lastUpdated: '2025-08-15',
    unitOperations: [
      { id: 'USW010', name: 'Oligomer Design', software: 'DNAWorks', description: 'SW operation' },
      { id: 'USW020', name: 'Primer Design', software: 'SnapGene', description: 'SW operation' },
    ],
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    
    const { loadWorkflows, loadUnitOperations, groupWorkflowsByCategory } = await import('../lib/workflowDataLoader');
    // Signatures now take a leading `LabnoteFs` arg: (fs, workspaceRoot[, type]).
    vi.mocked(loadWorkflows).mockResolvedValue(mockWorkflows);
    vi.mocked(loadUnitOperations).mockImplementation((_fs, _root, type) =>
      Promise.resolve(type === 'hw' ? mockHwUnitOps : mockSwUnitOps)
    );
    vi.mocked(groupWorkflowsByCategory).mockReturnValue({
      'Design': mockWorkflows.workflows.filter(w => w.category === 'Design'),
      'Build': mockWorkflows.workflows.filter(w => w.category === 'Build'),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('WorkflowTreeItemType', () => {
    it('should have correct enum values', async () => {
      const { WorkflowTreeItemType } = await import('../views/WorkflowTreeViewProvider');
      
      expect(WorkflowTreeItemType.WorkflowRoot).toBe('workflowRoot');
      expect(WorkflowTreeItemType.Category).toBe('category');
      expect(WorkflowTreeItemType.Workflow).toBe('workflow');
      expect(WorkflowTreeItemType.UnitOpRoot).toBe('unitOpRoot');
      expect(WorkflowTreeItemType.UnitOperation).toBe('unitOperation');
    });
  });

  describe('WorkflowTreeItem', () => {
    it('should create workflow root item', async () => {
      const { WorkflowTreeItem, WorkflowTreeItemType } = await import('../views/WorkflowTreeViewProvider');
      const vscode = await import('vscode');
      
      const item = new WorkflowTreeItem(
        'Workflows',
        WorkflowTreeItemType.WorkflowRoot,
        vscode.TreeItemCollapsibleState.Expanded
      );
      
      expect(item.label).toBe('Workflows');
      expect(item.itemType).toBe(WorkflowTreeItemType.WorkflowRoot);
      expect(item.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Expanded);
    });

    it('should create category item with workflow count', async () => {
      const { WorkflowTreeItem, WorkflowTreeItemType } = await import('../views/WorkflowTreeViewProvider');
      const vscode = await import('vscode');
      
      const item = new WorkflowTreeItem(
        'Design [2]',
        WorkflowTreeItemType.Category,
        vscode.TreeItemCollapsibleState.Collapsed,
        { category: 'Design' }
      );
      
      expect(item.label).toBe('Design [2]');
      expect(item.itemType).toBe(WorkflowTreeItemType.Category);
      expect(item.category).toBe('Design');
    });

    it('should create workflow item', async () => {
      const { WorkflowTreeItem, WorkflowTreeItemType } = await import('../views/WorkflowTreeViewProvider');
      const vscode = await import('vscode');
      
      const item = new WorkflowTreeItem(
        'WD010: General Design',
        WorkflowTreeItemType.Workflow,
        vscode.TreeItemCollapsibleState.None,
        {
          workflowId: 'WD010',
          workflowName: 'General Design',
          workflowDescription: 'Design workflow',
          category: 'Design',
        }
      );
      
      expect(item.label).toBe('WD010: General Design');
      expect(item.itemType).toBe(WorkflowTreeItemType.Workflow);
      expect(item.workflowId).toBe('WD010');
      expect(item.contextValue).toBe('workflow');
    });

    it('should create unit operation root item', async () => {
      const { WorkflowTreeItem, WorkflowTreeItemType } = await import('../views/WorkflowTreeViewProvider');
      const vscode = await import('vscode');
      
      const item = new WorkflowTreeItem(
        'HW Unit Operations [2]',
        WorkflowTreeItemType.UnitOpRoot,
        vscode.TreeItemCollapsibleState.Collapsed,
        { opType: 'hw' }
      );
      
      expect(item.label).toBe('HW Unit Operations [2]');
      expect(item.itemType).toBe(WorkflowTreeItemType.UnitOpRoot);
      expect(item.opType).toBe('hw');
    });

    it('should create unit operation item', async () => {
      const { WorkflowTreeItem, WorkflowTreeItemType } = await import('../views/WorkflowTreeViewProvider');
      const vscode = await import('vscode');
      
      const item = new WorkflowTreeItem(
        'UHW010: Liquid Handling',
        WorkflowTreeItemType.UnitOperation,
        vscode.TreeItemCollapsibleState.None,
        {
          opId: 'UHW010',
          opName: 'Liquid Handling',
          opDescription: 'HW operation',
          opType: 'hw',
        }
      );
      
      expect(item.label).toBe('UHW010: Liquid Handling');
      expect(item.itemType).toBe(WorkflowTreeItemType.UnitOperation);
      expect(item.opId).toBe('UHW010');
      expect(item.opType).toBe('hw');
      expect(item.contextValue).toBe('unitOperation');
    });
  });

  describe('WorkflowTreeViewProvider', () => {
    it('should return root items', async () => {
      const { WorkflowTreeViewProvider, WorkflowTreeItemType } = await import('../views/WorkflowTreeViewProvider');
      
      const provider = new WorkflowTreeViewProvider('/extension/path', '/workspace');
      const rootItems = await provider.getChildren();
      
      expect(rootItems).toHaveLength(3);
      expect(rootItems[0].itemType).toBe(WorkflowTreeItemType.WorkflowRoot);
      expect(rootItems[1].itemType).toBe(WorkflowTreeItemType.UnitOpRoot);
      expect(rootItems[2].itemType).toBe(WorkflowTreeItemType.UnitOpRoot);
    });

    it('should return category items for workflow root', async () => {
      const { WorkflowTreeViewProvider, WorkflowTreeItem, WorkflowTreeItemType } = await import('../views/WorkflowTreeViewProvider');
      const vscode = await import('vscode');
      
      const provider = new WorkflowTreeViewProvider('/extension/path', '/workspace');
      const workflowRoot = new WorkflowTreeItem(
        'Workflows',
        WorkflowTreeItemType.WorkflowRoot,
        vscode.TreeItemCollapsibleState.Expanded
      );
      
      const categories = await provider.getChildren(workflowRoot);
      
      expect(categories).toHaveLength(2); // Design, Build
      expect(categories[0].itemType).toBe(WorkflowTreeItemType.Category);
    });

    it('should return workflow items for category', async () => {
      const { WorkflowTreeViewProvider, WorkflowTreeItem, WorkflowTreeItemType } = await import('../views/WorkflowTreeViewProvider');
      const vscode = await import('vscode');
      
      const provider = new WorkflowTreeViewProvider('/extension/path', '/workspace');
      const categoryItem = new WorkflowTreeItem(
        'Design [2]',
        WorkflowTreeItemType.Category,
        vscode.TreeItemCollapsibleState.Collapsed,
        { category: 'Design' }
      );
      
      const workflows = await provider.getChildren(categoryItem);
      
      expect(workflows).toHaveLength(2);
      expect(workflows[0].itemType).toBe(WorkflowTreeItemType.Workflow);
      expect(workflows[0].workflowId).toBe('WD010');
    });

    it('should return unit operation items for UnitOp root', async () => {
      const { WorkflowTreeViewProvider, WorkflowTreeItem, WorkflowTreeItemType } = await import('../views/WorkflowTreeViewProvider');
      const vscode = await import('vscode');
      
      const provider = new WorkflowTreeViewProvider('/extension/path', '/workspace');
      const hwRoot = new WorkflowTreeItem(
        'HW Unit Operations [2]',
        WorkflowTreeItemType.UnitOpRoot,
        vscode.TreeItemCollapsibleState.Collapsed,
        { opType: 'hw' }
      );
      
      const operations = await provider.getChildren(hwRoot);
      
      expect(operations).toHaveLength(2);
      expect(operations[0].itemType).toBe(WorkflowTreeItemType.UnitOperation);
      expect(operations[0].opId).toBe('UHW010');
    });

    it('should refresh tree data', async () => {
      const { WorkflowTreeViewProvider } = await import('../views/WorkflowTreeViewProvider');
      
      const provider = new WorkflowTreeViewProvider('/extension/path', '/workspace');
      
      // Should not throw
      expect(() => provider.refresh()).not.toThrow();
    });
  });

  describe('formatWorkflowLabel', () => {
    it('should format workflow label with ID and name', async () => {
      const { formatWorkflowLabel } = await import('../views/WorkflowTreeViewProvider');
      
      const label = formatWorkflowLabel('WD010', 'General Design');
      expect(label).toBe('WD010: General Design');
    });
  });

  describe('formatUnitOpLabel', () => {
    it('should format unit operation label with ID and name', async () => {
      const { formatUnitOpLabel } = await import('../views/WorkflowTreeViewProvider');
      
      const label = formatUnitOpLabel('UHW010', 'Liquid Handling');
      expect(label).toBe('UHW010: Liquid Handling');
    });
  });

  describe('getUnitOpInsertText', () => {
    it('should return unit operation insert text', async () => {
      const { getUnitOpInsertText } = await import('../views/WorkflowTreeViewProvider');
      
      const text = getUnitOpInsertText('UHW010', 'Liquid Handling', 'Dispenser', 'Basic liquid handling');
      expect(text).toContain('UHW010');
      expect(text).toContain('Liquid Handling');
    });

    it('should include equipment for HW operations', async () => {
      const { getUnitOpInsertText } = await import('../views/WorkflowTreeViewProvider');
      
      const text = getUnitOpInsertText('UHW010', 'Liquid Handling', 'Multiple dispenser system', 'Basic liquid handling');
      expect(text).toContain('Multiple dispenser system');
    });

    it('should include software for SW operations', async () => {
      const { getUnitOpInsertText } = await import('../views/WorkflowTreeViewProvider');
      
      const text = getUnitOpInsertText('USW010', 'DNA Oligomer Pool Design', 'Dsembler, DNAWorks', 'Software for design');
      expect(text).toContain('Dsembler, DNAWorks');
    });
  });
});
