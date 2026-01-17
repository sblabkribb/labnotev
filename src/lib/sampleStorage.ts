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
 * - ID|alias:description (full format)
 * - ID|alias (alias only)
 * - ID: description (legacy format)
 * - ID (ID only)
 */
export function extractSampleInfoFromText(text: string): SampleInfo[] {
  const samples: SampleInfo[] = [];
  const foundIds = new Set<string>();

  for (const type of SAMPLE_TYPES) {
    // Pattern to match sample ID with optional alias and description
    // Matches: TYPE-digits followed by optional |alias:description or |alias or : description
    // Note: [^\s:\n|]+ excludes spaces to prevent greedy matching across multiple IDs
    const pattern = new RegExp(
      `\\b(${type}-\\d+)(?:\\|([^\\s:\\n|]+)(?::([^\\n|]+))?|:\\s*([^\\n|]+))?`,
      'g'
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

        // Combine descriptions (unique)
        for (const desc of record.descriptions) {
          if (!existingRecord.descriptions.includes(desc)) {
            existingRecord.descriptions.push(desc);
          }
        }

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
  } catch {
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
 * Merges with existing data
 */
export function saveSamplesFromDocument(
  documentPath: string,
  documentText: string
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
  
  // Merge with existing data for each type
  for (const type of Object.keys(newDb)) {
    const existing = loadSamplesByType(labsamplesFolder, type);
    const merged = mergeSampleDatabases({ [type]: existing }, { [type]: newDb[type] });
    saveSamplesByType(labsamplesFolder, type, merged[type]);
  }
}
