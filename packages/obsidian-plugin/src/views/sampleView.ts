/**
 * Samples sidebar (Local + Global scopes).
 *
 * Consumes the core {@link buildSampleTree} model. The Local scope is resolved
 * from the active note's `resources/labsamples` folder, so switching notes
 * re-scopes the tree (via `active-leaf-change`); when no note is active it
 * falls back to the vault-global folder for both scopes.
 */
import { ItemView, Menu, Notice, WorkspaceLeaf } from 'obsidian';
import { buildSampleTree, type TreeNode } from '@labnotev/core';
import { getSampleDisplayMeta } from '@labnotev/core/lib/sampleUtils';
import { getLabsamplesFolder } from '@labnotev/core/lib/sampleStorage';
import type LabnotePlugin from '../main';
import { renderTree } from './treeRender';

export const SAMPLE_VIEW_TYPE = 'labnote-sample-view';

interface SamplePayload {
  scope: 'local' | 'global';
  type: string;
  id: string;
}

export class SampleTreeView extends ItemView {
  private readonly expanded = new Set<string>();
  private refreshQueued = false;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: LabnotePlugin) {
    super(leaf);
  }

  getViewType(): string {
    return SAMPLE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.plugin.t('Samples');
  }

  getIcon(): string {
    return 'test-tube';
  }

  async onOpen(): Promise<void> {
    // Re-scope Local when the active note changes.
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => this.scheduleRefresh())
    );
    // Reflect on-disk {Type}.json writes.
    this.registerEvent(
      this.app.vault.on('modify', file => {
        if (file.path.endsWith('.json') || file.path.endsWith('.labnote.md')) {
          this.scheduleRefresh();
        }
      })
    );
    await this.refresh();
  }

  /** Coalesce bursts of events into a single microtask refresh. */
  private scheduleRefresh(): void {
    if (this.refreshQueued) return;
    this.refreshQueued = true;
    window.setTimeout(() => {
      this.refreshQueued = false;
      void this.refresh();
    }, 300);
  }

  async refresh(): Promise<void> {
    const activePath = this.plugin.activeNotePath();
    const global = this.plugin.settings.globalSampleFolder;
    const local = activePath ? getLabsamplesFolder(activePath) : global;
    const types = getSampleDisplayMeta(this.plugin.settings.customSampleTypes).types;

    const nodes = await buildSampleTree(this.plugin.fs, { local, global }, types);
    renderTree(this.contentEl, nodes, {
      expanded: this.expanded,
      onContext: (node, evt) => this.onContext(node, evt),
    });
  }

  private onContext(node: TreeNode, evt: MouseEvent): void {
    if (node.kind !== 'sample') return;
    const sample = node.payload as SamplePayload;

    const menu = new Menu();
    menu.addItem(item =>
      item
        .setTitle(this.plugin.t('Copy sample ID'))
        .setIcon('copy')
        .onClick(() => {
          void navigator.clipboard.writeText(sample.id);
          new Notice(this.plugin.t('Copied: {0}', sample.id));
        })
    );
    menu.addItem(item =>
      item
        .setTitle(this.plugin.t('Insert reference at cursor'))
        .setIcon('plus')
        .onClick(() => {
          const target = this.plugin.host.editTarget();
          if (!target) {
            new Notice(this.plugin.t('Open a note to insert into.'));
            return;
          }
          void target.insertAtCursor(`@${sample.type};${sample.id}`);
        })
    );
    menu.showAtMouseEvent(evt);
  }
}
