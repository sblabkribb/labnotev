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

/**
 * Find @type: prefix range at cursor position
 * Returns the range of the @type: prefix if found, null otherwise
 */
export function findSamplePrefixRange(
  document: { lineAt: (line: number) => { text: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } } },
  position: { line: number; character: number },
  sampleType: string
): { start: { line: number; character: number }; end: { line: number; character: number } } | null {
  const line = document.lineAt(position.line);
  const lineText = line.text;
  const cursorChar = position.character;

  // Check if cursor is at or after a @type: prefix
  // Pattern: @type: (case insensitive)
  const prefixPattern = new RegExp(`@${sampleType.toLowerCase()}:`, 'i');
  let match: RegExpExecArray | null;
  const regex = new RegExp(prefixPattern.source, 'gi');
  
  while ((match = regex.exec(lineText)) !== null) {
    const prefixStart = match.index;
    const prefixEnd = prefixStart + match[0].length;
    
    // Check if cursor is within or immediately after this prefix
    // Cursor should be after the start of the prefix (not before it)
    if (cursorChar > prefixStart && cursorChar <= prefixEnd) {
      return {
        start: { line: position.line, character: prefixStart },
        end: { line: position.line, character: prefixEnd },
      };
    }
  }

  return null;
}
