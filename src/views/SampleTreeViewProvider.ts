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
  sampleDescription?: string | null;  // Renamed to avoid conflict with TreeItem.description
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
 * Get text to insert into editor for a sample item (reference only - ID;Alias)
 */
export function getInsertText(item: SampleTreeItem): string {
  if (item.alias && item.alias.trim()) {
    return `${item.sampleId};${item.alias}`;
  }
  return item.sampleId || '';
}

/**
 * Get definition text to insert into editor for a sample item
 * Format: @type;ID;Alias;Description
 * For Equip type, ID is omitted: @equip;;Alias;Description
 */
export function getDefinitionText(item: SampleTreeItem): string {
  const type = item.sampleType?.toLowerCase() || '';
  
  // Equip type: ID is omitted (uses existing DB/JSON IDs only)
  if (type === 'equip') {
    let text = `@${type};`;
    if (item.alias && item.alias.trim()) {
      text += `;${item.alias}`;
    }
    if (item.sampleDescription && item.sampleDescription.trim()) {
      text += `;${item.sampleDescription}`;
    }
    return text;
  }

  // Regular sample types: include ID
  let text = `@${type};${item.sampleId || ''}`;
  if (item.alias && item.alias.trim()) {
    text += `;${item.alias}`;
  }
  if (item.sampleDescription && item.sampleDescription.trim()) {
    text += `;${item.sampleDescription}`;
  }
  return text;
}

/**
 * Phase B-4: Map a sample type to a VS Code ThemeColor id. We reuse the
 * standard chart palette rather than inventing new ids so the icons respect
 * the user's color theme. Unknown types fall back to the default icon color.
 */
function sampleTreeIconColor(sampleType: string | undefined): string | undefined {
  if (!sampleType) return undefined;
  const palette: Record<string, string> = {
    DNA: 'charts.pink',
    RNA: 'charts.blue',
    Plasmid: 'charts.yellow',
    Reagent: 'charts.purple',
    Primer: 'charts.green',
    Protein: 'charts.orange',
    Equip: 'charts.foreground',
    Labware: 'charts.lines',
  };
  return palette[sampleType];
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
  public readonly sampleDescription?: string | null;  // Renamed to avoid conflict with TreeItem.description

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
    this.sampleDescription = options.sampleDescription;

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
      case SampleTreeItemType.Type: {
        // Phase B-4: per-type ThemeIcon colors mirror the webview overlay so
        // the TreeView and the editor highlight the same sample type with the
        // same visual signal.
        const color = sampleTreeIconColor(this.sampleType);
        this.iconPath = color
          ? new vscode.ThemeIcon('symbol-class', new vscode.ThemeColor(color))
          : new vscode.ThemeIcon('symbol-class');
        break;
      }
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
      if (this.sampleDescription) {
        parts.push(`Description: ${this.sampleDescription}`);
      }
      this.tooltip = parts.join('\n');
    }
  }
}

/**
 * Phase D-3: Drag-and-drop controller for the Samples tree view.
 *
 * Users can drag a Sample leaf node into any open text editor to insert its
 * `@type;id;alias;description` definition. We advertise `text/plain` so VS
 * Code's editor drop target accepts the payload natively; we also publish a
 * labnotev-specific mime type so future in-tree drag targets (e.g. dropping
 * between local/global) can round-trip richer metadata.
 *
 * Only `Sample` items emit a payload — dragging a root/type/detail node is a
 * no-op, which keeps the UX predictable.
 */
export const SAMPLE_TREE_DND_MIME = 'application/vnd.code.tree.labnotevsampletreeview';

export class SampleTreeDragAndDropController
  implements vscode.TreeDragAndDropController<SampleTreeItem>
{
  readonly dropMimeTypes: readonly string[] = [SAMPLE_TREE_DND_MIME];
  readonly dragMimeTypes: readonly string[] = ['text/plain', SAMPLE_TREE_DND_MIME];

  public handleDrag(
    source: readonly SampleTreeItem[],
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken
  ): void {
    const samples = source.filter(item => item.itemType === SampleTreeItemType.Sample);
    if (samples.length === 0) return;

    const textPayload = samples.map(item => getDefinitionText(item)).join('\n');
    dataTransfer.set('text/plain', new vscode.DataTransferItem(textPayload));

    const structuredPayload = samples.map(item => ({
      scope: item.scope,
      sampleType: item.sampleType,
      sampleId: item.sampleId,
      alias: item.alias ?? null,
      sampleDescription: item.sampleDescription ?? null,
    }));
    dataTransfer.set(SAMPLE_TREE_DND_MIME, new vscode.DataTransferItem(structuredPayload));
  }

  /**
   * Internal drops (inside the tree view) are not meaningful yet — moving a
   * sample between local/global is handled by dedicated commands. We keep the
   * handler so VS Code can still show the drop affordance; it intentionally
   * performs no mutation.
   */
  public handleDrop(): void {
    // no-op
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

  private getAllTypes(): string[] {
    const custom = vscode.workspace.getConfiguration('labnotev')
      .get<string[]>('customSampleTypes', []);
    return [...SAMPLE_TYPES, ...custom.filter(t => !(SAMPLE_TYPES as readonly string[]).includes(t))];
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
    
    return this.getAllTypes().map(type => {
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
    const entries = Object.entries(samples);

    // Phase B-4: expose an empty-state Detail row so the user sees a clear
    // "샘플 없음" placeholder and a hint for adding one, rather than a silent
    // blank section that makes the TreeView look broken.
    if (entries.length === 0) {
      const hint = scope === 'local'
        ? '샘플 없음 — 마우스 오른쪽 버튼 → "샘플 생성"'
        : '샘플 없음 — 문서에서 @type;id 정의를 저장하면 자동 등록됩니다';
      return [
        new SampleTreeItem(hint, SampleTreeItemType.Detail, {
          scope,
          sampleType,
        }),
      ];
    }

    return entries.map(([id, record]) => {
      const label = formatSampleLabel(id, record.alias);
      return new SampleTreeItem(
        label,
        SampleTreeItemType.Sample,
        {
          scope,
          sampleType,
          sampleId: id,
          alias: record.alias,
          sampleDescription: record.descriptions?.[0] || null,
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
      `description: ${sample.sampleDescription || '(없음)'}`,
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
      // Phase A-5: the edit dialog pre-fills the current description and
      // represents the user's latest intent, so we *overwrite* instead of
      // prepending. Otherwise repeated edits accumulate stale descriptions
      // and the InfoPanel/TreeView keep showing a history list the user
      // cannot clear. Clearing the field also clears the array now.
      samples[sampleId].descriptions = description ? [description] : [];
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
      for (const type of this.getAllTypes()) {
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
