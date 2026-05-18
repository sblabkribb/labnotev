/**
 * Tests for workflowDataLoader
 * Handles loading, saving, and copying workflow/unit operation JSON files
 */import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  copyFileSync: vi.fn(),
}));

// Mock vscode
vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
    getConfiguration: vi.fn(() => ({
      get: vi.fn(),
    })),
  },
  window: {
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
  },
}));

describe('workflowDataLoader', () => {
  const mockWorkflowsJson = {
    version: '0.4.1',
    language: 'English',
    lastUpdated: '2025-08-15',
    workflows: [
      {
        id: 'WD010',
        name: 'General Design of Experiment',
        description: 'This workflow provides a general-purpose approach...',
        category: 'Design',
      },
      {
        id: 'WB010',
        name: 'DNA Oligomer Assembly',
        description: 'This workflow focuses on assembling DNA...',
        category: 'Build',
      },
    ],
  };

  const mockHwUnitOpsJson = {
    version: '0.4',
    language: 'English',
    lastUpdated: '2025-08-15',
    unitOperations: [
      {
        id: 'UHW010',
        name: 'Liquid Handling',
        equipment: 'Multiple dispenser system',
        description: 'Basic liquid sample operations...',
      },
      {
        id: 'UHW020',
        name: '96 Channel Liquid Handling',
        equipment: 'NGS library preparation system',
        description: 'High-throughput liquid handling...',
      },
    ],
  };

  const mockSwUnitOpsJson = {
    version: '0.3.2',
    language: 'English',
    lastUpdated: '2025-08-15',
    unitOperations: [
      {
        id: 'USW010',
        name: 'DNA Oligomer Pool Design',
        software: 'Dsembler, DNAWorks',
        description: 'Software that designs DNA oligomers...',
      },
      {
        id: 'USW020',
        name: 'Primer Design',
        software: 'SnapGene, Primer3',
        description: 'Designing primers...',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ensureWorkflowResources', () => {
    it('should create resources/workflows folder if not exists', async () => {
      const { ensureWorkflowResources } = await import('../lib/workflowDataLoader');
      
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      ensureWorkflowResources('/extension/path', '/workspace');
      
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('workflows'),
        { recursive: true }
      );
    });

    it('should copy JSON files from extension to workspace if not exist', async () => {
      const { ensureWorkflowResources } = await import('../lib/workflowDataLoader');
      
      // Mock existsSync based on path
      vi.mocked(fs.existsSync).mockImplementation((filePath: fs.PathLike) => {
        const pathStr = filePath.toString().replace(/\\/g, '/');
        // Workspace folder exists
        if (pathStr.includes('/workspace') && pathStr.includes('workflows') && !pathStr.endsWith('.json')) {
          return true;
        }
        // Workspace JSON files don't exist
        if (pathStr.includes('/workspace') && pathStr.endsWith('.json')) {
          return false;
        }
        // Extension JSON files exist
        if (pathStr.includes('/extension/path') && pathStr.endsWith('.json')) {
          return true;
        }
        return false;
      });
      
      ensureWorkflowResources('/extension/path', '/workspace');
      
      expect(fs.copyFileSync).toHaveBeenCalledTimes(3);
    });

    it('should not copy files if they already exist in workspace', async () => {
      const { ensureWorkflowResources } = await import('../lib/workflowDataLoader');
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      ensureWorkflowResources('/extension/path', '/workspace');
      
      expect(fs.copyFileSync).not.toHaveBeenCalled();
    });
  });

  describe('loadWorkflows', () => {
    it('should load workflows from JSON file', async () => {
      const { loadWorkflows } = await import('../lib/workflowDataLoader');
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockWorkflowsJson));
      
      const result = loadWorkflows('/workspace');
      
      expect(result).toEqual(mockWorkflowsJson);
      expect(result.workflows).toHaveLength(2);
      expect(result.workflows[0].id).toBe('WD010');
    });

    it('should return empty structure if file not found', async () => {
      const { loadWorkflows } = await import('../lib/workflowDataLoader');
      
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const result = loadWorkflows('/workspace');
      
      expect(result.workflows).toEqual([]);
    });

    it('should group workflows by category', async () => {
      const { loadWorkflows, groupWorkflowsByCategory } = await import('../lib/workflowDataLoader');
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockWorkflowsJson));
      
      const data = loadWorkflows('/workspace');
      const grouped = groupWorkflowsByCategory(data.workflows);
      
      expect(grouped['Design']).toHaveLength(1);
      expect(grouped['Build']).toHaveLength(1);
      expect(grouped['Design'][0].id).toBe('WD010');
    });
  });

  describe('loadUnitOperations', () => {
    it('should load HW unit operations from JSON file', async () => {
      const { loadUnitOperations } = await import('../lib/workflowDataLoader');
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockHwUnitOpsJson));
      
      const result = loadUnitOperations('/workspace', 'hw');
      
      expect(result).toEqual(mockHwUnitOpsJson);
      expect(result.unitOperations).toHaveLength(2);
      expect(result.unitOperations[0].id).toBe('UHW010');
    });

    it('should load SW unit operations from JSON file', async () => {
      const { loadUnitOperations } = await import('../lib/workflowDataLoader');
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockSwUnitOpsJson));
      
      const result = loadUnitOperations('/workspace', 'sw');
      
      expect(result).toEqual(mockSwUnitOpsJson);
      expect(result.unitOperations).toHaveLength(2);
      expect(result.unitOperations[0].id).toBe('USW010');
    });

    it('should return empty structure if file not found', async () => {
      const { loadUnitOperations } = await import('../lib/workflowDataLoader');
      
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const result = loadUnitOperations('/workspace', 'hw');
      
      expect(result.unitOperations).toEqual([]);
    });
  });

  describe('saveWorkflows', () => {
    it('should save workflows to JSON file', async () => {
      const { saveWorkflows } = await import('../lib/workflowDataLoader');
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      saveWorkflows('/workspace', mockWorkflowsJson);
      
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('workflows_en.json'),
        JSON.stringify(mockWorkflowsJson, null, 2),
        'utf-8'
      );
    });

    it('should create folder if not exists before saving', async () => {
      const { saveWorkflows } = await import('../lib/workflowDataLoader');
      
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      saveWorkflows('/workspace', mockWorkflowsJson);
      
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('workflows'),
        { recursive: true }
      );
    });
  });

  describe('saveUnitOperations', () => {
    it('should save HW unit operations to JSON file', async () => {
      const { saveUnitOperations } = await import('../lib/workflowDataLoader');
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      saveUnitOperations('/workspace', 'hw', mockHwUnitOpsJson);
      
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('unitoperations_hw_en.json'),
        JSON.stringify(mockHwUnitOpsJson, null, 2),
        'utf-8'
      );
    });

    it('should save SW unit operations to JSON file', async () => {
      const { saveUnitOperations } = await import('../lib/workflowDataLoader');
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      saveUnitOperations('/workspace', 'sw', mockSwUnitOpsJson);
      
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('unitoperations_sw_en.json'),
        JSON.stringify(mockSwUnitOpsJson, null, 2),
        'utf-8'
      );
    });
  });

  describe('addWorkflow', () => {
    it('should add a new workflow to the list', async () => {
      const { loadWorkflows, addWorkflow, saveWorkflows } = await import('../lib/workflowDataLoader');
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockWorkflowsJson));
      
      const newWorkflow = {
        id: 'WD030',
        name: 'New Workflow',
        description: 'A new workflow',
        category: 'Design',
      };
      
      const data = loadWorkflows('/workspace');
      const updated = addWorkflow(data, newWorkflow);
      
      expect(updated.workflows).toHaveLength(3);
      expect(updated.workflows.find(w => w.id === 'WD030')).toBeDefined();
    });

    it('should auto-generate ID if not provided', async () => {
      const { loadWorkflows, addWorkflow } = await import('../lib/workflowDataLoader');
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockWorkflowsJson));
      
      const newWorkflow = {
        name: 'New Workflow',
        description: 'A new workflow',
        category: 'Design',
      };
      
      const data = loadWorkflows('/workspace');
      const updated = addWorkflow(data, newWorkflow);
      
      const addedWorkflow = updated.workflows[updated.workflows.length - 1];
      expect(addedWorkflow.id).toMatch(/^WD\d{3}$/);
    });
  });

  describe('updateWorkflow', () => {
    it('should update an existing workflow', async () => {
      const { loadWorkflows, updateWorkflow } = await import('../lib/workflowDataLoader');
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockWorkflowsJson));
      
      const data = loadWorkflows('/workspace');
      const updated = updateWorkflow(data, 'WD010', { name: 'Updated Name' });
      
      expect(updated.workflows.find(w => w.id === 'WD010')?.name).toBe('Updated Name');
    });

    it('should return unchanged data if workflow not found', async () => {
      const { loadWorkflows, updateWorkflow } = await import('../lib/workflowDataLoader');
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockWorkflowsJson));
      
      const data = loadWorkflows('/workspace');
      const updated = updateWorkflow(data, 'WD999', { name: 'Updated Name' });
      
      expect(updated).toEqual(data);
    });
  });

  describe('deleteWorkflow', () => {
    it('should delete a workflow from the list', async () => {
      const { loadWorkflows, deleteWorkflow } = await import('../lib/workflowDataLoader');
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockWorkflowsJson));
      
      const data = loadWorkflows('/workspace');
      const updated = deleteWorkflow(data, 'WD010');
      
      expect(updated.workflows).toHaveLength(1);
      expect(updated.workflows.find(w => w.id === 'WD010')).toBeUndefined();
    });
  });

  describe('addUnitOperation', () => {
    it('should add a new HW unit operation', async () => {
      const { loadUnitOperations, addUnitOperation } = await import('../lib/workflowDataLoader');
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockHwUnitOpsJson));
      
      const newOp = {
        id: 'UHW030',
        name: 'New Operation',
        equipment: 'New Equipment',
        description: 'A new unit operation',
      };
      
      const data = loadUnitOperations('/workspace', 'hw');
      const updated = addUnitOperation(data, newOp);
      
      expect(updated.unitOperations).toHaveLength(3);
      expect(updated.unitOperations.find(op => op.id === 'UHW030')).toBeDefined();
    });
  });

  describe('updateUnitOperation', () => {
    it('should update an existing unit operation', async () => {
      const { loadUnitOperations, updateUnitOperation } = await import('../lib/workflowDataLoader');
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockHwUnitOpsJson));
      
      const data = loadUnitOperations('/workspace', 'hw');
      const updated = updateUnitOperation(data, 'UHW010', { name: 'Updated Name' });
      
      expect(updated.unitOperations.find(op => op.id === 'UHW010')?.name).toBe('Updated Name');
    });
  });

  describe('deleteUnitOperation', () => {
    it('should delete a unit operation from the list', async () => {
      const { loadUnitOperations, deleteUnitOperation } = await import('../lib/workflowDataLoader');
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockHwUnitOpsJson));
      
      const data = loadUnitOperations('/workspace', 'hw');
      const updated = deleteUnitOperation(data, 'UHW010');
      
      expect(updated.unitOperations).toHaveLength(1);
      expect(updated.unitOperations.find(op => op.id === 'UHW010')).toBeUndefined();
    });
  });

  describe('generateNextWorkflowId', () => {
    it('should generate next ID for Design category', async () => {
      const { generateNextWorkflowId } = await import('../lib/workflowDataLoader');
      
      const workflows = [
        { id: 'WD010', name: 'Test', description: '', category: 'Design' },
        { id: 'WD020', name: 'Test', description: '', category: 'Design' },
      ];
      
      const nextId = generateNextWorkflowId(workflows, 'Design');
      expect(nextId).toBe('WD030');
    });

    it('should generate next ID for Build category', async () => {
      const { generateNextWorkflowId } = await import('../lib/workflowDataLoader');
      
      const workflows = [
        { id: 'WB010', name: 'Test', description: '', category: 'Build' },
        { id: 'WB025', name: 'Test', description: '', category: 'Build' },
      ];
      
      const nextId = generateNextWorkflowId(workflows, 'Build');
      expect(nextId).toBe('WB030');
    });
  });

  describe('generateNextUnitOpId', () => {
    it('should generate next ID for HW unit operations', async () => {
      const { generateNextUnitOpId } = await import('../lib/workflowDataLoader');
      
      const ops = [
        { id: 'UHW010', name: 'Test', description: '' },
        { id: 'UHW020', name: 'Test', description: '' },
      ];
      
      const nextId = generateNextUnitOpId(ops, 'hw');
      expect(nextId).toBe('UHW030');
    });

    it('should generate next ID for SW unit operations', async () => {
      const { generateNextUnitOpId } = await import('../lib/workflowDataLoader');
      
      const ops = [
        { id: 'USW010', name: 'Test', description: '' },
        { id: 'USW025', name: 'Test', description: '' },
      ];
      
      const nextId = generateNextUnitOpId(ops, 'sw');
      expect(nextId).toBe('USW030');
    });
  });

  describe('getWorkflowFilePath', () => {
    it('should return correct path for workflows JSON', async () => {
      const { getWorkflowFilePath } = await import('../lib/workflowDataLoader');
      
      const filePath = getWorkflowFilePath('/workspace', 'workflows');
      expect(filePath).toContain('resources');
      expect(filePath).toContain('workflows');
      expect(filePath).toContain('workflows_en.json');
    });

    it('should return correct path for HW unit operations JSON', async () => {
      const { getWorkflowFilePath } = await import('../lib/workflowDataLoader');
      
      const filePath = getWorkflowFilePath('/workspace', 'unitoperations_hw');
      expect(filePath).toContain('unitoperations_hw_en.json');
    });

    it('should return correct path for SW unit operations JSON', async () => {
      const { getWorkflowFilePath } = await import('../lib/workflowDataLoader');
      
      const filePath = getWorkflowFilePath('/workspace', 'unitoperations_sw');
      expect(filePath).toContain('unitoperations_sw_en.json');
    });
  });
});
