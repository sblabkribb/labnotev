/**
 * Sample TreeView Provider for VS Code Explorer Panel
 * Displays samples from resources/labsamples/ folder in a tree view
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { NodeFileSystem } from '@labnotev/core/node';
import { SAMPLE_TYPES, buildSampleDefSuffix } from '../lib/sampleUtils';
import { SampleRecord, loadSamplesByType, saveSamplesByType, moveSampleToGlobal as moveSampleToGlobalFn, moveSampleToLocal as moveSampleToLocalFn } from '../lib/sampleStorage';
import { refreshSampleRecordsCache } from '../providers/SampleCompletionProvider';

/** Shared Node file-system adapter for the sample JSON loaders. */
const nodeFs = new NodeFileSystem();

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
  isCustom?: boolean;  // Type node: true for user-defined custom types (enables delete menu)
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
    return `@${type};${buildSampleDefSuffix(item.alias, item.sampleDescription)}`;
  }

  // Regular sample types: include ID
  return `@${type};${item.sampleId || ''}${buildSampleDefSuffix(item.alias, item.sampleDescription)}`;
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
    // For Sample items, include scope to enable different context menus.
    // For Type items, distinguish custom types so only they expose a delete menu.
    if (itemType === SampleTreeItemType.Sample) {
      this.contextValue = `sample_${options.scope}`;  // sample_local or sample_global
    } else if (itemType === SampleTreeItemType.Type) {
      this.contextValue = options.isCustom ? 'type_custom' : 'type';
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
// Issue #18-1 hotfix: VS Code TreeView same-view drag-and-drop only routes
// drops to handleDrop when the MIME exactly matches `application/vnd.code.tree.<treeId>`,
// where <treeId> is the createTreeView viewId. Our viewId is
// `labnotev.sampleTreeView`, so the MIME must include the dot.
export const SAMPLE_TREE_DND_MIME = 'application/vnd.code.tree.labnotev.sampleTreeView';

/**
 * Subset of SampleTreeViewProvider used by the drag-and-drop controller.
 * Declared as an interface so tests can inject a stub without constructing a
 * full provider (which requires extension context + workspace folders).
 */
export interface SampleReorderProvider {
  getSampleIds(scope: 'local' | 'global', sampleType: string): Promise<string[]>;
  reorderSamples(scope: 'local' | 'global', sampleType: string, orderedIds: string[]): Promise<void>;
}

interface DragSourcePayload {
  scope: 'local' | 'global';
  sampleType: string;
  sampleId: string;
  alias: string | null;
  sampleDescription: string | null;
}

export class SampleTreeDragAndDropController
  implements vscode.TreeDragAndDropController<SampleTreeItem>
{
  readonly dropMimeTypes: readonly string[] = [SAMPLE_TREE_DND_MIME];
  readonly dragMimeTypes: readonly string[] = ['text/plain', SAMPLE_TREE_DND_MIME];

  // Issue #18-1: provider is optional so existing call sites that only need
  // the drag-out-to-editor behaviour keep working. When provided, in-tree
  // drops trigger reordering within the same scope+type bucket.
  constructor(private readonly provider?: SampleReorderProvider) {}

  public handleDrag(
    source: readonly SampleTreeItem[],
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken
  ): void {
    const samples = source.filter(item => item.itemType === SampleTreeItemType.Sample);
    if (samples.length === 0) return;

    const textPayload = samples.map(item => getDefinitionText(item)).join('\n');
    dataTransfer.set('text/plain', new vscode.DataTransferItem(textPayload));

    const structuredPayload: DragSourcePayload[] = samples.map(item => ({
      scope: item.scope,
      sampleType: item.sampleType ?? '',
      sampleId: item.sampleId ?? '',
      alias: item.alias ?? null,
      sampleDescription: item.sampleDescription ?? null,
    }));
    dataTransfer.set(SAMPLE_TREE_DND_MIME, new vscode.DataTransferItem(structuredPayload));
  }

  /**
   * Issue #18-1: reorder samples within the same scope+type bucket.
   *
   * - Source must be one or more Sample nodes in the same scope+type as the
   *   target. Drops crossing scope/type boundaries are ignored — moving
   *   between local and global still goes through the dedicated commands.
   * - Drop on a Sample target: insert source ids immediately *before* target.
   * - Drop on a Type target (or undefined): append source ids to the end.
   * - Multi-selection preserves the relative order of the source ids.
   */
  public async handleDrop(
    target: SampleTreeItem | undefined,
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken
  ): Promise<void> {
    if (!this.provider) return;

    const item = dataTransfer.get(SAMPLE_TREE_DND_MIME);
    if (!item) return;
    const raw = (item as { value: unknown }).value;
    if (!Array.isArray(raw) || raw.length === 0) return;
    const sources = raw as DragSourcePayload[];

    // All sources must share scope+type, and that bucket must match the drop
    // target's bucket. Otherwise reordering does not make sense; bail out.
    const first = sources[0];
    if (!first || !first.sampleType || !first.scope) return;
    const bucketScope = first.scope;
    const bucketType = first.sampleType;
    const sameBucket = sources.every(s => s.scope === bucketScope && s.sampleType === bucketType);
    if (!sameBucket) return;

    if (target) {
      if (target.itemType === SampleTreeItemType.Sample) {
        if (target.scope !== bucketScope || target.sampleType !== bucketType) return;
      } else if (target.itemType === SampleTreeItemType.Type) {
        if (target.scope !== bucketScope || target.sampleType !== bucketType) return;
      } else {
        return;
      }
    }

    const sourceIds = sources.map(s => s.sampleId).filter((id): id is string => Boolean(id));
    if (sourceIds.length === 0) return;

    const currentIds = await this.provider.getSampleIds(bucketScope, bucketType);
    const sourceSet = new Set(sourceIds);
    const remaining = currentIds.filter(id => !sourceSet.has(id));

    let insertAt: number;
    if (target && target.itemType === SampleTreeItemType.Sample && target.sampleId) {
      const idx = remaining.indexOf(target.sampleId);
      insertAt = idx === -1 ? remaining.length : idx;
    } else {
      insertAt = remaining.length;
    }

    const orderedIds = [
      ...remaining.slice(0, insertAt),
      ...sourceIds,
      ...remaining.slice(insertAt),
    ];

    // No-op if order is unchanged.
    const sameOrder =
      orderedIds.length === currentIds.length &&
      orderedIds.every((id, i) => id === currentIds[i]);
    if (sameOrder) return;

    await this.provider.reorderSamples(bucketScope, bucketType, orderedIds);
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
    // The completion provider caches sample records in-memory (no more mtime
    // polling). Every tree mutation and the save-time sync route through
    // refresh(), so invalidating here keeps `@id` completions consistent with
    // what the tree shows after add/edit/delete/move/reorder and document save.
    refreshSampleRecordsCache();
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
  private async getTypeItems(scope: 'local' | 'global'): Promise<SampleTreeItem[]> {
    const folder = scope === 'local' ? this.localFolder : this.globalFolder;

    return Promise.all(this.getAllTypes().map(async type => {
      const samples = await this.loadSamples(folder, type);
      const count = Object.keys(samples).length;
      const isCustom = !(SAMPLE_TYPES as readonly string[]).includes(type);
      return new SampleTreeItem(
        `${type} [${count}]`,
        SampleTreeItemType.Type,
        { scope, sampleType: type, isCustom }
      );
    }));
  }

  /**
   * Get sample items for a type
   */
  private async getSampleItems(scope: 'local' | 'global', sampleType: string): Promise<SampleTreeItem[]> {
    const folder = scope === 'local' ? this.localFolder : this.globalFolder;
    const samples = await this.loadSamples(folder, sampleType);
    const entries = Object.entries(samples);

    // Phase B-4: keep a single neutral placeholder so an empty type node
    // doesn't look broken when expanded. The earlier scope-specific hints
    // (e.g. "right-click → Create Sample") implied actions that are not
    // discoverable from the empty-state row itself, so we use a plain label.
    if (entries.length === 0) {
      return [
        new SampleTreeItem(vscode.l10n.t('No samples'), SampleTreeItemType.Detail, {
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
    const noneLabel = vscode.l10n.t('(none)');

    items.push(new SampleTreeItem(
      `alias: ${sample.alias || noneLabel}`,
      SampleTreeItemType.Detail,
      { scope: sample.scope, sampleType: sample.sampleType, sampleId: sample.sampleId }
    ));

    items.push(new SampleTreeItem(
      `description: ${sample.sampleDescription || noneLabel}`,
      SampleTreeItemType.Detail,
      { scope: sample.scope, sampleType: sample.sampleType, sampleId: sample.sampleId }
    ));

    return items;
  }

  /**
   * Load samples from JSON file. Missing folders/files resolve to `{}` inside
   * the loader, so no existence pre-check is needed.
   */
  private loadSamples(folder: string, type: string): Promise<Record<string, SampleRecord>> {
    return loadSamplesByType(nodeFs, folder, type);
  }

  /**
   * Save samples to JSON file. The adapter creates parent directories on
   * demand and owns atomicity.
   */
  private saveSamples(folder: string, type: string, samples: Record<string, SampleRecord>): Promise<void> {
    return saveSamplesByType(nodeFs, folder, type, samples);
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
    const samples = await this.loadSamples(folder, sampleType);

    samples[sampleId] = {
      type: sampleType,
      alias,
      descriptions: description ? [description] : [],
      sources: [],
    };

    await this.saveSamples(folder, sampleType, samples);
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
    const samples = await this.loadSamples(folder, sampleType);

    if (samples[sampleId]) {
      delete samples[sampleId];
      await this.saveSamples(folder, sampleType, samples);
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
    const samples = await this.loadSamples(folder, sampleType);

    if (samples[sampleId]) {
      samples[sampleId].alias = alias;
      // Phase A-5: the edit dialog pre-fills the current description and
      // represents the user's latest intent, so we *overwrite* instead of
      // prepending. Otherwise repeated edits accumulate stale descriptions
      // and the InfoPanel/TreeView keep showing a history list the user
      // cannot clear. Clearing the field also clears the array now.
      samples[sampleId].descriptions = description ? [description] : [];
      await this.saveSamples(folder, sampleType, samples);
      this.refresh();
    }
  }

  /**
   * Issue #18-1: list the current sample ids for a scope+type bucket, in the
   * order they appear in the underlying JSON file. Used by the drag-and-drop
   * controller to compute a new key order before persisting it.
   */
  public async getSampleIds(scope: 'local' | 'global', sampleType: string): Promise<string[]> {
    const folder = scope === 'local' ? this.localFolder : this.globalFolder;
    const samples = await this.loadSamples(folder, sampleType);
    return Object.keys(samples);
  }

  /**
   * Return the `sources` array (markdown basenames) recorded for a sample.
   * Used by `editSample` to locate the document that contains the
   * `@type;id;...` definition when the active webview's text does not match.
   * Returns `undefined` if the (scope, type, id) record is absent.
   */
  public async getSampleSources(
    scope: 'local' | 'global',
    sampleType: string,
    sampleId: string
  ): Promise<string[] | undefined> {
    const folder = scope === 'local' ? this.localFolder : this.globalFolder;
    const samples = await this.loadSamples(folder, sampleType);
    const rec = samples[sampleId];
    return rec ? rec.sources : undefined;
  }

  /**
   * Issue #18-1: persist a user-defined sample order for a scope+type bucket.
   *
   * The JSON file is rewritten with keys in `orderedIds` order. Any existing
   * ids that were omitted from `orderedIds` (e.g. because they were added
   * concurrently) are appended at the end so we never silently drop data.
   */
  public async reorderSamples(
    scope: 'local' | 'global',
    sampleType: string,
    orderedIds: string[]
  ): Promise<void> {
    const folder = scope === 'local' ? this.localFolder : this.globalFolder;
    const samples = await this.loadSamples(folder, sampleType);

    const reordered: Record<string, SampleRecord> = {};
    for (const id of orderedIds) {
      if (samples[id]) {
        reordered[id] = samples[id];
      }
    }
    for (const id of Object.keys(samples)) {
      if (!reordered[id]) {
        reordered[id] = samples[id];
      }
    }

    await this.saveSamples(folder, sampleType, reordered);
    this.refresh();
  }

  /**
   * Move a sample from local to global folder
   */
  public async moveSampleToGlobal(sampleType: string, sampleId: string): Promise<void> {
    const localSamples = await this.loadSamples(this.localFolder, sampleType);
    const globalSamples = await this.loadSamples(this.globalFolder, sampleType);
    
    const { newLocalDb, newGlobalDb } = moveSampleToGlobalFn(
      sampleId, 
      sampleType, 
      { [sampleType]: localSamples },
      { [sampleType]: globalSamples }
    );
    
    await this.saveSamples(this.localFolder, sampleType, newLocalDb[sampleType] || {});
    await this.saveSamples(this.globalFolder, sampleType, newGlobalDb[sampleType] || {});
    this.refresh();
  }

  /**
   * Move a sample from global to local folder
   */
  public async moveSampleToLocal(sampleType: string, sampleId: string): Promise<void> {
    const localSamples = await this.loadSamples(this.localFolder, sampleType);
    const globalSamples = await this.loadSamples(this.globalFolder, sampleType);
    
    const { newLocalDb, newGlobalDb } = moveSampleToLocalFn(
      sampleId, 
      sampleType, 
      { [sampleType]: localSamples },
      { [sampleType]: globalSamples }
    );
    
    await this.saveSamples(this.localFolder, sampleType, newLocalDb[sampleType] || {});
    await this.saveSamples(this.globalFolder, sampleType, newGlobalDb[sampleType] || {});
    this.refresh();
  }

  /**
   * Get all samples for search (QuickPick)
   * Returns flat list of all samples from both local and global folders
   */
  public async getAllSamplesForSearch(): Promise<Array<{
    sampleId: string;
    sampleType: string;
    alias: string | null;
    description: string | null;
    scope: 'local' | 'global';
  }>> {
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
        const samples = await this.loadSamples(folder, type);
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
