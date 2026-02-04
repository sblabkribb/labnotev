/**
 * Data Loader - Load sample data from Local JSON, Global JSON, and MongoDB
 * Based on labsample project's dataLoader.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

// Sample Types (must match sampleUtils.ts SAMPLE_TYPES)
export const SAMPLE_TYPES = ['DNA', 'RNA', 'Plasmid', 'Reagent', 'Primer', 'Protein', 'Equip', 'Labware'] as const;
export type SampleType = typeof SAMPLE_TYPES[number];

// MongoDB-backed types (loaded from remote database)
export const MONGO_BACKED_TYPES: readonly SampleType[] = ['Equip', 'Labware'];

/**
 * Sample information stored in JSON files
 */
export interface SampleInfo {
  type: string;
  alias?: string | null;
  descriptions?: string[];
  sources?: string[];
}

// MongoDB client (lazy loaded to avoid import errors when mongodb is not installed)
let MongoClient: any = null;
let mongoClient: any = null;
let mongoDb: any = null;

// MongoDB ID cache
const mongoIdCache: Partial<Record<SampleType, string[]>> = {};
const mongoDocCache: Partial<Record<SampleType, Record<string, any>>> = {};

/**
 * Get MongoDB configuration from VS Code settings
 */
function getMongoConfig(): { mongoUrl: string; dbName: string } {
  const config = vscode.workspace.getConfiguration('labnotev');
  
  let mongoUrl = config.get<string>('mongoUrl', '');
  let dbName = config.get<string>('mongoDbName', 'SBLIMS');
  
  // Environment variable fallback (for development)
  if (!mongoUrl && process.env.SBLIMS_MONGO_URL) {
    mongoUrl = process.env.SBLIMS_MONGO_URL;
    console.log('[labnotev] Using SBLIMS_MONGO_URL from environment');
  }
  
  if (!dbName && process.env.SBLIMS_MONGO_DB_NAME) {
    dbName = process.env.SBLIMS_MONGO_DB_NAME;
  }
  
  return { mongoUrl, dbName };
}

/**
 * Initialize MongoDB connection and load remote data
 */
export async function initRemoteData(): Promise<void> {
  if (mongoClient) return;

  const config = getMongoConfig();
  
  if (!config.mongoUrl) {
    console.warn('[labnotev] MongoDB URL is not configured.');
    console.warn('[labnotev] Equip/Labware auto-completion will be disabled.');
    console.warn('[labnotev] Configure in: Settings → Lab Note Editor → Mongo Url');
    return;
  }

  try {
    // Lazy load mongodb module
    if (!MongoClient) {
      const mongodb = await import('mongodb');
      MongoClient = mongodb.MongoClient;
    }

    console.log('[labnotev] Connecting to MongoDB...');
    mongoClient = new MongoClient(config.mongoUrl, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });
    await mongoClient.connect();
    mongoDb = mongoClient.db(config.dbName);
    console.log('[labnotev] MongoDB connected successfully!');

    // Load Equip data
    const equipDocs = await mongoDb
      .collection('equip_list')
      .find({ status: { $ne: 0 } })
      .toArray();

    const equipIds: string[] = [];
    const equipRecords: Record<string, any> = {};

    for (const doc of equipDocs) {
      const equip = String(doc.equip ?? '').trim();
      const equipNumRaw = doc.equip_num !== undefined && doc.equip_num !== null
        ? String(doc.equip_num).trim()
        : '';
      const subname = String(doc.subname ?? '').trim();
      const equipNum = equipNumRaw ? equipNumRaw.padStart(3, '0') : '';
      const parts = [equip, equipNum, subname].filter(s => s.length > 0);
      if (parts.length === 0) continue;
      const id = parts.join('-');
      equipIds.push(id);
      equipRecords[id] = doc;
    }
    mongoIdCache['Equip'] = equipIds;
    mongoDocCache['Equip'] = equipRecords;

    // Load Labware/Item data
    const itemDocs = await mongoDb
      .collection('Item_Catalog')
      .find({ status: { $ne: 0 } })
      .toArray();

    type ItemTmp = { doc: any; cidRaw: string; name: string };
    const tmp: ItemTmp[] = [];
    let maxCidLength = 0;

    for (const doc of itemDocs) {
      const cidRaw = String(doc.CID ?? '').trim();
      const name = String(doc['물품명'] ?? '').trim();
      if (!cidRaw || !name) continue;
      tmp.push({ doc, cidRaw, name });
      if (cidRaw.length > maxCidLength) {
        maxCidLength = cidRaw.length;
      }
    }

    const itemIds: string[] = [];
    const itemRecords: Record<string, any> = {};

    for (const rec of tmp) {
      const paddedCid = rec.cidRaw.padStart(maxCidLength, '0');
      const id = `${paddedCid}-${rec.name}`;
      itemIds.push(id);
      itemRecords[id] = rec.doc;
    }

    mongoIdCache['Labware'] = itemIds;
    mongoDocCache['Labware'] = itemRecords;

  } catch (error) {
    console.error('[labnotev] MongoDB connection failed:', error);
    mongoClient = null;
    mongoDb = null;
  }
}

/**
 * Dispose MongoDB connection
 */
export async function disposeRemoteData(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    mongoDb = null;
  }
}

/**
 * Get MongoDB record by type and ID
 */
export function getMongoRecord(type: string, id: string): any | undefined {
  const byId = mongoDocCache[type as SampleType];
  if (!byId) return undefined;
  if (!MONGO_BACKED_TYPES.includes(type as SampleType)) return;
  return byId[id];
}

/**
 * Get MongoDB IDs by type
 */
export function getMongoIds(type: string): string[] {
  const key = type as SampleType;
  return mongoIdCache[key] ?? [];
}

/**
 * Find resources/labsamples folder from document path
 */
export function findResourcesFolder(documentUri: vscode.Uri): string | null {
  const docPath = documentUri.fsPath;
  const docDir = path.dirname(docPath);
  
  // Check current folder
  const localPath = path.join(docDir, 'resources', 'labsamples');
  if (fs.existsSync(localPath)) {
    return localPath;
  }
  
  // Check parent folder (for workflow files)
  const parentPath = path.join(path.dirname(docDir), 'resources', 'labsamples');
  if (fs.existsSync(parentPath)) {
    return parentPath;
  }
  
  return null;
}

/**
 * Get workspace root from document URI
 */
function getWorkspaceRoot(documentUri?: vscode.Uri): string | null {
  if (!documentUri) return null;

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) return null;

  if (workspaceFolders.length === 1) {
    return workspaceFolders[0].uri.fsPath;
  }

  const docPath = documentUri.fsPath;
  for (const folder of workspaceFolders) {
    const folderPath = folder.uri.fsPath;
    if (docPath.startsWith(folderPath + path.sep) || docPath === folderPath) {
      return folderPath;
    }
  }

  return workspaceFolders[0].uri.fsPath;
}

/**
 * Load samples from JSON file
 */
function loadSamplesFromJson(filePath: string): Record<string, SampleInfo> {
  try {
    if (!fs.existsSync(filePath)) {
      return {};
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as Record<string, SampleInfo>;
  } catch (err) {
    console.error(`[labnotev] Failed to load samples from ${filePath}:`, err);
    return {};
  }
}

/**
 * Load samples by type from local resources folder
 */
export function loadSamplesByTypeFromResources(type: string, resourcesPath: string): Record<string, SampleInfo> {
  const filePath = path.join(resourcesPath, `${type}.json`);
  return loadSamplesFromJson(filePath);
}

/**
 * Load samples by type from global resources folder
 */
export function loadSamplesByTypeFromGlobalResources(type: string, workspaceRoot: string): Record<string, SampleInfo> {
  const filePath = path.join(workspaceRoot, 'resources', 'labsamples', `${type}.json`);
  return loadSamplesFromJson(filePath);
}

/**
 * Load IDs by sample type
 */
export function loadIdsByType(type: string, documentUri?: vscode.Uri): string[] {
  const resultIds: string[] = [];
  const seenIds = new Set<string>();

  // 1. Load from local resources/labsamples/{TYPE}.json (same path as sampleStorage/Sample TreeView)
  if (documentUri) {
    let resourcesPath = findResourcesFolder(documentUri);
    // Fallback: try document dir directly (folder may exist but findResourcesFolder missed it, e.g. path normalization)
    if (!resourcesPath) {
      const docDir = path.dirname(documentUri.fsPath);
      const candidatePath = path.join(docDir, 'resources', 'labsamples');
      if (fs.existsSync(candidatePath)) {
        resourcesPath = candidatePath;
      }
    }
    if (resourcesPath) {
      const samples = loadSamplesByTypeFromResources(type, resourcesPath);
      for (const id of Object.keys(samples)) {
        resultIds.push(id);
        seenIds.add(id);
      }
    }
  }

  // 2. Load from global resources/labsamples/{TYPE}.json
  const workspaceRoot = getWorkspaceRoot(documentUri);
  if (workspaceRoot) {
    const globalSamples = loadSamplesByTypeFromGlobalResources(type, workspaceRoot);
    for (const id of Object.keys(globalSamples)) {
      if (!seenIds.has(id)) {
        resultIds.push(id);
        seenIds.add(id);
      }
    }
  }

  // 3. Load from MongoDB cache for Equip/Labware types
  if ((MONGO_BACKED_TYPES as readonly string[]).includes(type)) {
    const mongoIds = mongoIdCache[type as SampleType] ?? [];
    for (const id of mongoIds) {
      if (!seenIds.has(id)) {
        resultIds.push(id);
        seenIds.add(id);
      }
    }
  }

  return resultIds;
}

/**
 * Ensure resources folder exists
 */
export function ensureResourcesFolder(resourcesPath: string): void {
  if (!fs.existsSync(resourcesPath)) {
    fs.mkdirSync(resourcesPath, { recursive: true });
  }
}

/**
 * Save sample to resources JSON file
 */
export function saveSampleToResources(
  resourcesPath: string,
  type: string,
  id: string,
  alias: string | null,
  description: string | null,
  sourceFile: string
): void {
  ensureResourcesFolder(resourcesPath);
  
  const filePath = path.join(resourcesPath, `${type}.json`);
  let samples: Record<string, SampleInfo> = {};
  
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      samples = JSON.parse(content);
    } catch {
      samples = {};
    }
  }
  
  if (!samples[id]) {
    samples[id] = {
      type,
      alias: alias || null,
      descriptions: description ? [description] : [],
      sources: [sourceFile],
    };
  } else {
    // Update existing sample
    if (alias) {
      samples[id].alias = alias;
    }
    if (description && !samples[id].descriptions?.includes(description)) {
      samples[id].descriptions = samples[id].descriptions || [];
      samples[id].descriptions.push(description);
    }
    if (!samples[id].sources?.includes(sourceFile)) {
      samples[id].sources = samples[id].sources || [];
      samples[id].sources.push(sourceFile);
    }
  }
  
  fs.writeFileSync(filePath, JSON.stringify(samples, null, 2), 'utf-8');
}

/**
 * Get sample info by type and ID
 */
export function getSampleInfo(type: string, id: string, documentUri?: vscode.Uri): SampleInfo | null {
  // Check local resources first
  if (documentUri) {
    const resourcesPath = findResourcesFolder(documentUri);
    if (resourcesPath) {
      const samples = loadSamplesByTypeFromResources(type, resourcesPath);
      if (samples[id]) {
        return samples[id];
      }
    }
  }

  // Check global resources
  const workspaceRoot = getWorkspaceRoot(documentUri);
  if (workspaceRoot) {
    const globalSamples = loadSamplesByTypeFromGlobalResources(type, workspaceRoot);
    if (globalSamples[id]) {
      return globalSamples[id];
    }
  }

  return null;
}
