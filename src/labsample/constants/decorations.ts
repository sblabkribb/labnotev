import * as vscode from 'vscode';
import { SAMPLE_TYPES, SampleType } from './appConstants';

/**
 * Color mapping for each sample type
 */
export const sampleTypeColors: Record<SampleType, string> = {
  DNA: '#FFB6C1',      // Light pink
  RNA: '#ADD8E6',      // Light blue
  Plasmid: '#98FB98',  // Pale green
  Reagent: '#FFD700',  // Gold
  Primer: '#FF69B4',   // Hot pink
  Protein: '#DDA0DD',  // Plum
  Equip: '#FFA07A',    // Light salmon
  Labware: '#D8BFD8',  // Thistle
};

/**
 * Text decoration types for each sample type
 */
export const sampleDecorations: Record<SampleType, vscode.TextEditorDecorationType> =
  Object.fromEntries(
    SAMPLE_TYPES.map(type => {
      const color = sampleTypeColors[type];
      return [
        type,
        vscode.window.createTextEditorDecorationType({
          backgroundColor: `${color}99`, // 60% opacity
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
