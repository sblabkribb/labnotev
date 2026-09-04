/**
 * Sample autocomplete for the Obsidian editor.
 *
 * A thin `EditorSuggest` adapter over the pure core helpers
 * ({@link parseSampleTrigger}, {@link buildSampleCompletionEntries}). All
 * matching/formatting is tested in `@labnotev/core`; this file only bridges
 * Obsidian's suggest lifecycle and loads records from the vault.
 */
import {
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
} from 'obsidian';
import {
  parseSampleTrigger,
  buildSampleCompletionEntries,
  type SampleCandidate,
  type SampleCompletionEntry,
  type LabnoteFs,
} from '@labnotev/core';
import { getSampleDisplayMeta } from '@labnotev/core/lib/sampleUtils';
import {
  loadSamplesByType,
  getLabsamplesFolder,
} from '@labnotev/core/lib/sampleStorage';

export interface SampleSuggestDeps {
  fs: LabnoteFs;
  /** Live getter for user-defined extra sample types. */
  customTypes: () => string[];
  /** Live getter for the vault-global labsamples folder (vault-relative). */
  globalFolder: () => string;
}

export class SampleEditorSuggest extends EditorSuggest<SampleCompletionEntry> {
  constructor(app: App, private readonly deps: SampleSuggestDeps) {
    super(app);
  }

  private get types(): string[] {
    return getSampleDisplayMeta(this.deps.customTypes()).types;
  }

  onTrigger(
    cursor: EditorPosition,
    editor: Editor
  ): EditorSuggestTriggerInfo | null {
    const linePrefix = editor.getLine(cursor.line).slice(0, cursor.ch);
    const trigger = parseSampleTrigger(linePrefix, this.types);
    if (!trigger) return null;
    return {
      start: { line: cursor.line, ch: trigger.startCol },
      end: cursor,
      query: linePrefix.slice(trigger.startCol),
    };
  }

  async getSuggestions(
    context: EditorSuggestContext
  ): Promise<SampleCompletionEntry[]> {
    const trigger = parseSampleTrigger(context.query, this.types);
    if (!trigger) return [];

    const localFolder = getLabsamplesFolder(context.file.path);
    const globalFolder = this.deps.globalFolder();

    const recordsByType: Record<string, SampleCandidate[]> = {};
    for (const type of trigger.typesToSearch) {
      const local = await loadSamplesByType(this.deps.fs, localFolder, type);
      const global = globalFolder
        ? await loadSamplesByType(this.deps.fs, globalFolder, type)
        : {};
      // Local definitions win over global on id collision.
      const merged = { ...global, ...local };
      recordsByType[type] = Object.entries(merged).map(([id, rec]) => ({
        id,
        alias: rec.alias,
        description: rec.descriptions?.[0],
      }));
    }

    return buildSampleCompletionEntries(trigger, recordsByType);
  }

  renderSuggestion(entry: SampleCompletionEntry, el: HTMLElement): void {
    el.createEl('div', { text: entry.label });
    el.createEl('small', { text: `${entry.type} Sample`, cls: 'labnote-suggest-detail' });
  }

  selectSuggestion(entry: SampleCompletionEntry): void {
    const ctx = this.context;
    if (!ctx) return;
    ctx.editor.replaceRange(entry.insertText, ctx.start, ctx.end);
    ctx.editor.setCursor({
      line: ctx.start.line,
      ch: ctx.start.ch + entry.insertText.length,
    });
    this.close();
  }
}
