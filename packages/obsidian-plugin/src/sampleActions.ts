/**
 * Shared, interactive sample create/edit/delete actions for the Obsidian
 * plugin. Used by both the editor autocomplete "create" flow
 * ([sampleSuggest.ts](./sampleSuggest.ts)) and the Samples sidebar context menu
 * ([views/sampleView.ts](./views/sampleView.ts)).
 *
 * Pure formatting/ID logic lives in `@labnotev/core`; this module only wires
 * the modals, persists JSON via the vault fs, and surfaces notices.
 */
import { App, Notice } from 'obsidian';
import {
  generateSampleId,
  buildSampleIdPattern,
  buildSampleDefinitionText,
} from '@labnotev/core/lib/sampleUtils';
import {
  loadSamplesByType,
  saveSamplesByType,
  getLabsamplesFolder,
  findSampleDefinitionMatch,
  type SampleRecord,
} from '@labnotev/core/lib/sampleStorage';
import type LabnotePlugin from './main';
import { promptModal, confirmModal } from './modals';

export type SampleScope = 'local' | 'global';

/**
 * Resolve the vault-relative labsamples folder for a scope. Local is the active
 * note's `resources/labsamples`; when no note is active it falls back to the
 * vault-global folder (same rule the sidebar `refresh()` uses).
 */
export function resolveScopeFolder(plugin: LabnotePlugin, scope: SampleScope): string {
  if (scope === 'global') return plugin.settings.globalSampleFolder;
  const active = plugin.activeNotePath();
  return active ? getLabsamplesFolder(active) : plugin.settings.globalSampleFolder;
}

/** Merge one sample record into `{Type}.json` (create/overwrite by id). */
async function upsertSampleRecord(
  plugin: LabnotePlugin,
  folder: string,
  type: string,
  id: string,
  alias: string | null,
  description: string | null
): Promise<void> {
  const db = await loadSamplesByType(plugin.fs, folder, type);
  db[id] = {
    type,
    alias,
    descriptions: description ? [description] : [],
    sources: db[id]?.sources ?? [],
  };
  await saveSamplesByType(plugin.fs, folder, type, db);
}

/** Trim to a non-empty string or null. */
function clean(value: string | undefined): string | null {
  return value && value.trim() ? value.trim() : null;
}

export interface CreatedSample {
  id: string;
  alias: string | null;
  description: string | null;
  definitionText: string;
}

/**
 * Interactively create a sample (generate a new id or enter one manually),
 * persist it, and return the created record + its `@type;id;...` definition
 * text. Returns undefined only when the ID step is cancelled; alias/description
 * are optional (blank allowed).
 */
export async function createSampleInteractive(
  app: App,
  plugin: LabnotePlugin,
  opts: { type: string; folder: string; mode: 'generate' | 'manual' }
): Promise<CreatedSample | undefined> {
  const { type, folder, mode } = opts;

  let id: string;
  if (mode === 'generate') {
    id = generateSampleId(type);
  } else {
    const entered = await promptModal(app, {
      title: plugin.t('Enter the {0} sample ID', type),
      value: `${type}-`,
      placeholder: plugin.t('e.g. {0}-12345', type),
      validate: v =>
        buildSampleIdPattern(type).test(v.trim())
          ? null
          : plugin.t('Invalid ID. Expected {0}-<number>.', type),
    });
    if (entered === undefined) return undefined;
    id = entered.trim();
  }

  const aliasRaw = await promptModal(app, {
    title: plugin.t('Enter an alias for the new {0} sample', type),
    placeholder: plugin.t('e.g. Sample-A'),
  });
  const descRaw = await promptModal(app, {
    title: plugin.t('Enter a description (optional)'),
    placeholder: plugin.t('e.g. Sample used in experiment 1'),
  });
  const alias = clean(aliasRaw);
  const description = clean(descRaw);

  await upsertSampleRecord(plugin, folder, type, id, alias, description);
  new Notice(plugin.t('Sample added: {0}', id));

  return {
    id,
    alias,
    description,
    definitionText: buildSampleDefinitionText(type, id, alias, description),
  };
}

/**
 * Interactively edit a sample's alias/description (prefilled), persist to JSON,
 * and best-effort update the definition in the active note if present so the
 * document and JSON do not diverge. Returns false when cancelled.
 */
export async function editSampleInteractive(
  app: App,
  plugin: LabnotePlugin,
  opts: { folder: string; type: string; id: string; record: SampleRecord }
): Promise<boolean> {
  const { folder, type, id, record } = opts;

  const aliasRaw = await promptModal(app, {
    title: plugin.t('Enter a new alias'),
    value: record.alias ?? '',
    placeholder: plugin.t('e.g. Sample-A'),
  });
  if (aliasRaw === undefined) return false;
  const descRaw = await promptModal(app, {
    title: plugin.t('Enter a new description'),
    value: record.descriptions?.[0] ?? '',
    placeholder: plugin.t('e.g. Sample used in experiment 1'),
  });
  if (descRaw === undefined) return false;

  const alias = clean(aliasRaw);
  const description = clean(descRaw);
  await upsertSampleRecord(plugin, folder, type, id, alias, description);

  // Best-effort: keep the active note's definition in sync (single file only).
  const target = plugin.host.editTarget();
  if (target) {
    const text = await target.getText();
    const match = findSampleDefinitionMatch(text, type, id, record.alias ?? null);
    if (match) {
      await target.replaceRange(
        match.start,
        match.start + match.length,
        buildSampleDefinitionText(type, id, alias, description)
      );
    }
  }

  new Notice(plugin.t('Sample updated: {0}', id));
  return true;
}

/** Confirm + delete a sample from its `{Type}.json`. Returns false when cancelled. */
export async function deleteSampleInteractive(
  app: App,
  plugin: LabnotePlugin,
  opts: { folder: string; type: string; id: string }
): Promise<boolean> {
  const { folder, type, id } = opts;
  const ok = await confirmModal(
    app,
    plugin.t('Are you sure you want to delete {0}?', id),
    plugin.t('Delete')
  );
  if (!ok) return false;

  const db = await loadSamplesByType(plugin.fs, folder, type);
  if (db[id]) {
    delete db[id];
    await saveSamplesByType(plugin.fs, folder, type, db);
  }
  new Notice(plugin.t('Sample deleted: {0}', id));
  return true;
}
