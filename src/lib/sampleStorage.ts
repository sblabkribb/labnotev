/**
 * Sample Storage - Functions for extracting and storing sample information
 * Supports formats: ID|alias:description, ID|alias, ID: description, ID
 */

import * as fs from 'fs';
import * as path from 'path';
import { SAMPLE_TYPES, SampleType } from './sampleUtils';

/**
 * Extracted sample information from document text
 */
export interface SampleInfo {
  id: string;
  type: SampleType;
  alias: string | null;
  description: string | null;
}

/**
 * Stored sample record in JSON file
 */
export interface SampleRecord {
  type: string;
  alias: string | null;
  descriptions: string[];
  sources: string[];
}

/**
 * Database structure: { TYPE: { ID: SampleRecord } }
 */
export type SampleDatabase = Record<string, Record<string, SampleRecord>>;

/**
 * Extract sample information from document text
 * Supports formats:
 * - @type:ID|alias:description (definition format)
 * - @type:ID|alias (definition with alias only)
 * - @type:ID (definition with ID only)
 * - ID|alias:description (full format)
 * - ID|alias (alias only)
 * - ID: description (legacy format)
 * - ID (ID only)
 */
export function extractSampleInfoFromText(text: string): SampleInfo[] {
  const samples: SampleInfo[] = [];
  const foundIds = new Set<string>();

  for (const type of SAMPLE_TYPES) {
    // Pattern to match sample ID with optional @type: prefix, alias and description
    // Matches: optional @type: prefix + TYPE-digits followed by optional |alias:description or |alias or : description
    // Alias: [^:\n|]+ allows spaces and special chars (e.g. ™); stops at : or | so ID|alias:description is unambiguous
    // gi flag: case-insensitive for @type: prefix
    const pattern = new RegExp(
      `(?:@${type}:)?(${type}-\\d+(?:-\\d+)?)(?:\\|([^:\\n|]+)(?::([^\\n|]+))?|:\\s*([^\\n|]+))?`,
      'gi'
    );

    let match;
    while ((match = pattern.exec(text)) !== null) {
      const id = match[1];
      
      // Skip if already found (avoid duplicates)
      if (foundIds.has(id)) continue;
      foundIds.add(id);

      let alias: string | null = null;
      let description: string | null = null;

      if (match[2]) {
        // Format: ID|alias or ID|alias:description
        alias = match[2].trim();
        if (match[3]) {
          description = match[3].trim();
        }
      } else if (match[4]) {
        // Legacy format: ID: description
        description = match[4].trim();
      }

      samples.push({
        id,
        type: type as SampleType,
        alias,
        description,
      });
    }
  }

  // Sort by order of appearance in text
  samples.sort((a, b) => text.indexOf(a.id) - text.indexOf(b.id));

  return samples;
}

/**
 * Build a sample database from extracted samples
 * Groups samples by type and stores with source file info
 */
export function buildSampleDatabase(
  samples: SampleInfo[],
  sourceFile: string
): SampleDatabase {
  const db: SampleDatabase = {};

  for (const sample of samples) {
    const { type, id, alias, description } = sample;

    if (!db[type]) {
      db[type] = {};
    }

    db[type][id] = {
      type,
      alias,
      descriptions: description ? [description] : [],
      sources: [sourceFile],
    };
  }

  return db;
}

/**
 * Merge two sample databases
 * New data overwrites alias, but descriptions and sources are combined
 */
export function mergeSampleDatabases(
  existing: SampleDatabase,
  newData: SampleDatabase
): SampleDatabase {
  const merged: SampleDatabase = JSON.parse(JSON.stringify(existing));

  for (const [type, samples] of Object.entries(newData)) {
    if (!merged[type]) {
      merged[type] = {};
    }

    for (const [id, record] of Object.entries(samples)) {
      if (merged[type][id]) {
        // Merge existing record
        const existingRecord = merged[type][id];
        
        // New alias overwrites (if provided)
        if (record.alias) {
          existingRecord.alias = record.alias;
        }

        // Put current document's descriptions first so sidebar shows latest (descriptions[0])
        const fromNew = record.descriptions || [];
        const fromExisting = (existingRecord.descriptions || []).filter(
          (d) => !fromNew.includes(d)
        );
        existingRecord.descriptions = [...fromNew, ...fromExisting];

        // Combine sources (unique)
        for (const source of record.sources) {
          if (!existingRecord.sources.includes(source)) {
            existingRecord.sources.push(source);
          }
        }
      } else {
        // Add new record
        merged[type][id] = { ...record };
      }
    }
  }

  return merged;
}

/**
 * Find the range of a sample definition in document text for replacement.
 * Returns { start, length } of the first matching definition, or null.
 * - General types: matches @type:ID with optional |alias:description (same pattern as extractSampleInfoFromText).
 * - Equip: if no match by id, tries @equip:|currentAlias with optional :description (definition without ID in text).
 */
export function findSampleDefinitionMatch(
  text: string,
  type: string,
  id: string,
  currentAlias?: string | null
): { start: number; length: number } | null {
  const typeEsc = type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // 1) Match by @type:ID (same pattern as extractSampleInfoFromText; alias [^:\n|]+ allows spaces)
  const idPattern = new RegExp(
    `(?:@${typeEsc}:)?(${typeEsc}-\\d+(?:-\\d+)?)(?:\\|([^:\\n|]+)(?::([^\\n|]+))?|:\\s*([^\\n|]+))?`,
    'gi'
  );
  let match = idPattern.exec(text);
  while (match) {
    if (match[1] === id) {
      return { start: match.index, length: match[0].length };
    }
    match = idPattern.exec(text);
  }

  // 2) Equip: match by @equip:|currentAlias when definition has no ID in text
  if ((type.toLowerCase() === 'equip') && currentAlias && currentAlias.trim()) {
    const aliasEsc = currentAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const equipAliasPattern = new RegExp(
      `@equip:\\|${aliasEsc}(?::([^\\n|]*))?`,
      'gi'
    );
    const equipMatch = equipAliasPattern.exec(text);
    if (equipMatch) {
      return { start: equipMatch.index, length: equipMatch[0].length };
    }
  }

  return null;
}

/**
 * Get the resources/labsamples folder path for a document
 * Creates the folder if it doesn't exist
 */
export function getLabsamplesFolder(documentPath: string): string {
  const documentDir = path.dirname(documentPath);
  const resourcesDir = path.join(documentDir, 'resources', 'labsamples');
  
  if (!fs.existsSync(resourcesDir)) {
    fs.mkdirSync(resourcesDir, { recursive: true });
  }
  
  return resourcesDir;
}

/**
 * Load sample database from JSON files for a specific type
 */
export function loadSamplesByType(
  labsamplesFolder: string,
  type: string
): Record<string, SampleRecord> {
  const filePath = path.join(labsamplesFolder, `${type}.json`);
  
  if (!fs.existsSync(filePath)) {
    return {};
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(`[labnotev] Failed to load ${filePath}:`, error);
    return {};
  }
}

/**
 * Save sample database to JSON file for a specific type
 */
export function saveSamplesByType(
  labsamplesFolder: string,
  type: string,
  samples: Record<string, SampleRecord>
): void {
  const filePath = path.join(labsamplesFolder, `${type}.json`);
  
  // Ensure directory exists
  if (!fs.existsSync(labsamplesFolder)) {
    fs.mkdirSync(labsamplesFolder, { recursive: true });
  }
  
  fs.writeFileSync(filePath, JSON.stringify(samples, null, 2), 'utf8');
}

/**
 * Save samples extracted from a document to JSON files
 * Merges with existing data. Samples that exist in Global are not re-added to Local
 * (so after Move to Global, saving the document does not re-add the sample to Local).
 */
export function saveSamplesFromDocument(
  documentPath: string,
  documentText: string,
  globalLabsamplesFolder?: string
): void {
  const labsamplesFolder = getLabsamplesFolder(documentPath);
  const sourceFile = path.basename(documentPath);

  // Extract samples from document
  const samples = extractSampleInfoFromText(documentText);

  if (samples.length === 0) {
    return;
  }

  // Build new database from extracted samples
  const newDb = buildSampleDatabase(samples, sourceFile);

  for (const type of Object.keys(newDb)) {
    const existing = loadSamplesByType(labsamplesFolder, type);
    const merged = mergeSampleDatabases({ [type]: existing }, { [type]: newDb[type] });

    // Do not keep in Local samples that exist in Global (avoid re-adding after Move to Global)
    if (globalLabsamplesFolder) {
      const globalSamples = loadSamplesByType(globalLabsamplesFolder, type);
      for (const id of Object.keys(globalSamples)) {
        if (merged[type][id]) {
          delete merged[type][id];
        }
      }
    }

    saveSamplesByType(labsamplesFolder, type, merged[type]);
  }
}

/**
 * Parse YAML front matter and check if Sample Tracking is enabled
 * Supports key formats: "Sample Tracking", "sampleTracking", "sample-tracking"
 * Supports values: Yes/No, true/false, on/off, 1/0 (case-insensitive)
 */
export function parseSampleTracking(text: string): boolean {
  // Extract YAML front matter (between --- markers)
  const yamlMatch = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!yamlMatch) {
    return false;
  }

  const yamlContent = yamlMatch[1];

  // Match different key formats: "Sample Tracking", "sampleTracking", "sample-tracking"
  // Pattern is case-insensitive for the value
  const patterns = [
    /^Sample\s+Tracking\s*:\s*(.+)$/im,
    /^sampleTracking\s*:\s*(.+)$/im,
    /^sample-tracking\s*:\s*(.+)$/im,
  ];

  for (const pattern of patterns) {
    const match = yamlContent.match(pattern);
    if (match) {
      const value = match[1].trim().toLowerCase();
      // Check for truthy values
      return ['yes', 'true', 'on', '1'].includes(value);
    }
  }

  return false;
}

/**
 * Get the Global labsamples folder path (workspace root)
 */
export function getGlobalLabsamplesFolder(workspaceRoot: string): string {
  return path.join(workspaceRoot, 'resources', 'labsamples');
}

/**
 * Sample location type
 */
export type SampleLocationResult = 'local' | 'global' | 'both' | 'none';

/**
 * Check where a sample is located (local, global, both, or none)
 */
export function getSampleLocation(
  sampleId: string,
  type: string,
  localDb: SampleDatabase,
  globalDb: SampleDatabase
): SampleLocationResult {
  const inLocal = localDb[type]?.[sampleId] !== undefined;
  const inGlobal = globalDb[type]?.[sampleId] !== undefined;

  if (inLocal && inGlobal) {
    return 'both';
  } else if (inLocal) {
    return 'local';
  } else if (inGlobal) {
    return 'global';
  } else {
    return 'none';
  }
}

/**
 * Move a sample from local to global database
 * Returns new copies of both databases
 */
export function moveSampleToGlobal(
  sampleId: string,
  type: string,
  localDb: SampleDatabase,
  globalDb: SampleDatabase
): { newLocalDb: SampleDatabase; newGlobalDb: SampleDatabase } {
  const newLocalDb: SampleDatabase = JSON.parse(JSON.stringify(localDb));
  const newGlobalDb: SampleDatabase = JSON.parse(JSON.stringify(globalDb));

  // Ensure type exists in both databases
  if (!newGlobalDb[type]) {
    newGlobalDb[type] = {};
  }

  // Move sample data
  if (newLocalDb[type]?.[sampleId]) {
    newGlobalDb[type][sampleId] = newLocalDb[type][sampleId];
    delete newLocalDb[type][sampleId];
  }

  return { newLocalDb, newGlobalDb };
}

/**
 * Move a sample from global to local database
 * Returns new copies of both databases
 */
export function moveSampleToLocal(
  sampleId: string,
  type: string,
  localDb: SampleDatabase,
  globalDb: SampleDatabase
): { newLocalDb: SampleDatabase; newGlobalDb: SampleDatabase } {
  const newLocalDb: SampleDatabase = JSON.parse(JSON.stringify(localDb));
  const newGlobalDb: SampleDatabase = JSON.parse(JSON.stringify(globalDb));

  // Ensure type exists in both databases
  if (!newLocalDb[type]) {
    newLocalDb[type] = {};
  }

  // Move sample data
  if (newGlobalDb[type]?.[sampleId]) {
    newLocalDb[type][sampleId] = newGlobalDb[type][sampleId];
    delete newGlobalDb[type][sampleId];
  }

  return { newLocalDb, newGlobalDb };
}
