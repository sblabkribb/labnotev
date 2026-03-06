/**
 * Product picker for Reagent/Labware: load candidates from reference DB and MongoDB,
 * show QuickPick for user to select. Used when creating new Reagent/Labware sample ID.
 */

import * as vscode from 'vscode';
import { getMongoIds, getMongoRecord, MONGO_BACKED_TYPES } from './dataLoader';
import { getLabsamplesFolder, getGlobalLabsamplesFolder, loadReferenceSamplesByType } from './sampleStorage';

export interface ProductCandidate {
  id: string;
  alias: string | null;
  description: string | null;
}

const REFERENCE_DB_TYPES = ['Reagent', 'Labware'];

/**
 * Get all product candidates for a type (reference DB + MongoDB for Labware).
 */
export function getProductCandidates(
  type: string,
  documentUri: vscode.Uri
): ProductCandidate[] {
  if (!REFERENCE_DB_TYPES.includes(type)) {
    return [];
  }
  const result: ProductCandidate[] = [];
  const seenIds = new Set<string>();

  const localFolder = getLabsamplesFolder(documentUri.fsPath);
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

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
  const workspaceRoot = workspaceFolder?.uri.fsPath;
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

  if (type === 'Labware' && (MONGO_BACKED_TYPES as readonly string[]).includes(type)) {
    const mongoIds = getMongoIds(type);
    for (const id of mongoIds) {
      if (!seenIds.has(id)) {
        seenIds.add(id);
        const mongoRecord = getMongoRecord(type, id);
        const name = mongoRecord?.['물품명'] ?? mongoRecord?.name ?? id;
        result.push({
          id,
          alias: typeof name === 'string' ? name : null,
          description: null,
        });
      }
    }
  }

  return result;
}

/**
 * Show QuickPick for user to select a product. Returns alias and description for the selected item, or null if cancelled.
 */
export async function showProductPicker(
  type: string,
  documentUri: vscode.Uri
): Promise<{ alias: string | null; description: string | null } | null> {
  const candidates = getProductCandidates(type, documentUri);
  if (candidates.length === 0) {
    return null;
  }
  const items: (vscode.QuickPickItem & { alias: string | null; sampleDescription: string | null })[] = candidates.map(
    (c) => ({
      label: c.alias || c.id,
      description: c.id,
      detail: c.description || undefined,
      alias: c.alias,
      sampleDescription: c.description,
    })
  );
  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: `${type} 제품을 검색하여 선택하세요`,
    matchOnDescription: true,
    matchOnDetail: true,
  });
  if (!selected || !('alias' in selected)) {
    return null;
  }
  return {
    alias: selected.alias ?? null,
    description: selected.sampleDescription ?? null,
  };
}
