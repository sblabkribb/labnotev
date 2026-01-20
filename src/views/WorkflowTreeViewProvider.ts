/**
 * Workflow TreeView Provider
 * Displays workflows and unit operations in VS Code Activity Bar
 */

import * as vscode from 'vscode';
import {
  loadWorkflows,
  loadUnitOperations,
  groupWorkflowsByCategory,
  ensureWorkflowResources,
  WorkflowItem,
  UnitOperationItem,
} from '../lib/workflowDataLoader';

/**
 * Tree item types
 */
export enum WorkflowTreeItemType {
  WorkflowRoot = 'workflowRoot',
  Category = 'category',
  Workflow = 'workflow',
  UnitOpRoot = 'unitOpRoot',
  UnitOperation = 'unitOperation',
}

/**
 * Options for creating WorkflowTreeItem
 */
export interface WorkflowTreeItemOptions {
  category?: string;
  workflowId?: string;
  workflowName?: string;
  workflowDescription?: string;
  opId?: string;
  opName?: string;
  opDescription?: string;
  opType?: 'hw' | 'sw';
  equipment?: string;
  software?: string;
}

/**
 * Format workflow label
 */
export function formatWorkflowLabel(id: string, name: string): string {
  return `${id}: ${name}`;
}

/**
 * Format unit operation label
 */
export function formatUnitOpLabel(id: string, name: string): string {
  return `${id}: ${name}`;
}

/**
 * Get workflow insert text for README checklist
 */
export function getWorkflowInsertText(
  id: string,
  name: string,
  sequence: string
): string {
  return `- [ ] [${sequence}_${id}_${name.replace(/\s+/g, '_')}.md](${sequence}_${id}_${name.replace(/\s+/g, '_')}.md)`;
}

/**
 * Get unit operation insert text for workflow MD file
 */
export function getUnitOpInsertText(
  id: string,
  name: string,
  equipmentOrSoftware: string,
  description: string
): string {
  const header = `### ${id}: ${name}`;
  const eqOrSw = id.startsWith('UHW') 
    ? `**Equipment:** ${equipmentOrSoftware}`
    : `**Software:** ${equipmentOrSoftware}`;
  
  return `${header}

${eqOrSw}

**Description:** ${description}

#### Input
- 

#### Output
- 

#### Notes
- 

---
`;
}

/**
 * TreeItem class for workflow/unit operation tree
 */
export class WorkflowTreeItem extends vscode.TreeItem {
  public readonly itemType: WorkflowTreeItemType;
  public readonly category?: string;
  public readonly workflowId?: string;
  public readonly workflowName?: string;
  public readonly workflowDescription?: string;
  public readonly opId?: string;
  public readonly opName?: string;
  public readonly opDescription?: string;
  public readonly opType?: 'hw' | 'sw';
  public readonly equipment?: string;
  public readonly software?: string;

  constructor(
    label: string,
    itemType: WorkflowTreeItemType,
    collapsibleState: vscode.TreeItemCollapsibleState,
    options?: WorkflowTreeItemOptions
  ) {
    super(label, collapsibleState);
    this.itemType = itemType;

    if (options) {
      this.category = options.category;
      this.workflowId = options.workflowId;
      this.workflowName = options.workflowName;
      this.workflowDescription = options.workflowDescription;
      this.opId = options.opId;
      this.opName = options.opName;
      this.opDescription = options.opDescription;
      this.opType = options.opType;
      this.equipment = options.equipment;
      this.software = options.software;
    }

    // Set context value for menu contributions
    this.contextValue = this.getContextValue();

    // Set icon
    this.iconPath = this.getIcon();

    // Set tooltip
    this.tooltip = this.getTooltip();
  }

  private getContextValue(): string {
    switch (this.itemType) {
      case WorkflowTreeItemType.WorkflowRoot:
        return 'workflowRoot';
      case WorkflowTreeItemType.Category:
        return 'category';
      case WorkflowTreeItemType.Workflow:
        return 'workflow';
      case WorkflowTreeItemType.UnitOpRoot:
        return 'unitOpRoot';
      case WorkflowTreeItemType.UnitOperation:
        return 'unitOperation';
      default:
        return '';
    }
  }

  private getIcon(): vscode.ThemeIcon | undefined {
    switch (this.itemType) {
      case WorkflowTreeItemType.WorkflowRoot:
        return new vscode.ThemeIcon('symbol-class');
      case WorkflowTreeItemType.Category:
        return new vscode.ThemeIcon('folder');
      case WorkflowTreeItemType.Workflow:
        return new vscode.ThemeIcon('file');
      case WorkflowTreeItemType.UnitOpRoot:
        return new vscode.ThemeIcon('symbol-method');
      case WorkflowTreeItemType.UnitOperation:
        return new vscode.ThemeIcon('symbol-function');
      default:
        return undefined;
    }
  }

  private getTooltip(): string {
    if (this.workflowDescription) {
      return this.workflowDescription;
    }
    if (this.opDescription) {
      const extra = this.equipment ? `\nEquipment: ${this.equipment}` : 
                    this.software ? `\nSoftware: ${this.software}` : '';
      return `${this.opDescription}${extra}`;
    }
    return this.label as string;
  }
}

/**
 * TreeDataProvider for workflows and unit operations
 */
export class WorkflowTreeViewProvider implements vscode.TreeDataProvider<WorkflowTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<WorkflowTreeItem | undefined | null | void> = 
    new vscode.EventEmitter<WorkflowTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<WorkflowTreeItem | undefined | null | void> = 
    this._onDidChangeTreeData.event;

  private extensionPath: string;
  private workspaceRoot: string;
  private workflows: WorkflowItem[] = [];
  private hwUnitOps: UnitOperationItem[] = [];
  private swUnitOps: UnitOperationItem[] = [];

  constructor(extensionPath: string, workspaceRoot: string) {
    this.extensionPath = extensionPath;
    this.workspaceRoot = workspaceRoot;
    this.loadData();
  }

  /**
   * Load data from JSON files
   */
  private loadData(): void {
    try {
      // Ensure resources are copied from extension
      ensureWorkflowResources(this.extensionPath, this.workspaceRoot);

      // Load workflows
      const workflowData = loadWorkflows(this.workspaceRoot);
      this.workflows = workflowData.workflows;

      // Load unit operations
      const hwData = loadUnitOperations(this.workspaceRoot, 'hw');
      this.hwUnitOps = hwData.unitOperations;

      const swData = loadUnitOperations(this.workspaceRoot, 'sw');
      this.swUnitOps = swData.unitOperations;
    } catch (error) {
      console.error('[WorkflowTreeViewProvider] Error loading data:', error);
    }
  }

  /**
   * Refresh the tree view
   */
  refresh(): void {
    this.loadData();
    this._onDidChangeTreeData.fire();
  }

  /**
   * Update workspace root
   */
  updateWorkspaceRoot(workspaceRoot: string): void {
    this.workspaceRoot = workspaceRoot;
    this.refresh();
  }

  getTreeItem(element: WorkflowTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: WorkflowTreeItem): Promise<WorkflowTreeItem[]> {
    if (!element) {
      // Return root items
      return this.getRootItems();
    }

    switch (element.itemType) {
      case WorkflowTreeItemType.WorkflowRoot:
        return this.getCategoryItems();
      case WorkflowTreeItemType.Category:
        return this.getWorkflowItems(element.category!);
      case WorkflowTreeItemType.UnitOpRoot:
        return this.getUnitOpItems(element.opType!);
      default:
        return [];
    }
  }

  /**
   * Get root items (Workflows, HW Unit Ops, SW Unit Ops)
   */
  private getRootItems(): WorkflowTreeItem[] {
    return [
      new WorkflowTreeItem(
        `Workflows [${this.workflows.length}]`,
        WorkflowTreeItemType.WorkflowRoot,
        vscode.TreeItemCollapsibleState.Expanded
      ),
      new WorkflowTreeItem(
        `HW Unit Operations [${this.hwUnitOps.length}]`,
        WorkflowTreeItemType.UnitOpRoot,
        vscode.TreeItemCollapsibleState.Collapsed,
        { opType: 'hw' }
      ),
      new WorkflowTreeItem(
        `SW Unit Operations [${this.swUnitOps.length}]`,
        WorkflowTreeItemType.UnitOpRoot,
        vscode.TreeItemCollapsibleState.Collapsed,
        { opType: 'sw' }
      ),
    ];
  }

  /**
   * Get category items (Design, Build, Test, Learn)
   */
  private getCategoryItems(): WorkflowTreeItem[] {
    const grouped = groupWorkflowsByCategory(this.workflows);
    const categories = Object.keys(grouped).sort((a, b) => {
      // Sort by DBTL order
      const order = ['Design', 'Build', 'Test', 'Learn'];
      return order.indexOf(a) - order.indexOf(b);
    });

    return categories.map(category => {
      const count = grouped[category].length;
      return new WorkflowTreeItem(
        `${category} [${count}]`,
        WorkflowTreeItemType.Category,
        vscode.TreeItemCollapsibleState.Collapsed,
        { category }
      );
    });
  }

  /**
   * Get workflow items for a category
   */
  private getWorkflowItems(category: string): WorkflowTreeItem[] {
    const grouped = groupWorkflowsByCategory(this.workflows);
    const workflows = grouped[category] || [];

    return workflows.map(workflow => {
      return new WorkflowTreeItem(
        formatWorkflowLabel(workflow.id, workflow.name),
        WorkflowTreeItemType.Workflow,
        vscode.TreeItemCollapsibleState.None,
        {
          workflowId: workflow.id,
          workflowName: workflow.name,
          workflowDescription: workflow.description,
          category: workflow.category,
        }
      );
    });
  }

  /**
   * Get unit operation items
   */
  private getUnitOpItems(type: 'hw' | 'sw'): WorkflowTreeItem[] {
    const operations = type === 'hw' ? this.hwUnitOps : this.swUnitOps;

    return operations.map(op => {
      return new WorkflowTreeItem(
        formatUnitOpLabel(op.id, op.name),
        WorkflowTreeItemType.UnitOperation,
        vscode.TreeItemCollapsibleState.None,
        {
          opId: op.id,
          opName: op.name,
          opDescription: op.description,
          opType: type,
          equipment: op.equipment,
          software: op.software,
        }
      );
    });
  }

  /**
   * Get all workflows
   */
  getWorkflows(): WorkflowItem[] {
    return this.workflows;
  }

  /**
   * Get all unit operations
   */
  getUnitOperations(type: 'hw' | 'sw'): UnitOperationItem[] {
    return type === 'hw' ? this.hwUnitOps : this.swUnitOps;
  }

  /**
   * Get workspace root
   */
  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  /**
   * Get extension path
   */
  getExtensionPath(): string {
    return this.extensionPath;
  }
}
