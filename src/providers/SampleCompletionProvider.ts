/**
 * Sample Completion Provider
 * Provides auto-completion for sample IDs when typing @ in markdown files
 * Based on labsample project's completionProvider.ts
 */

import * as vscode from 'vscode';
import {
  SAMPLE_TYPES,
  SampleType,
  loadIdsByType,
  getSampleInfo,
  getMongoIds,
  getMongoRecord,
  MONGO_BACKED_TYPES,
} from '../lib/dataLoader';
import { generateSampleId } from '../lib/sampleUtils';

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
    // Pattern: @TYPE: or @sample:
    const prefixMatch = linePrefix.match(/@(\w+):(\S*)$/);
    if (!prefixMatch) {
      return undefined;
    }
    
    const fullPrefix = `@${prefixMatch[1]}:`;
    const searchTerm = prefixMatch[2].toLowerCase();
    
    if (!isKnownPrefix(fullPrefix)) {
      return undefined;
    }
    
    const completionItems: vscode.CompletionItem[] = [];
    const documentUri = document.uri;
    
    // Determine which types to search
    const specificType = matchSampleType(fullPrefix);
    const typesToSearch = isSamplePrefix(fullPrefix) ? [...SAMPLE_TYPES] : (specificType ? [specificType] : []);
    
    // Calculate the range to replace (including @type: prefix for reference)
    // When referencing existing sample, we want to replace @dna:searchTerm with just ID|Alias
    const prefixStartPos = position.character - fullPrefix.length - searchTerm.length;
    const replaceRange = new vscode.Range(
      position.line,
      prefixStartPos,
      position.line,
      position.character
    );
    
    // Add sample ID completions
    for (const type of typesToSearch) {
      const ids = loadIdsByType(type, documentUri);
      
      for (const id of ids) {
        // Get sample info for alias and description
        const info = getSampleInfo(type, id, documentUri);
        const alias = info?.alias || null;
        const description = info?.descriptions?.[0] || null;
        
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
    
    // Add "Manual Input" option (not for Equip type)
    if (specificType && !isSamplePrefix(fullPrefix) && specificType !== EQUIP_TYPE) {
      const manualItem = new vscode.CompletionItem(
        '정보 입력',
        vscode.CompletionItemKind.Snippet
      );
      manualItem.detail = '샘플 ID, 별칭, 설명을 직접 입력합니다';
      manualItem.sortText = '2_manual';
      manualItem.command = {
        command: 'labnotev.inputSampleInfo',
        title: 'Input Sample Info',
        arguments: [specificType, document.uri]
      };
      manualItem.insertText = '';
      completionItems.push(manualItem);
    }
    
    return completionItems;
  }
}

/**
 * Create and return the completion provider with trigger characters
 */
export function createSampleCompletionProvider(): vscode.Disposable {
  return vscode.languages.registerCompletionItemProvider(
    { language: 'markdown', scheme: 'file' },
    new SampleCompletionProvider(),
    ':' // Trigger on ':'
  );
}
