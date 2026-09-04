/**
 * Labnote Assistant — Obsidian plugin entry point.
 *
 * This is the skeleton: it wires the platform-neutral pieces from
 * `@labnotev/core` (file-system port, translator) into Obsidian and registers a
 * couple of proof-of-wiring commands. Domain commands, sample suggestions, CM6
 * highlighting, sidebar views, the settings tab and the LLM/MCP layer are added
 * by subsequent modules that all consume the same `LabnoteHost` built here.
 */
import { Plugin, MarkdownView, Notice, TFile } from 'obsidian';
import type { LabnoteHost, Translator } from '@labnotev/core';
import { getSeoulDateString, getSeoulDateTimeString } from '@labnotev/core/lib/dateUtils';
import { getSampleDisplayMeta } from '@labnotev/core/lib/sampleUtils';
import { saveSamplesFromDocument } from '@labnotev/core/lib/sampleStorage';
import { VaultFileSystem } from './vaultFileSystem';
import { createObsidianTranslator } from './i18n';
import { createObsidianHost } from './obsidianHost';
import {
  createExperimentCommand,
  createWorkflowCommand,
  insertUnitOperationCommand,
} from './commands';
import { SampleEditorSuggest } from './sampleSuggest';
import {
  createSampleHighlightPlugin,
  createSampleReadingHighlighter,
  type HighlightState,
} from './sampleHighlight';
import { WorkflowTreeView, WORKFLOW_VIEW_TYPE } from './views/workflowView';
import { SampleTreeView, SAMPLE_VIEW_TYPE } from './views/sampleView';
import { exportTablesToCsv, exportActiveNoteTablesToCsv } from './exportCsv';
import { LabnoteSettingTab } from './settingsTab';
import {
  draftMethodCommand,
  summarizeResultsCommand,
  extractSamplesCommand,
} from './llm/commands';
import { LabnoteMcpServer } from './llm/mcpServer';
import { DEFAULT_SETTINGS, type LabnoteSettings } from './settings';

export default class LabnotePlugin extends Plugin {
  // `Plugin` already declares `settings?: unknown`; re-type it concretely.
  declare settings: LabnoteSettings;
  fs!: VaultFileSystem;
  t!: Translator;
  host!: LabnoteHost;
  mcpServer!: LabnoteMcpServer;
  private readonly sampleSyncTimers = new Map<string, number>();

  async onload(): Promise<void> {
    await this.loadSettings();
    this.fs = new VaultFileSystem(this.app.vault.adapter);
    this.t = createObsidianTranslator();
    this.host = createObsidianHost(this.app, this.fs, this.t);
    this.mcpServer = new LabnoteMcpServer(this);

    this.registerCommands();
    this.registerSampleFeatures();
    this.registerViews();
    this.registerFileMenu();
    this.addSettingTab(new LabnoteSettingTab(this.app, this));

    if (this.settings.mcpEnabled) {
      // Defer to layout-ready so we don't block plugin init on the listener.
      this.app.workspace.onLayoutReady(() => this.mcpServer.start());
    }
  }

  onunload(): void {
    this.mcpServer?.stop();
    // Views/events registered via this.register*() are auto-cleaned by Obsidian.
  }

  private registerCommands(): void {
    this.addCommand({
      id: 'insert-date',
      name: this.t('Insert date'),
      editorCallback: editor => {
        editor.replaceSelection(getSeoulDateString());
      },
    });

    this.addCommand({
      id: 'insert-datetime',
      name: this.t('Insert date and time'),
      editorCallback: editor => {
        editor.replaceSelection(getSeoulDateTimeString());
      },
    });

    this.addCommand({
      id: 'create-experiment',
      name: this.t('Create experiment'),
      callback: () => void createExperimentCommand(this.app, this.host),
    });

    this.addCommand({
      id: 'create-workflow',
      name: this.t('Create workflow'),
      callback: () => void createWorkflowCommand(this.app, this.host),
    });

    this.addCommand({
      id: 'insert-unit-operation',
      name: this.t('Insert unit operation'),
      callback: () => void insertUnitOperationCommand(this.app, this.host),
    });

    this.addCommand({
      id: 'export-tables-csv',
      name: this.t('Export tables to CSV'),
      callback: () => void exportActiveNoteTablesToCsv(this),
    });

    // --- AI commands ---
    this.addCommand({
      id: 'ai-draft-method',
      name: this.t('AI: Draft Method section'),
      callback: () => void draftMethodCommand(this),
    });
    this.addCommand({
      id: 'ai-summarize-results',
      name: this.t('AI: Summarize results'),
      callback: () => void summarizeResultsCommand(this),
    });
    this.addCommand({
      id: 'ai-extract-samples',
      name: this.t('AI: Extract sample definitions'),
      callback: () => void extractSamplesCommand(this),
    });

    this.addCommand({
      id: 'toggle-mcp-server',
      name: this.t('Toggle MCP server'),
      callback: () => {
        if (this.mcpServer.running) this.mcpServer.stop();
        else this.mcpServer.start();
      },
    });
  }

  /** Right-click a markdown note → export its tables to CSV. */
  private registerFileMenu(): void {
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (!(file instanceof TFile) || file.extension !== 'md') return;
        menu.addItem(item =>
          item
            .setTitle(this.t('Export tables to CSV'))
            .setIcon('table')
            .onClick(() => void exportTablesToCsv(this, file))
        );
      })
    );
  }

  /** Register the two sidebar views + commands/ribbon to open them. */
  private registerViews(): void {
    this.registerView(WORKFLOW_VIEW_TYPE, leaf => new WorkflowTreeView(leaf, this));
    this.registerView(SAMPLE_VIEW_TYPE, leaf => new SampleTreeView(leaf, this));

    this.addRibbonIcon('box', this.t('Workflows'), () => void this.activateView(WORKFLOW_VIEW_TYPE));
    this.addRibbonIcon('test-tube', this.t('Samples'), () => void this.activateView(SAMPLE_VIEW_TYPE));

    this.addCommand({
      id: 'open-workflow-view',
      name: this.t('Open workflow view'),
      callback: () => void this.activateView(WORKFLOW_VIEW_TYPE),
    });
    this.addCommand({
      id: 'open-sample-view',
      name: this.t('Open sample view'),
      callback: () => void this.activateView(SAMPLE_VIEW_TYPE),
    });
  }

  /** Reveal (or create) a sidebar leaf hosting the given view type. */
  private async activateView(viewType: string): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(viewType);
    if (existing.length > 0) {
      await workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: viewType, active: true });
      await workspace.revealLeaf(leaf);
    }
  }

  /** Sample autocomplete, live/reading-mode highlighting, and save-time sync. */
  private registerSampleFeatures(): void {
    if (!this.settings.sampleTracking) return;

    // Autocomplete (@type;… → sample IDs).
    this.registerEditorSuggest(
      new SampleEditorSuggest(this.app, {
        fs: this.fs,
        customTypes: () => this.settings.customSampleTypes,
        globalFolder: () => this.settings.globalSampleFolder,
      })
    );

    // Highlighting — one live getter shared by both surfaces.
    const getState = (): HighlightState => getSampleDisplayMeta(this.settings.customSampleTypes);
    this.registerEditorExtension(createSampleHighlightPlugin(getState));
    this.registerMarkdownPostProcessor(createSampleReadingHighlighter(getState));

    // Persist sample definitions to {Type}.json when a lab note is edited.
    this.registerEvent(
      this.app.vault.on('modify', file => {
        if (file instanceof TFile) this.scheduleSampleSync(file);
      })
    );
  }

  /** Debounced write-through of a lab note's sample definitions. */
  private scheduleSampleSync(file: TFile): void {
    if (!file.path.endsWith('.labnote.md')) return;
    const prev = this.sampleSyncTimers.get(file.path);
    if (prev !== undefined) window.clearTimeout(prev);
    const handle = window.setTimeout(() => {
      this.sampleSyncTimers.delete(file.path);
      void this.syncSamples(file);
    }, 800);
    this.sampleSyncTimers.set(file.path, handle);
  }

  private async syncSamples(file: TFile): Promise<void> {
    try {
      const content = await this.app.vault.read(file);
      await saveSamplesFromDocument(
        this.fs,
        file.path,
        content,
        this.settings.globalSampleFolder,
        this.settings.customSampleTypes
      );
    } catch (err) {
      console.warn('[labnotev] sample sync failed:', err);
    }
  }

  /** The path of the active markdown note, if any (vault-relative). */
  activeNotePath(): string | undefined {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    return view?.file?.path;
  }

  notify(message: string): void {
    new Notice(message);
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
