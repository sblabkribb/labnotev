/**
 * Data Loader - Load sample data from Local JSON and Global JSON resource files.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import type { LabnoteFs } from '@labnotev/core';

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
export async function findResourcesFolder(fs: LabnoteFs, documentUri: vscode.Uri): Promise<string | null> {
  const docPath = documentUri.fsPath;
  const docDir = path.dirname(docPath);

  // Check current folder
  const localPath = path.join(docDir, 'resources', 'labsamples');
  if (await fs.exists(localPath)) {
    return localPath;
  }

  // Check parent folder (for workflow files)
  const parentPath = path.join(path.dirname(docDir), 'resources', 'labsamples');
  if (await fs.exists(parentPath)) {
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
async function loadSamplesFromJson(fs: LabnoteFs, filePath: string): Promise<Record<string, JsonSampleRecord>> {
  try {
    if (!(await fs.exists(filePath))) {
      return {};
    }
    const content = await fs.read(filePath);
    return JSON.parse(content) as Record<string, JsonSampleRecord>;
  } catch (err) {
    console.error(`[labnotev] Failed to load samples from ${filePath}:`, err);
    return {};
  }
}

/**
 * Load samples by type from local resources folder
 */
export function loadSamplesByTypeFromResources(fs: LabnoteFs, type: string, resourcesPath: string): Promise<Record<string, JsonSampleRecord>> {
  const filePath = path.join(resourcesPath, `${type}.json`);
  return loadSamplesFromJson(fs, filePath);
}

/**
 * Load samples by type from global resources folder
 */
export function loadSamplesByTypeFromGlobalResources(fs: LabnoteFs, type: string, workspaceRoot: string): Promise<Record<string, JsonSampleRecord>> {
  const filePath = path.join(workspaceRoot, 'resources', 'labsamples', `${type}.json`);
  return loadSamplesFromJson(fs, filePath);
}

/**
 * Ensure resources folder exists
 */
export async function ensureResourcesFolder(fs: LabnoteFs, resourcesPath: string): Promise<void> {
  await fs.mkdir(resourcesPath);
}

/**
 * Save sample to resources JSON file
 */
export async function saveSampleToResources(
  fs: LabnoteFs,
  resourcesPath: string,
  type: string,
  id: string,
  alias: string | null,
  description: string | null,
  sourceFile: string
): Promise<void> {
  const filePath = path.join(resourcesPath, `${type}.json`);
  let samples: Record<string, JsonSampleRecord> = {};

  if (await fs.exists(filePath)) {
    try {
      const content = await fs.read(filePath);
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

  // The adapter creates parent directories on demand and owns atomicity.
  await fs.write(filePath, JSON.stringify(samples, null, 2));
}

/** Flat map sampleId -> { alias, description } for webview hover (local JSON overrides global per id). */
export async function buildSampleDefMap(
  fs: LabnoteFs,
  documentUri: vscode.Uri,
  types: string[]
): Promise<Record<string, { alias: string | null; description: string | null }>> {
  const out: Record<string, { alias: string | null; description: string | null }> = {};

  let resourcesPath = await findResourcesFolder(fs, documentUri);
  if (!resourcesPath) {
    const docDir = path.dirname(documentUri.fsPath);
    const candidatePath = path.join(docDir, 'resources', 'labsamples');
    if (await fs.exists(candidatePath)) {
      resourcesPath = candidatePath;
    }
  }
  const workspaceRoot = getWorkspaceRoot(documentUri);

  for (const type of types) {
    const globalRec = workspaceRoot ? await loadSamplesByTypeFromGlobalResources(fs, type, workspaceRoot) : {};
    const localRec = resourcesPath ? await loadSamplesByTypeFromResources(fs, type, resourcesPath) : {};
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
