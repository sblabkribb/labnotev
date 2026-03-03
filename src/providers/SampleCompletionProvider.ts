/**
 * Sample Completion Provider
 * Provides auto-completion for sample IDs when typing @ in markdown files
 * Based on labsample project's completionProvider.ts
 */

import * as vscode from 'vscode';
import {
  SAMPLE_TYPES,
  SampleType,
  getMongoIds,
  getMongoRecord,
  MONGO_BACKED_TYPES,
} from '../lib/dataLoader';
import { getLabsamplesFolder, getGlobalLabsamplesFolder, loadSamplesByType } from '../lib/sampleStorage';
import { generateSampleId } from '../lib/sampleUtils';

/** Load sample IDs and record info (alias, description) from same paths as Sample TreeView (sampleStorage) */
function loadSampleIdsAndRecords(
  type: string,
  documentUri: vscode.Uri
): { id: string; alias: string | null; description: string | null }[] {
  const result: { id: string; alias: string | null; description: string | null }[] = [];
  const seenIds = new Set<string>();

  // 1. Local: document folder's resources/labsamples (same as Sample TreeView)
  const localFolder = getLabsamplesFolder(documentUri.fsPath);
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
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
  const workspaceRoot = workspaceFolder?.uri.fsPath;
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

  // 3. Equip/Labware: add MongoDB IDs
  if ((MONGO_BACKED_TYPES as readonly string[]).includes(type)) {
    const mongoIds = getMongoIds(type);
    for (const id of mongoIds) {
      if (!seenIds.has(id)) {
        seenIds.add(id);
        result.push({ id, alias: null, description: null });
      }
    }
  }

  return result;
}

/**
 * Match sample type from prefix
 * @param prefix The prefix string (e.g., '@dna:', '@sample:')
 */
function matchSampleType(prefix: string): SampleType | null {
  const lower = prefix.toLowerCase();
  
  // Check for @sample: (matches all types)
  if (lower === '@sample:') {
    return null; // Special case for all types
  }
  
  // Check for @TYPE: pattern
  for (const type of SAMPLE_TYPES) {
    if (lower === `@${type.toLowerCase()}:`) {
      return type;
    }
  }
  
  // Handle @item: as Labware alias
  if (lower === '@item:') {
    return 'Labware';
  }
  
  return null;
}

/**
 * Check if the prefix is a sample prefix (@sample:)
 */
function isSamplePrefix(prefix: string): boolean {
  return prefix.toLowerCase() === '@sample:';
}

/**
 * Check if prefix matches any known pattern
 */
function isKnownPrefix(prefix: string): boolean {
  const lower = prefix.toLowerCase();
  if (lower === '@sample:') return true;
  if (lower === '@item:') return true;
  
  for (const type of SAMPLE_TYPES) {
    if (lower === `@${type.toLowerCase()}:`) {
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
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
    
    // Get the text from start of line to cursor position
    const linePrefix = document.lineAt(position).text.substring(0, position.character);

    // Check for @ trigger patterns
    // Pattern: @TYPE: or @sample: (colon optional so we match when trigger fires before colon is inserted)
    const prefixMatch = linePrefix.match(/@(\w+):?(\S*)$/);
    if (!prefixMatch || prefixMatch.index === undefined) {
      logCompletionDebug(`prefixMatch null or no index, linePrefix=${JSON.stringify(linePrefix)}`);
      return undefined;
    }

    const fullPrefix = `@${prefixMatch[1]}:`;
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
      for (const { id, alias, description } of records) {
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
        
        // Build insert text for reference: "ID|Alias" or just "ID" (no description)
        // Description is only included when defining a new sample, not when referencing
        // The @type: prefix will be replaced (removed) when selecting existing sample
        let insertText = id;
        if (alias) {
          insertText = `${id}|${alias}`;
        }
        
        const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Reference);
        item.insertText = insertText;
        item.range = replaceRange; // Replace @type:searchTerm with just ID|Alias
        item.detail = `${type} Sample`;
        item.sortText = `0_${id}`; // Sort samples first
        // So VS Code filter (typed prefix e.g. "@dna:") matches and sample items are shown
        item.filterText = `${fullPrefix}${label}`;
        
        // Add MongoDB details for Equip/Labware
        if (MONGO_BACKED_TYPES.includes(type)) {
          const mongoRecord = getMongoRecord(type, id);
          if (mongoRecord) {
            item.documentation = new vscode.MarkdownString(
              `**MongoDB Record**\n\n\`\`\`json\n${JSON.stringify(mongoRecord, null, 2)}\n\`\`\``
            );
          }
        }
        
        completionItems.push(item);
      }
    }
    
    // Add "Generate New ID" option (not for Equip type - Equip uses existing DB/JSON IDs only)
    const EQUIP_TYPE = 'Equip';
    if (specificType && !isSamplePrefix(fullPrefix) && specificType !== EQUIP_TYPE) {
      const newIdItem = new vscode.CompletionItem(
        `새 ${specificType} ID 생성`,
        vscode.CompletionItemKind.Event
      );
      newIdItem.detail = '새로운 샘플 ID를 자동 생성합니다';
      newIdItem.sortText = '1_new'; // Sort after samples
      newIdItem.command = {
        command: 'labnotev.generateSampleId',
        title: 'Generate Sample ID',
        arguments: [specificType, document.uri]
      };
      // Insert placeholder that will be replaced by command
      newIdItem.insertText = '';
      completionItems.push(newIdItem);
    }
    
    // Add "Manual Input" option (for all types including Equip - so @equip: works when no MongoDB/local IDs)
    if (specificType && !isSamplePrefix(fullPrefix)) {
      const manualItem = new vscode.CompletionItem(
        '정보 입력',
        vscode.CompletionItemKind.Snippet
      );
      manualItem.detail = specificType === EQUIP_TYPE
        ? 'Equip ID, 별칭, 설명을 직접 입력합니다 (DB/JSON ID 참조)'
        : '샘플 ID, 별칭, 설명을 직접 입력합니다';
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
 * ':' opens the list; letters/digits/-/_ re-trigger so typing after @type: filters the list.
 */
export function createSampleCompletionProvider(): vscode.Disposable {
  // Include '@' so completion is triggered as soon as user types @ (then each letter re-triggers)
  const triggerChars = ['@', ':', ...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')];
  return vscode.languages.registerCompletionItemProvider(
    { language: 'markdown', scheme: 'file' },
    new SampleCompletionProvider(),
    ...triggerChars
  );
}
