/**
 * Data Loader - Load sample data from Local JSON and Global JSON resource files.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

// Import and re-export from sampleUtils.ts (single source of truth)
import { SAMPLE_TYPES, SampleType } from './sampleUtils';
export { SAMPLE_TYPES, SampleType };

/**
 * Sample record stored in JSON resource files (distinct from sampleStorage.JsonSampleRecord which represents extracted data)
 */
export interface JsonSampleRecord {
  type: string;
  alias?: string | null;
  descriptions?: string[];
  sources?: string[];
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
function loadSamplesFromJson(filePath: string): Record<string, JsonSampleRecord> {
  try {
    if (!fs.existsSync(filePath)) {
      return {};
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as Record<string, JsonSampleRecord>;
  } catch (err) {
    console.error(`[labnotev] Failed to load samples from ${filePath}:`, err);
    return {};
  }
}

/**
 * Load samples by type from local resources folder
 */
export function loadSamplesByTypeFromResources(type: string, resourcesPath: string): Record<string, JsonSampleRecord> {
  const filePath = path.join(resourcesPath, `${type}.json`);
  return loadSamplesFromJson(filePath);
}

/**
 * Load samples by type from global resources folder
 */
export function loadSamplesByTypeFromGlobalResources(type: string, workspaceRoot: string): Record<string, JsonSampleRecord> {
  const filePath = path.join(workspaceRoot, 'resources', 'labsamples', `${type}.json`);
  return loadSamplesFromJson(filePath);
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
  let samples: Record<string, JsonSampleRecord> = {};

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

/** Flat map sampleId -> { alias, description } for webview hover (local JSON overrides global per id). */
export function buildSampleDefMap(
  documentUri: vscode.Uri,
  types: string[]
): Record<string, { alias: string | null; description: string | null }> {
  const out: Record<string, { alias: string | null; description: string | null }> = {};

  let resourcesPath = findResourcesFolder(documentUri);
  if (!resourcesPath) {
    const docDir = path.dirname(documentUri.fsPath);
    const candidatePath = path.join(docDir, 'resources', 'labsamples');
    if (fs.existsSync(candidatePath)) {
      resourcesPath = candidatePath;
    }
  }
  const workspaceRoot = getWorkspaceRoot(documentUri);

  for (const type of types) {
    const globalRec = workspaceRoot ? loadSamplesByTypeFromGlobalResources(type, workspaceRoot) : {};
    const localRec = resourcesPath ? loadSamplesByTypeFromResources(type, resourcesPath) : {};
    const ids = new Set([...Object.keys(globalRec), ...Object.keys(localRec)]);
    for (const id of ids) {
      const rec = localRec[id] ?? globalRec[id];
      if (!rec) continue;
      const desc = rec.descriptions?.[0] ?? null;
      out[id] = {
        alias: rec.alias ?? null,
        description: desc,
      };
    }
  }

  return out;
}
