/**
 * Workflow Data Loader
 * Handles loading, saving, and copying workflow/unit operation JSON files
 */

import * as fs from 'fs';
import * as path from 'path';

// Type definitions
export interface WorkflowItem {
  id: string;
  name: string;
  description: string;
  category: string;
}

export interface WorkflowJson {
  version: string;
  language: string;
  lastUpdated: string;
  workflows: WorkflowItem[];
}

export interface UnitOperationItem {
  id: string;
  name: string;
  description: string;
  equipment?: string; // HW unit operations
  software?: string;  // SW unit operations
}

export interface UnitOperationJson {
  version: string;
  language: string;
  lastUpdated: string;
  unitOperations: UnitOperationItem[];
}

// Category prefixes for ID generation
const CATEGORY_PREFIXES: Record<string, string> = {
  'Design': 'WD',
  'Build': 'WB',
  'Test': 'WT',
  'Learn': 'WL',
};

/**
 * Get the file path for workflow-related JSON files
 */
export function getWorkflowFilePath(
  workspaceRoot: string,
  fileType: 'workflows' | 'unitoperations_hw' | 'unitoperations_sw'
): string {
  const fileName = `${fileType}_en.json`;
  return path.join(workspaceRoot, 'resources', 'workflows', fileName);
}

/**
 * Ensure workflow resources folder exists and copy JSON files from extension if needed
 */
export function ensureWorkflowResources(extensionPath: string, workspaceRoot: string): void {
  // Skip if paths are invalid (e.g., in test environment)
  if (!extensionPath || !workspaceRoot) {
    return;
  }

  try {
    const workspaceWorkflowsDir = path.join(workspaceRoot, 'resources', 'workflows');
    const extensionWorkflowsDir = path.join(extensionPath, 'resources', 'workflows');

    // Create resources/workflows folder if not exists
    if (!fs.existsSync(workspaceWorkflowsDir)) {
      fs.mkdirSync(workspaceWorkflowsDir, { recursive: true });
    }

    // Files to copy
    const files = ['workflows_en.json', 'unitoperations_hw_en.json', 'unitoperations_sw_en.json'];

    for (const file of files) {
      const destPath = path.join(workspaceWorkflowsDir, file);
      const srcPath = path.join(extensionWorkflowsDir, file);

      // Copy only if destination doesn't exist and source exists
      if (!fs.existsSync(destPath) && fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  } catch (error) {
    // Silently fail in test/dev environments
    console.error('[workflowDataLoader] Error ensuring workflow resources:', error);
  }
}

/**
 * Load workflows from JSON file
 */
export function loadWorkflows(workspaceRoot: string): WorkflowJson {
  // Return empty structure if workspaceRoot is invalid
  if (!workspaceRoot) {
    return {
      version: '0.1.0',
      language: 'English',
      lastUpdated: new Date().toISOString().split('T')[0],
      workflows: [],
    };
  }

  const filePath = getWorkflowFilePath(workspaceRoot, 'workflows');
  
  if (!fs.existsSync(filePath)) {
    return {
      version: '0.1.0',
      language: 'English',
      lastUpdated: new Date().toISOString().split('T')[0],
      workflows: [],
    };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as WorkflowJson;
  } catch {
    return {
      version: '0.1.0',
      language: 'English',
      lastUpdated: new Date().toISOString().split('T')[0],
      workflows: [],
    };
  }
}

/**
 * Load unit operations from JSON file
 */
export function loadUnitOperations(
  workspaceRoot: string,
  type: 'hw' | 'sw'
): UnitOperationJson {
  // Return empty structure if workspaceRoot is invalid
  if (!workspaceRoot) {
    return {
      version: '0.1.0',
      language: 'English',
      lastUpdated: new Date().toISOString().split('T')[0],
      unitOperations: [],
    };
  }

  const filePath = getWorkflowFilePath(workspaceRoot, `unitoperations_${type}`);
  
  if (!fs.existsSync(filePath)) {
    return {
      version: '0.1.0',
      language: 'English',
      lastUpdated: new Date().toISOString().split('T')[0],
      unitOperations: [],
    };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as UnitOperationJson;
  } catch {
    return {
      version: '0.1.0',
      language: 'English',
      lastUpdated: new Date().toISOString().split('T')[0],
      unitOperations: [],
    };
  }
}

/**
 * Save workflows to JSON file
 */
export function saveWorkflows(workspaceRoot: string, data: WorkflowJson): void {
  const filePath = getWorkflowFilePath(workspaceRoot, 'workflows');
  const dir = path.dirname(filePath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Update lastUpdated
  data.lastUpdated = new Date().toISOString().split('T')[0];
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Save unit operations to JSON file
 */
export function saveUnitOperations(
  workspaceRoot: string,
  type: 'hw' | 'sw',
  data: UnitOperationJson
): void {
  const filePath = getWorkflowFilePath(workspaceRoot, `unitoperations_${type}`);
  const dir = path.dirname(filePath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Update lastUpdated
  data.lastUpdated = new Date().toISOString().split('T')[0];
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Group workflows by category
 */
export function groupWorkflowsByCategory(
  workflows: WorkflowItem[]
): Record<string, WorkflowItem[]> {
  return workflows.reduce((acc, workflow) => {
    const category = workflow.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(workflow);
    return acc;
  }, {} as Record<string, WorkflowItem[]>);
}

/**
 * Generate next workflow ID for a category
 */
export function generateNextWorkflowId(
  workflows: WorkflowItem[],
  category: string
): string {
  const prefix = CATEGORY_PREFIXES[category] || 'WX';
  
  // Find all IDs with this prefix
  const existingIds = workflows
    .filter(w => w.id.startsWith(prefix))
    .map(w => parseInt(w.id.substring(2), 10))
    .filter(n => !isNaN(n));
  
  // Get max ID and add 10 (IDs are in increments of 10)
  const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
  const nextNum = Math.ceil((maxId + 1) / 10) * 10;
  
  return `${prefix}${String(nextNum).padStart(3, '0')}`;
}

/**
 * Generate next unit operation ID
 */
export function generateNextUnitOpId(
  operations: UnitOperationItem[],
  type: 'hw' | 'sw'
): string {
  const prefix = type === 'hw' ? 'UHW' : 'USW';
  
  // Find all IDs with this prefix
  const existingIds = operations
    .filter(op => op.id.startsWith(prefix))
    .map(op => parseInt(op.id.substring(3), 10))
    .filter(n => !isNaN(n));
  
  // Get max ID and add 10
  const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
  const nextNum = Math.ceil((maxId + 1) / 10) * 10;
  
  return `${prefix}${String(nextNum).padStart(3, '0')}`;
}

/**
 * Add a new workflow
 */
export function addWorkflow(
  data: WorkflowJson,
  workflow: Partial<WorkflowItem> & { name: string; description: string; category: string }
): WorkflowJson {
  const id = workflow.id || generateNextWorkflowId(data.workflows, workflow.category);
  
  const newWorkflow: WorkflowItem = {
    id,
    name: workflow.name,
    description: workflow.description,
    category: workflow.category,
  };
  
  return {
    ...data,
    workflows: [...data.workflows, newWorkflow],
  };
}

/**
 * Update an existing workflow
 */
export function updateWorkflow(
  data: WorkflowJson,
  id: string,
  updates: Partial<Omit<WorkflowItem, 'id'>>
): WorkflowJson {
  const index = data.workflows.findIndex(w => w.id === id);
  
  if (index === -1) {
    return data;
  }
  
  const updatedWorkflows = [...data.workflows];
  updatedWorkflows[index] = {
    ...updatedWorkflows[index],
    ...updates,
  };
  
  return {
    ...data,
    workflows: updatedWorkflows,
  };
}

/**
 * Delete a workflow
 */
export function deleteWorkflow(data: WorkflowJson, id: string): WorkflowJson {
  return {
    ...data,
    workflows: data.workflows.filter(w => w.id !== id),
  };
}

/**
 * Add a new unit operation
 */
export function addUnitOperation(
  data: UnitOperationJson,
  operation: UnitOperationItem
): UnitOperationJson {
  return {
    ...data,
    unitOperations: [...data.unitOperations, operation],
  };
}

/**
 * Update an existing unit operation
 */
export function updateUnitOperation(
  data: UnitOperationJson,
  id: string,
  updates: Partial<Omit<UnitOperationItem, 'id'>>
): UnitOperationJson {
  const index = data.unitOperations.findIndex(op => op.id === id);
  
  if (index === -1) {
    return data;
  }
  
  const updatedOperations = [...data.unitOperations];
  updatedOperations[index] = {
    ...updatedOperations[index],
    ...updates,
  };
  
  return {
    ...data,
    unitOperations: updatedOperations,
  };
}

/**
 * Delete a unit operation
 */
export function deleteUnitOperation(
  data: UnitOperationJson,
  id: string
): UnitOperationJson {
  return {
    ...data,
    unitOperations: data.unitOperations.filter(op => op.id !== id),
  };
}

/**
 * Search workflows by name, id, or description
 */
export function searchWorkflows(
  workflows: WorkflowItem[],
  query: string
): WorkflowItem[] {
  const lowerQuery = query.toLowerCase();
  return workflows.filter(
    w =>
      w.id.toLowerCase().includes(lowerQuery) ||
      w.name.toLowerCase().includes(lowerQuery) ||
      w.description.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Search unit operations by name, id, or description
 */
export function searchUnitOperations(
  operations: UnitOperationItem[],
  query: string
): UnitOperationItem[] {
  const lowerQuery = query.toLowerCase();
  return operations.filter(
    op =>
      op.id.toLowerCase().includes(lowerQuery) ||
      op.name.toLowerCase().includes(lowerQuery) ||
      op.description.toLowerCase().includes(lowerQuery)
  );
}
