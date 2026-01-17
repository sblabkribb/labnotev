/**
 * Sample utility functions for Lab Note Editor
 * Pure functions and constants that can be shared between Extension and Webview
 */

/**
 * Sample types available
 */
export const SAMPLE_TYPES = ['DNA', 'RNA', 'Plasmid', 'Reagent', 'Primer', 'Protein', 'Equip', 'Labware'] as const;
export type SampleType = typeof SAMPLE_TYPES[number];

/**
 * Colors for each sample type (used in highlighting and UI)
 */
export const sampleTypeColors: Record<SampleType, string> = {
  DNA: '#FFB6C1',
  RNA: '#ADD8E6',
  Plasmid: '#98FB98',
  Reagent: '#FFD700',
  Primer: '#FF69B4',
  Protein: '#DDA0DD',
  Equip: '#FFA07A',
  Labware: '#D8BFD8',
};

// Counter for generating unique IDs within the same millisecond
let idCounter = 0;
let lastTimestamp = 0;

/**
 * Generate a unique sample ID using timestamp format
 * Ensures uniqueness even when called multiple times in the same millisecond
 * Format: {TYPE}-{timestamp} or {TYPE}-{timestamp}-{counter} if same millisecond
 */
export function generateSampleId(type: SampleType): string {
  const timestamp = Date.now();
  if (timestamp === lastTimestamp) {
    idCounter++;
  } else {
    idCounter = 0;
    lastTimestamp = timestamp;
  }
  return `${type}-${timestamp}${idCounter > 0 ? `-${idCounter}` : ''}`;
}

/**
 * Reset the ID counter (useful for testing)
 */
export function resetIdCounter(): void {
  idCounter = 0;
  lastTimestamp = 0;
}
