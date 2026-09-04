/**
 * Tests for workflowDataLoader
 * Handles loading, saving, and seeding workflow/unit operation JSON files.
 *
 * I/O now flows through the injected `LabnoteFs` port, so these tests use an
 * in-memory `MemFileSystem` instead of mocking `node:fs`. That is exactly the
 * payoff the adapter was introduced for.
 */
import { MemFileSystem } from '@labnotev/core';
import {
  ensureWorkflowResources,
  loadWorkflows,
  loadUnitOperations,
  saveWorkflows,
  saveUnitOperations,
  addWorkflow,
  addUnitOperation,
  groupWorkflowsByCategory,
  generateNextWorkflowId,
  generateNextUnitOpId,
  getWorkflowFilePath,
} from '../lib/workflowDataLoader';

// Mock vscode (imported transitively by some sibling modules under the same
// setup); keep it minimal so this file needs no real extension host.
vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
    getConfiguration: vi.fn(() => ({ get: vi.fn() })),
  },
  window: { showErrorMessage: vi.fn(), showInformationMessage: vi.fn() },
}));

describe('workflowDataLoader', () => {
  const mockWorkflowsJson = {
    version: '0.4.1',
    language: 'English',
    lastUpdated: '2025-08-15',
    workflows: [
      { id: 'WD010', name: 'General Design of Experiment', description: 'This workflow provides a general-purpose approach...', category: 'Design' },
      { id: 'WB010', name: 'DNA Oligomer Assembly', description: 'This workflow focuses on assembling DNA...', category: 'Build' },
    ],
  };

  const mockHwUnitOpsJson = {
    version: '0.4',
    language: 'English',
    lastUpdated: '2025-08-15',
    unitOperations: [
      { id: 'UHW010', name: 'Liquid Handling', equipment: 'Multiple dispenser system', description: 'Basic liquid sample operations...' },
      { id: 'UHW020', name: '96 Channel Liquid Handling', equipment: 'NGS library preparation system', description: 'High-throughput liquid handling...' },
    ],
  };

  const mockSwUnitOpsJson = {
    version: '0.3.2',
    language: 'English',
    lastUpdated: '2025-08-15',
    unitOperations: [
      { id: 'USW010', name: 'DNA Oligomer Pool Design', software: 'Dsembler, DNAWorks', description: 'Software that designs DNA oligomers...' },
      { id: 'USW020', name: 'Primer Design', software: 'SnapGene, Primer3', description: 'Designing primers...' },
    ],
  };

  describe('ensureWorkflowResources', () => {
    it('seeds catalog JSON files from the bundle when they do not exist', async () => {
      const fs = new MemFileSystem();

      await ensureWorkflowResources(fs, '/workspace');

      // Three catalog files are seeded under resources/workflows.
      const wfPath = getWorkflowFilePath('/workspace', 'workflows');
      const hwPath = getWorkflowFilePath('/workspace', 'unitoperations_hw');
      const swPath = getWorkflowFilePath('/workspace', 'unitoperations_sw');
      expect(await fs.exists(wfPath)).toBe(true);
      expect(await fs.exists(hwPath)).toBe(true);
      expect(await fs.exists(swPath)).toBe(true);
      // The seeded content is valid serialized JSON of the bundle.
      const seeded = await fs.read(wfPath);
      expect(() => JSON.parse(seeded)).not.toThrow();
      const written = Object.keys(fs.snapshot()).filter((p) => p.endsWith('.json'));
      expect(written).toHaveLength(3);
    });

    it('does not overwrite catalog files that already exist', async () => {
      const fs = new MemFileSystem();
      const wfPath = getWorkflowFilePath('/workspace', 'workflows');
      const hwPath = getWorkflowFilePath('/workspace', 'unitoperations_hw');
      const swPath = getWorkflowFilePath('/workspace', 'unitoperations_sw');
      await fs.write(wfPath, 'SENTINEL_WF');
      await fs.write(hwPath, 'SENTINEL_HW');
      await fs.write(swPath, 'SENTINEL_SW');

      await ensureWorkflowResources(fs, '/workspace');

      expect(await fs.read(wfPath)).toBe('SENTINEL_WF');
      expect(await fs.read(hwPath)).toBe('SENTINEL_HW');
      expect(await fs.read(swPath)).toBe('SENTINEL_SW');
    });

    it('does nothing when workspaceRoot is empty', async () => {
      const fs = new MemFileSystem();
      await ensureWorkflowResources(fs, '');
      expect(Object.keys(fs.snapshot())).toHaveLength(0);
    });
  });

  describe('loadWorkflows', () => {
    it('loads workflows from the JSON file', async () => {
      const fs = new MemFileSystem();
      await fs.write(getWorkflowFilePath('/workspace', 'workflows'), JSON.stringify(mockWorkflowsJson));

      const result = await loadWorkflows(fs, '/workspace');

      expect(result).toEqual(mockWorkflowsJson);
      expect(result.workflows).toHaveLength(2);
      expect(result.workflows[0].id).toBe('WD010');
    });

    it('returns an empty structure if the file is not found', async () => {
      const fs = new MemFileSystem();
      const result = await loadWorkflows(fs, '/workspace');
      expect(result.workflows).toEqual([]);
    });

    it('groups workflows by category', async () => {
      const fs = new MemFileSystem();
      await fs.write(getWorkflowFilePath('/workspace', 'workflows'), JSON.stringify(mockWorkflowsJson));

      const data = await loadWorkflows(fs, '/workspace');
      const grouped = groupWorkflowsByCategory(data.workflows);

      expect(grouped['Design']).toHaveLength(1);
      expect(grouped['Build']).toHaveLength(1);
      expect(grouped['Design'][0].id).toBe('WD010');
    });
  });

  describe('loadUnitOperations', () => {
    it('loads HW unit operations from the JSON file', async () => {
      const fs = new MemFileSystem();
      await fs.write(getWorkflowFilePath('/workspace', 'unitoperations_hw'), JSON.stringify(mockHwUnitOpsJson));

      const result = await loadUnitOperations(fs, '/workspace', 'hw');

      expect(result).toEqual(mockHwUnitOpsJson);
      expect(result.unitOperations[0].id).toBe('UHW010');
    });

    it('loads SW unit operations from the JSON file', async () => {
      const fs = new MemFileSystem();
      await fs.write(getWorkflowFilePath('/workspace', 'unitoperations_sw'), JSON.stringify(mockSwUnitOpsJson));

      const result = await loadUnitOperations(fs, '/workspace', 'sw');

      expect(result).toEqual(mockSwUnitOpsJson);
      expect(result.unitOperations[0].id).toBe('USW010');
    });

    it('returns an empty structure if the file is not found', async () => {
      const fs = new MemFileSystem();
      const result = await loadUnitOperations(fs, '/workspace', 'hw');
      expect(result.unitOperations).toEqual([]);
    });
  });

  describe('saveWorkflows', () => {
    it('saves workflows to the JSON file (creating dirs on demand)', async () => {
      const fs = new MemFileSystem();
      await saveWorkflows(fs, '/workspace', structuredClone(mockWorkflowsJson));

      const path = getWorkflowFilePath('/workspace', 'workflows');
      expect(await fs.exists(path)).toBe(true);
      const stored = JSON.parse(await fs.read(path));
      expect(stored.workflows).toEqual(mockWorkflowsJson.workflows);
    });
  });

  describe('saveUnitOperations', () => {
    it('saves HW unit operations to the JSON file', async () => {
      const fs = new MemFileSystem();
      await saveUnitOperations(fs, '/workspace', 'hw', structuredClone(mockHwUnitOpsJson));

      const stored = JSON.parse(await fs.read(getWorkflowFilePath('/workspace', 'unitoperations_hw')));
      expect(stored.unitOperations).toEqual(mockHwUnitOpsJson.unitOperations);
    });

    it('saves SW unit operations to the JSON file', async () => {
      const fs = new MemFileSystem();
      await saveUnitOperations(fs, '/workspace', 'sw', structuredClone(mockSwUnitOpsJson));

      const stored = JSON.parse(await fs.read(getWorkflowFilePath('/workspace', 'unitoperations_sw')));
      expect(stored.unitOperations).toEqual(mockSwUnitOpsJson.unitOperations);
    });
  });

  describe('addWorkflow', () => {
    it('adds a new workflow to the list', async () => {
      const fs = new MemFileSystem();
      await fs.write(getWorkflowFilePath('/workspace', 'workflows'), JSON.stringify(mockWorkflowsJson));

      const data = await loadWorkflows(fs, '/workspace');
      const updated = addWorkflow(data, { id: 'WD030', name: 'New Workflow', description: 'A new workflow', category: 'Design' });

      expect(updated.workflows).toHaveLength(3);
      expect(updated.workflows.find((w) => w.id === 'WD030')).toBeDefined();
    });

    it('auto-generates an ID if not provided', async () => {
      const fs = new MemFileSystem();
      await fs.write(getWorkflowFilePath('/workspace', 'workflows'), JSON.stringify(mockWorkflowsJson));

      const data = await loadWorkflows(fs, '/workspace');
      const updated = addWorkflow(data, { name: 'New Workflow', description: 'A new workflow', category: 'Design' });

      const added = updated.workflows[updated.workflows.length - 1];
      expect(added.id).toMatch(/^WD\d{3}$/);
    });
  });

  describe('addUnitOperation', () => {
    it('adds a new HW unit operation', async () => {
      const fs = new MemFileSystem();
      await fs.write(getWorkflowFilePath('/workspace', 'unitoperations_hw'), JSON.stringify(mockHwUnitOpsJson));

      const data = await loadUnitOperations(fs, '/workspace', 'hw');
      const updated = addUnitOperation(data, { id: 'UHW030', name: 'New Operation', equipment: 'New Equipment', description: 'A new unit operation' });

      expect(updated.unitOperations).toHaveLength(3);
      expect(updated.unitOperations.find((op) => op.id === 'UHW030')).toBeDefined();
    });
  });

  describe('generateNextWorkflowId', () => {
    it('generates the next ID for the Design category', () => {
      const workflows = [
        { id: 'WD010', name: 'Test', description: '', category: 'Design' },
        { id: 'WD020', name: 'Test', description: '', category: 'Design' },
      ];
      expect(generateNextWorkflowId(workflows, 'Design')).toBe('WD030');
    });

    it('generates the next ID for the Build category', () => {
      const workflows = [
        { id: 'WB010', name: 'Test', description: '', category: 'Build' },
        { id: 'WB025', name: 'Test', description: '', category: 'Build' },
      ];
      expect(generateNextWorkflowId(workflows, 'Build')).toBe('WB030');
    });
  });

  describe('generateNextUnitOpId', () => {
    it('generates the next ID for HW unit operations', () => {
      const ops = [
        { id: 'UHW010', name: 'Test', description: '' },
        { id: 'UHW020', name: 'Test', description: '' },
      ];
      expect(generateNextUnitOpId(ops, 'hw')).toBe('UHW030');
    });

    it('generates the next ID for SW unit operations', () => {
      const ops = [
        { id: 'USW010', name: 'Test', description: '' },
        { id: 'USW025', name: 'Test', description: '' },
      ];
      expect(generateNextUnitOpId(ops, 'sw')).toBe('USW030');
    });
  });

  describe('getWorkflowFilePath', () => {
    it('returns the correct path for the workflows JSON', () => {
      const filePath = getWorkflowFilePath('/workspace', 'workflows');
      expect(filePath).toContain('resources');
      expect(filePath).toContain('workflows');
      expect(filePath).toContain('workflows_en.json');
    });

    it('returns the correct path for the HW unit operations JSON', () => {
      expect(getWorkflowFilePath('/workspace', 'unitoperations_hw')).toContain('unitoperations_hw_en.json');
    });

    it('returns the correct path for the SW unit operations JSON', () => {
      expect(getWorkflowFilePath('/workspace', 'unitoperations_sw')).toContain('unitoperations_sw_en.json');
    });
  });
});
