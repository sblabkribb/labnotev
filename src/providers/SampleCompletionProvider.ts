/**
 * Sample Completion Provider
 * Provides auto-completion for sample IDs when typing @ in markdown files
 * Based on labsample project's completionProvider.ts
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SAMPLE_TYPES, SampleType } from '../lib/dataLoader';
import { getLabsamplesFolder, getGlobalLabsamplesFolder, loadSamplesByType, loadReferenceSamplesByType } from '../lib/sampleStorage';

/**
 * Phase D-1: mtime-based in-memory cache for `loadSampleIdsAndRecords`.
 *
 * The completion provider was re-reading `*.json` from disk on every keystroke
 * (trigger chars include every alphanumeric character), which made typing
 * sample ids noticeably janky on cold NTFS folders. We cache the parsed result
 * by `<localFolder>|<globalFolder>|<type>` and invalidate the entry when the
 * `mtimeMs` of any underlying JSON file changes. `refreshSampleRecordsCache`
 * is exported so TreeView's explicit refresh can proactively invalidate too.
 */
type SampleRecordsCacheEntry = {
  files: Array<{ path: string; mtimeMs: number }>;
  value: Array<{ id: string; alias: string | null; description: string | null }>;
};
const sampleRecordsCache = new Map<string, SampleRecordsCacheEntry>();

export function refreshSampleRecordsCache(): void {
  sampleRecordsCache.clear();
}

function fileMtime(filePath: string): number | null {
  try {
    const st = fs.statSync(filePath);
    return st.mtimeMs;
  } catch {
    return null;
  }
}

function cacheKeyFor(localFolder: string, globalFolder: string, type: string): string {
  return `${localFolder}|${globalFolder}|${type}`;
}

function sampleRecordsFilesFor(
  localFolder: string,
  globalFolder: string,
  type: string
): string[] {
  // Must mirror the exact paths `loadSampleIdsAndRecords` reads via
  // `loadSamplesByType` (which uses `${type}.json`, e.g. `DNA.json`). Using a
  // different casing here makes the tracked files non-existent on
  // case-sensitive filesystems, so the cache never invalidates.
  return [
    path.join(localFolder, `${type}.json`),
    path.join(globalFolder, `${type}.json`),
  ];
}

/** Load sample IDs and record info (alias, description) from same paths as Sample TreeView (sampleStorage) */
function loadSampleIdsAndRecords(
  type: string,
  documentUri: vscode.Uri
): { id: string; alias: string | null; description: string | null }[] {
  // 1. Local: document folder's resources/labsamples (same as Sample TreeView)
  const localFolder = getLabsamplesFolder(documentUri.fsPath);
  // Resolve global folder early so we can derive a cache key before hitting
  // disk. `getWorkspaceFolder` on a missing document returns undefined; in
  // that case we still cache keyed by the empty string so repeat lookups are
  // cheap.
  const workspaceFolderEarly = vscode.workspace.getWorkspaceFolder(documentUri);
  const workspaceRootEarly = workspaceFolderEarly?.uri.fsPath;
  const globalFolderForKey = workspaceRootEarly ? getGlobalLabsamplesFolder(workspaceRootEarly) : '';

  // Phase D-1: return the cached list if the underlying JSON mtimes haven't
  // moved. Return a shallow copy so callers mutating the result array don't
  // poison the cache.
  const cacheKey = cacheKeyFor(localFolder, globalFolderForKey, type);
  const cached = sampleRecordsCache.get(cacheKey);
  if (cached) {
    const stillFresh = cached.files.every(f => fileMtime(f.path) === f.mtimeMs);
    if (stillFresh) {
      return [...cached.value];
    }
  }

  const result: { id: string; alias: string | null; description: string | null }[] = [];
  const seenIds = new Set<string>();
  const localSamples = loadSamplesByType(localFolder, type);
  for (const id of Object.keys(localSamples)) {
    if (!seenIds.has(id)) {
      seenIds.add(id);
      const rec = localSamples[id];
      result.push({
        id,
        alias: rec.alias ?? null,
        description: rec.descriptions?.[0] ?? null,
      });
    }
  }

  // 2. Global: workspace root's resources/labsamples
  const workspaceRoot = workspaceRootEarly;
  if (workspaceRoot) {
    const globalFolder = getGlobalLabsamplesFolder(workspaceRoot);
    const globalSamples = loadSamplesByType(globalFolder, type);
    for (const id of Object.keys(globalSamples)) {
      if (!seenIds.has(id)) {
        seenIds.add(id);
        const rec = globalSamples[id];
        result.push({
          id,
          alias: rec.alias ?? null,
          description: rec.descriptions?.[0] ?? null,
        });
      }
    }
  }

  // 3. Equip only: add reference DB (local + global Equip_*.json) so @equip: list shows them
  if (type === 'Equip') {
    const refLocal = loadReferenceSamplesByType(localFolder, type);
    for (const id of Object.keys(refLocal)) {
      if (!seenIds.has(id)) {
        seenIds.add(id);
        const rec = refLocal[id];
        result.push({
          id,
          alias: rec.alias ?? null,
          description: rec.descriptions?.[0] ?? null,
        });
      }
    }
    if (workspaceRoot) {
      const globalFolder = getGlobalLabsamplesFolder(workspaceRoot);
      const refGlobal = loadReferenceSamplesByType(globalFolder, type);
      for (const id of Object.keys(refGlobal)) {
        if (!seenIds.has(id)) {
          seenIds.add(id);
          const rec = refGlobal[id];
          result.push({
            id,
            alias: rec.alias ?? null,
            description: rec.descriptions?.[0] ?? null,
          });
        }
      }
    }
  }

  // Phase D-1: snapshot everything from disk into the cache.
  const cacheFiles = sampleRecordsFilesFor(localFolder, globalFolderForKey, type)
    .map(p => ({ path: p, mtimeMs: fileMtime(p) ?? 0 }));
  sampleRecordsCache.set(cacheKey, {
    files: cacheFiles,
    value: result.map(r => ({ ...r })),
  });

  return result;
}

/**
 * Match sample type from prefix
 * @param prefix The prefix string (e.g., '@dna:', '@sample:')
 */
function matchSampleType(prefix: string): SampleType | null {
  const lower = prefix.toLowerCase();
  
  // Check for @sample; or @sample: (matches all types)
  if (lower === '@sample;' || lower === '@sample:') {
    return null;
  }
  
  // Check for @TYPE; or @TYPE: pattern
  for (const type of SAMPLE_TYPES) {
    const tl = type.toLowerCase();
    if (lower === `@${tl};` || lower === `@${tl}:`) {
      return type;
    }
  }
  
  // Handle @item; or @item: as Labware alias
  if (lower === '@item;' || lower === '@item:') {
    return 'Labware';
  }
  
  return null;
}

/**
 * Check if the prefix is a sample prefix (@sample:)
 */
function isSamplePrefix(prefix: string): boolean {
  const lower = prefix.toLowerCase();
  return lower === '@sample;' || lower === '@sample:';
}

/**
 * Check if prefix matches any known pattern
 */
function isKnownPrefix(prefix: string): boolean {
  const lower = prefix.toLowerCase();
  if (lower === '@sample;' || lower === '@sample:') return true;
  if (lower === '@item;' || lower === '@item:') return true;
  
  for (const type of SAMPLE_TYPES) {
    const tl = type.toLowerCase();
    if (lower === `@${tl};` || lower === `@${tl}:`) {
      return true;
    }
  }
  
  return false;
}

let _completionLogChannel: vscode.OutputChannel | undefined;

function logCompletionDebug(message: string): void {
  try {
    if (typeof vscode.window?.createOutputChannel !== 'function') return;
    if (!_completionLogChannel) {
      _completionLogChannel = vscode.window.createOutputChannel('Lab Note');
    }
    _completionLogChannel.appendLine(`[completion] ${message}`);
  } catch {
    // No-op when output channel is unavailable (e.g. in tests)
  }
}

/**
 * Sample Completion Provider
 */
export class SampleCompletionProvider implements vscode.CompletionItemProvider {
  
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    
    // Get the text from start of line to cursor position
    const linePrefix = document.lineAt(position).text.substring(0, position.character);

    // Phase D-1: cheap early return. The trigger list was previously every
    // alphanumeric character + '-' + '_', so this provider ran on every
    // keystroke in a markdown file. Bail immediately when the current line
    // has no `@` before the cursor — a provider result of `undefined` is the
    // canonical way to tell VS Code to skip us entirely.
    if (!linePrefix.includes('@')) {
      return undefined;
    }

    // Check for @ trigger patterns
    // Pattern: @TYPE; or @TYPE: (semicolon/colon optional so we match when trigger fires before delimiter is inserted)
    const prefixMatch = linePrefix.match(/@(\w+)[;:]?(\S*)$/);
    if (!prefixMatch || prefixMatch.index === undefined) {
      logCompletionDebug(`prefixMatch null or no index, linePrefix=${JSON.stringify(linePrefix)}`);
      return undefined;
    }

    const fullPrefix = `@${prefixMatch[1]};`;
    const searchTerm = prefixMatch[2].toLowerCase();
    const matchIndex = prefixMatch.index;

    if (!isKnownPrefix(fullPrefix)) {
      logCompletionDebug(`unknown prefix fullPrefix=${JSON.stringify(fullPrefix)}`);
      return undefined;
    }

    const completionItems: vscode.CompletionItem[] = [];
    const documentUri = document.uri;

    // Determine which types to search
    const specificType = matchSampleType(fullPrefix);
    const typesToSearch = isSamplePrefix(fullPrefix) ? [...SAMPLE_TYPES] : (specificType ? [specificType] : []);

    // Range to replace: from @ to cursor (match.index so it works with or without colon in document)
    const replaceRange = new vscode.Range(
      position.line,
      matchIndex,
      position.line,
      position.character
    );
    
    // Add sample ID completions (use sampleStorage so paths match Sample TreeView local/global)
    for (const type of typesToSearch) {
      const records = loadSampleIdsAndRecords(type, documentUri);
      if (specificType && records.length === 0) {
        logCompletionDebug(`${fullPrefix} type=${type} loadSampleIdsAndRecords returned 0 (doc=${documentUri.fsPath})`);
      }
      for (const { id, alias: recAlias, description: recDesc } of records) {
        const alias = recAlias;
        const description = recDesc;
        // Build label: "ID (Alias) - Description" or "ID - Description" or just "ID"
        let label = id;
        if (alias) {
          label = `${id} (${alias})`;
        }
        if (description) {
          label = `${label} - ${description}`;
        }
        
        // Filter by search term
        if (searchTerm && !label.toLowerCase().includes(searchTerm)) {
          continue;
        }
        
        // Build insert text: "ID" or "ID;Alias"
        let insertText = id;
        if (alias) {
          insertText = `${id};${alias}`;
        }
        
        const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Reference);
        item.insertText = insertText;
        item.range = replaceRange; // Replace @type:searchTerm with just ID|Alias
        item.detail = `${type} Sample`;
        item.sortText = `1_${id}`; // After "Generate new X ID" (0_new)
        // So VS Code filter (typed prefix e.g. "@dna:") matches and sample items are shown
        item.filterText = `${fullPrefix}${label}`;

        completionItems.push(item);
      }
    }
    
    // Add "Generate New ID" option (not for Equip type - Equip uses existing DB/JSON IDs only)
    const EQUIP_TYPE = 'Equip';
    if (specificType && !isSamplePrefix(fullPrefix) && specificType !== EQUIP_TYPE) {
      const newIdItem = new vscode.CompletionItem(
        vscode.l10n.t('Generate new {0} ID', specificType),
        vscode.CompletionItemKind.Event
      );
      newIdItem.detail = vscode.l10n.t('Automatically generate a new sample ID');
      newIdItem.sortText = '0_new'; // Sort first so Enter triggers new ID immediately
      newIdItem.command = {
        command: 'labnotev.generateSampleId',
        title: 'Generate Sample ID',
        arguments: [specificType, document.uri]
      };
      // Insert placeholder that will be replaced by command
      newIdItem.insertText = '';
      completionItems.push(newIdItem);
    }
    
    // Add "Manual Input" option (for all types including Equip - so @equip: works when no local IDs)
    if (specificType && !isSamplePrefix(fullPrefix)) {
      const manualItem = new vscode.CompletionItem(
        vscode.l10n.t('Enter info'),
        vscode.CompletionItemKind.Snippet
      );
      manualItem.detail = specificType === EQUIP_TYPE
        ? vscode.l10n.t('Manually enter Equip ID, alias, and description (references DB/JSON ID)')
        : vscode.l10n.t('Manually enter sample ID, alias, and description');
      manualItem.sortText = '2_manual';
      manualItem.command = {
        command: 'labnotev.inputSampleInfo',
        title: 'Input Sample Info',
        arguments: [specificType, document.uri]
      };
      manualItem.insertText = '';
      completionItems.push(manualItem);
    }
    // isIncomplete: true so VS Code does not filter the list by typed prefix (sample items would be hidden)
    return new vscode.CompletionList(completionItems, true);
  }
}

/**
 * Create and return the completion provider with trigger characters.
 *
 * Phase D-1: trigger on `@`, `;`, and `:` only. Subsequent filtering of an
 * open list (`@dna;...`) is driven by `CompletionList(items, isIncomplete=true)`
 * returned from `provideCompletionItems`, which makes VS Code re-query us on
 * every keystroke within the completion range without needing every
 * alphanumeric character to be a trigger. Reducing the trigger set stops the
 * provider from being invoked on unrelated typing throughout the document.
 */
export function createSampleCompletionProvider(): vscode.Disposable {
  return vscode.languages.registerCompletionItemProvider(
    { language: 'markdown', scheme: 'file' },
    new SampleCompletionProvider(),
    '@',
    ';',
    ':'
  );
}
