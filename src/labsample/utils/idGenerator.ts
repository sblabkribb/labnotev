/**
 * Generate a unique sample ID using timestamp format
 * Format: {TYPE}-{timestamp}
 */
export function generateUniqueSampleId(existingIds: string[], type: string): string {
  // Use Unix timestamp (milliseconds) to generate unique ID
  let timestamp = Date.now();
  let newId = `${type}-${timestamp}`;
  
  // Check for duplicates (rare case - same millisecond)
  // If ID already exists, increment timestamp and retry
  while (existingIds.includes(newId)) {
    timestamp += 1;
    newId = `${type}-${timestamp}`;
  }
  
  return newId;
}
