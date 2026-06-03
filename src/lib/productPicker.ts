/**
 * Product picker for Reagent/Labware/Equip: load candidates from the reference DB
 * (resources/labsamples/{type}_*.json) and show a QuickPick for the user to select.
 * Used when creating a new Reagent/Labware/Equip sample ID.
 */

import * as vscode from 'vscode';
import { getLabsamplesFolder, getGlobalLabsamplesFolder, loadReferenceSamplesByType } from './sampleStorage';

export interface ProductCandidate {
  id: string;
  alias: string | null;
  description: string | null;
}

const REFERENCE_DB_TYPES = ['Reagent', 'Labware', 'Equip'];

/**
 * Get all product candidates for a type from the reference DB (local + global).
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
    // Issue #22 Q2: surface the empty-catalog state so the Search product
    // button never looks like a silent no-op.
    const message = vscode.l10n.t(
      'No {0} products found. Add a catalog at resources/labsamples/{0}_*.json.',
      type
    );
    void vscode.window.showInformationMessage(message);
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
    placeHolder: vscode.l10n.t('Search and pick a {0} product', type),
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
