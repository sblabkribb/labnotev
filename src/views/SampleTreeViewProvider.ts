/**
 * Sample TreeView Provider for VS Code Explorer Panel
 * Displays samples from resources/labsamples/ folder in a tree view
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SAMPLE_TYPES, SampleType } from '../lib/sampleUtils';
import { SampleRecord, loadSamplesByType, saveSamplesByType, moveSampleToGlobal as moveSampleToGlobalFn, moveSampleToLocal as moveSampleToLocalFn } from '../lib/sampleStorage';

/**
 * Tree item types
 */
export enum SampleTreeItemType {
  Root = 'root',
  Type = 'type',
  Sample = 'sample',
  Detail = 'detail',
}

/**
 * Options for creating SampleTreeItem
 */
export interface SampleTreeItemOptions {
  scope: 'local' | 'global';
  sampleType?: string;
  sampleId?: string;
  alias?: string | null;
  description?: string | null;
}

/**
 * Get collapsible state based on item type
 * Root and Type: Expanded
 * Sample: Collapsed
 * Detail: None (leaf node)
 */
export function getCollapsibleState(itemType: SampleTreeItemType): vscode.TreeItemCollapsibleState {
  switch (itemType) {
    case SampleTreeItemType.Root:
      return vscode.TreeItemCollapsibleState.Expanded;
    case SampleTreeItemType.Type:
      return vscode.TreeItemCollapsibleState.Expanded;
    case SampleTreeItemType.Sample:
      return vscode.TreeItemCollapsibleState.Collapsed;
    case SampleTreeItemType.Detail:
      return vscode.TreeItemCollapsibleState.None;
    default:
      return vscode.TreeItemCollapsibleState.None;
  }
}

/**
 * Format sample label with ID and optional alias
 */
export function formatSampleLabel(sampleId: string, alias: string | null | undefined): string {
  if (alias && alias.trim()) {
    return `${sampleId} | ${alias}`;
  }
  return sampleId;
}

/**
 * Get text to insert into editor for a sample item (reference only - ID|Alias)
 */
export function getInsertText(item: SampleTreeItem): string {
  if (item.alias && item.alias.trim()) {
    return `${item.sampleId}|${item.alias}`;
  }
  return item.sampleId || '';
}

/**
 * Get definition text to insert into editor for a sample item
 * Format: @type:ID|Alias:Description
 * For Equip type, ID is omitted: @equip:|Alias:Description
 */
export function getDefinitionText(item: SampleTreeItem): string {
  const type = item.sampleType?.toLowerCase() || '';
  
  // Equip type: ID is omitted (uses existing DB/JSON IDs only)
  if (type === 'equip') {
    let text = `@${type}:`;
    if (item.alias && item.alias.trim()) {
      text += `|${item.alias}`;
    }
    if (item.description && item.description.trim()) {
      text += `:${item.description}`;
    }
    return text;
  }
  
  // Regular sample types: include ID
  let text = `@${type}:${item.sampleId || ''}`;
  if (item.alias && item.alias.trim()) {
    text += `|${item.alias}`;
  }
  if (item.description && item.description.trim()) {
    text += `:${item.description}`;
  }
  return text;
}

/**
 * Sample TreeItem class
 */
export class SampleTreeItem extends vscode.TreeItem {
  public readonly itemType: SampleTreeItemType;
  public readonly scope: 'local' | 'global';
  public readonly sampleType?: string;
  public readonly sampleId?: string;
  public readonly alias?: string | null;
  public readonly description?: string | null;

  constructor(
    label: string,
    itemType: SampleTreeItemType,
    options: SampleTreeItemOptions
  ) {
    super(label, getCollapsibleState(itemType));
    
    this.itemType = itemType;
    this.scope = options.scope;
    this.sampleType = options.sampleType;
    this.sampleId = options.sampleId;
    this.alias = options.alias;
    this.description = options.description;

    // Set context value for menu contributions
    // For Sample items, include scope to enable different context menus
    if (itemType === SampleTreeItemType.Sample) {
      this.contextValue = `sample_${options.scope}`;  // sample_local or sample_global
    } else {
      this.contextValue = itemType;
    }

    // Set icon based on item type
    this.setIcon();

    // Set tooltip
    this.setTooltip();
  }

  private setIcon(): void {
    switch (this.itemType) {
      case SampleTreeItemType.Root:
        this.iconPath = new vscode.ThemeIcon(this.scope === 'local' ? 'folder' : 'globe');
        break;
      case SampleTreeItemType.Type:
        this.iconPath = new vscode.ThemeIcon('symbol-class');
        break;
      case SampleTreeItemType.Sample:
        this.iconPath = new vscode.ThemeIcon('beaker');
        break;
      case SampleTreeItemType.Detail:
        this.iconPath = new vscode.ThemeIcon('info');
        break;
    }
  }

  private setTooltip(): void {
    if (this.itemType === SampleTreeItemType.Sample) {
      const parts = [`ID: ${this.sampleId}`];
      if (this.alias) {
        parts.push(`Alias: ${this.alias}`);
      }
      if (this.description) {
        parts.push(`Description: ${this.description}`);
      }
      this.tooltip = parts.join('\n');
    }
  }
}

/**
 * Sample TreeView Data Provider
 */
export class SampleTreeViewProvider implements vscode.TreeDataProvider<SampleTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SampleTreeItem | undefined | null | void> = new vscode.EventEmitter<SampleTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<SampleTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private workspaceRoot: string;
  private localFolder: string;
  private globalFolder: string;

  constructor(
    private context: vscode.ExtensionContext,
    workspaceRoot: string,
    documentFolder: string
  ) {
    this.workspaceRoot = workspaceRoot;
    this.localFolder = path.join(documentFolder, 'resources', 'labsamples');
    this.globalFolder = path.join(workspaceRoot, 'resources', 'labsamples');
  }

  /**
   * Update the document folder (when active document changes)
   */
  public updateDocumentFolder(documentFolder: string): void {
    this.localFolder = path.join(documentFolder, 'resources', 'labsamples');
    this.refresh();
  }

  /**
   * Refresh the tree view
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get document folder for Local samples (parent of resources/labsamples)
   */
  public getDocumentFolder(): string {
    return path.dirname(path.dirname(this.localFolder));
  }

  /**
   * Get Local labsamples folder path
   */
  public getLocalFolder(): string {
    return this.localFolder;
  }

  /**
   * Get Global labsamples folder path
   */
  public getGlobalFolder(): string {
    return this.globalFolder;
  }

  /**
   * Get tree item for display
   */
  getTreeItem(element: SampleTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children for tree node
   */
  async getChildren(element?: SampleTreeItem): Promise<SampleTreeItem[]> {
    if (!element) {
      // Root level: return Local and Global folders
      return this.getRootItems();
    }

    switch (element.itemType) {
      case SampleTreeItemType.Root:
        return this.getTypeItems(element.scope);
      case SampleTreeItemType.Type:
        return this.getSampleItems(element.scope, element.sampleType!);
      case SampleTreeItemType.Sample:
        return this.getDetailItems(element);
      default:
        return [];
    }
  }

  /**
   * Get root items (Local and Global)
   */
  private getRootItems(): SampleTreeItem[] {
    return [
      new SampleTreeItem('Samples (Local)', SampleTreeItemType.Root, { scope: 'local' }),
      new SampleTreeItem('Samples (Global)', SampleTreeItemType.Root, { scope: 'global' }),
    ];
  }

  /**
   * Get type items (DNA, RNA, etc.) for a scope
   */
  private getTypeItems(scope: 'local' | 'global'): SampleTreeItem[] {
    const folder = scope === 'local' ? this.localFolder : this.globalFolder;
    
    return SAMPLE_TYPES.map(type => {
      const samples = this.loadSamples(folder, type);
      const count = Object.keys(samples).length;
      return new SampleTreeItem(
        `${type} [${count}]`,
        SampleTreeItemType.Type,
        { scope, sampleType: type }
      );
    });
  }

  /**
   * Get sample items for a type
   */
  private getSampleItems(scope: 'local' | 'global', sampleType: string): SampleTreeItem[] {
    const folder = scope === 'local' ? this.localFolder : this.globalFolder;
    const samples = this.loadSamples(folder, sampleType);

    return Object.entries(samples).map(([id, record]) => {
      const label = formatSampleLabel(id, record.alias);
      return new SampleTreeItem(
        label,
        SampleTreeItemType.Sample,
        {
          scope,
          sampleType,
          sampleId: id,
          alias: record.alias,
          description: record.descriptions?.[0] || null,
        }
      );
    });
  }

  /**
   * Get detail items for a sample (alias, description)
   */
  private getDetailItems(sample: SampleTreeItem): SampleTreeItem[] {
    const items: SampleTreeItem[] = [];

    items.push(new SampleTreeItem(
      `alias: ${sample.alias || '(없음)'}`,
      SampleTreeItemType.Detail,
      { scope: sample.scope, sampleType: sample.sampleType, sampleId: sample.sampleId }
    ));

    items.push(new SampleTreeItem(
      `description: ${sample.description || '(없음)'}`,
      SampleTreeItemType.Detail,
      { scope: sample.scope, sampleType: sample.sampleType, sampleId: sample.sampleId }
    ));

    return items;
  }

  /**
   * Load samples from JSON file
   */
  private loadSamples(folder: string, type: string): Record<string, SampleRecord> {
    if (!fs.existsSync(folder)) {
      return {};
    }
    return loadSamplesByType(folder, type);
  }

  /**
   * Save samples to JSON file
   */
  private saveSamples(folder: string, type: string, samples: Record<string, SampleRecord>): void {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    saveSamplesByType(folder, type, samples);
  }

  /**
   * Add a new sample
   */
  public async addSample(
    scope: 'local' | 'global',
    sampleType: string,
    sampleId: string,
    alias: string | null,
    description: string | null
  ): Promise<void> {
    const folder = scope === 'local' ? this.localFolder : this.globalFolder;
    const samples = this.loadSamples(folder, sampleType);

    samples[sampleId] = {
      type: sampleType,
      alias,
      descriptions: description ? [description] : [],
      sources: [],
    };

    this.saveSamples(folder, sampleType, samples);
    this.refresh();
  }

  /**
   * Delete a sample
   */
  public async deleteSample(
    scope: 'local' | 'global',
    sampleType: string,
    sampleId: string
  ): Promise<void> {
    const folder = scope === 'local' ? this.localFolder : this.globalFolder;
    const samples = this.loadSamples(folder, sampleType);

    if (samples[sampleId]) {
      delete samples[sampleId];
      this.saveSamples(folder, sampleType, samples);
      this.refresh();
    }
  }

  /**
   * Edit a sample
   */
  public async editSample(
    scope: 'local' | 'global',
    sampleType: string,
    sampleId: string,
    alias: string | null,
    description: string | null
  ): Promise<void> {
    const folder = scope === 'local' ? this.localFolder : this.globalFolder;
    const samples = this.loadSamples(folder, sampleType);

    if (samples[sampleId]) {
      samples[sampleId].alias = alias;
      if (description) {
        if (!samples[sampleId].descriptions.includes(description)) {
          samples[sampleId].descriptions = [description, ...samples[sampleId].descriptions];
        }
      }
      this.saveSamples(folder, sampleType, samples);
      this.refresh();
    }
  }

  /**
   * Move a sample from local to global folder
   */
  public async moveSampleToGlobal(sampleType: string, sampleId: string): Promise<void> {
    const localSamples = this.loadSamples(this.localFolder, sampleType);
    const globalSamples = this.loadSamples(this.globalFolder, sampleType);
    
    const { newLocalDb, newGlobalDb } = moveSampleToGlobalFn(
      sampleId, 
      sampleType, 
      { [sampleType]: localSamples },
      { [sampleType]: globalSamples }
    );
    
    this.saveSamples(this.localFolder, sampleType, newLocalDb[sampleType] || {});
    this.saveSamples(this.globalFolder, sampleType, newGlobalDb[sampleType] || {});
    this.refresh();
  }

  /**
   * Move a sample from global to local folder
   */
  public async moveSampleToLocal(sampleType: string, sampleId: string): Promise<void> {
    const localSamples = this.loadSamples(this.localFolder, sampleType);
    const globalSamples = this.loadSamples(this.globalFolder, sampleType);
    
    const { newLocalDb, newGlobalDb } = moveSampleToLocalFn(
      sampleId, 
      sampleType, 
      { [sampleType]: localSamples },
      { [sampleType]: globalSamples }
    );
    
    this.saveSamples(this.localFolder, sampleType, newLocalDb[sampleType] || {});
    this.saveSamples(this.globalFolder, sampleType, newGlobalDb[sampleType] || {});
    this.refresh();
  }

  /**
   * Get all samples for search (QuickPick)
   * Returns flat list of all samples from both local and global folders
   */
  public getAllSamplesForSearch(): Array<{
    sampleId: string;
    sampleType: string;
    alias: string | null;
    description: string | null;
    scope: 'local' | 'global';
  }> {
    const results: Array<{
      sampleId: string;
      sampleType: string;
      alias: string | null;
      description: string | null;
      scope: 'local' | 'global';
    }> = [];

    const scopes: Array<{ scope: 'local' | 'global'; folder: string }> = [
      { scope: 'local', folder: this.localFolder },
      { scope: 'global', folder: this.globalFolder },
    ];

    for (const { scope, folder } of scopes) {
      for (const type of SAMPLE_TYPES) {
        const samples = this.loadSamples(folder, type);
        for (const [id, record] of Object.entries(samples)) {
          results.push({
            sampleId: id,
            sampleType: type,
            alias: record.alias,
            description: record.descriptions?.[0] || null,
            scope,
          });
        }
      }
    }

    return results;
  }
}
