/**
 * VS Code text decorations for sample ID highlighting
 * This module depends on vscode API and is Extension-only
 */

import * as vscode from 'vscode';
import { SAMPLE_TYPES, sampleTypeColors, SampleType } from './sampleUtils';

/**
 * Text editor decorations for each sample type
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

/**
 * Dispose all decorations
 */
export function disposeDecorations(): void {
  for (const type of SAMPLE_TYPES) {
    sampleDecorations[type].dispose();
  }
}
