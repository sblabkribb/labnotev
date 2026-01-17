/**
 * Application-wide constants for labsample module
 */

// Sample type definitions
export const SAMPLE_TYPES = ['DNA', 'RNA', 'Plasmid', 'Reagent', 'Primer', 'Protein', 'Equip', 'Labware'] as const;
export type SampleType = typeof SAMPLE_TYPES[number];

// MongoDB-backed sample types
export const MONGO_BACKED_TYPES: readonly SampleType[] = ['Equip', 'Labware'] as const;

// Completion trigger patterns
export const COMPLETION_PATTERNS = {
  SAMPLE_PREFIX: '@sample:',
} as const;

// VSCode command IDs
export const COMMANDS = {
  SHOW_SAMPLE_INFO: 'labnotev.showSampleInfo',
  REGISTER_NEW_ID: 'labnotev.registerNewId',
  RENAME_SAMPLE_ID: 'labnotev.renameSampleId',
  ADD_SAMPLE: 'labnotev.addSample',
} as const;

// Panel configuration
export const PANEL_CONFIG = {
  VIEW_TYPE: 'labnotev.sampleInfo',
  TITLE: 'Sample Info',
  COLUMN: 'Beside',
} as const;

// File paths
export const PATHS = {
  DATA_DIR: 'data',
  JSON_EXTENSION: '.json',
  RESOURCES_DIR: 'resources',
  LABSAMPLES_DIR: 'labsamples',
} as const;

// Messages and text
export const MESSAGES = {
  EXTENSION_ACTIVATED: 'Lab Note Editor with sample tracking is now active!',
  ID_REGISTERED: (id: string, type: string) => `New ID ${id} has been registered for ${type}.`,
  ID_CHANGED: (oldId: string, newId: string) => `${oldId} → ${newId} changed.`,
  ID_CHANGE_CANCELLED: 'ID change cancelled.',
  ID_UNCHANGED: 'ID unchanged. Please enter a different value.',
  ID_ALREADY_EXISTS: 'ID already exists. Please use a different ID.',
  NO_SAMPLES_FOUND: 'No sample IDs found in document.',
} as const;

// YAML Front Matter keys
export const YAML_KEYS = {
  SAMPLE_TRACKING: ['Sample Tracking', 'sampleTracking', 'sample-tracking', 'sample_tracking'],
  ENABLED_VALUES: ['yes', 'true', 'on', '1'],
} as const;
