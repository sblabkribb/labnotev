/**
 * VS Code text decorations for sample ID highlighting
 * This module depends on vscode API and is Extension-only
 */

import * as vscode from 'vscode';
import { SAMPLE_TYPES, sampleTypeColors, SampleType } from './sampleUtils';

const DEFAULT_CUSTOM_COLOR = '#90A4AE';

/**
 * Text editor decorations for each built-in sample type
 */
export const sampleDecorations: Record<SampleType, vscode.TextEditorDecorationType> =
  Object.fromEntries(
    SAMPLE_TYPES.map(type => {
      const color = sampleTypeColors[type];
      return [
        type,
        vscode.window.createTextEditorDecorationType({
          backgroundColor: `${color}99`,
          borderRadius: '3px',
          border: `1px solid ${color}`,
          color: '#000',
          rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
        }),
      ];
    })
  ) as Record<SampleType, vscode.TextEditorDecorationType>;

const customDecorations = new Map<string, vscode.TextEditorDecorationType>();

function ensureDecoration(type: string): vscode.TextEditorDecorationType {
  let deco = customDecorations.get(type);
  if (!deco) {
    deco = vscode.window.createTextEditorDecorationType({
      backgroundColor: `${DEFAULT_CUSTOM_COLOR}99`,
      borderRadius: '3px',
      border: `1px solid ${DEFAULT_CUSTOM_COLOR}`,
      color: '#000',
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });
    customDecorations.set(type, deco);
  }
  return deco;
}

/**
 * Get the decoration for a sample type (built-in or custom)
 */
export function getDecoration(type: string): vscode.TextEditorDecorationType {
  if ((SAMPLE_TYPES as readonly string[]).includes(type)) {
    return sampleDecorations[type as SampleType];
  }
  return ensureDecoration(type);
}

/**
 * Dispose all decorations (built-in and custom)
 */
export function disposeDecorations(): void {
  for (const type of SAMPLE_TYPES) {
    sampleDecorations[type].dispose();
  }
  for (const deco of customDecorations.values()) {
    deco.dispose();
  }
  customDecorations.clear();
}
