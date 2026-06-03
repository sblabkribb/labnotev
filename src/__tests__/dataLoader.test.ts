/**
 * Tests for dataLoader module
 */
import { SAMPLE_TYPES } from '../lib/dataLoader';
import type { JsonSampleRecord } from '../lib/dataLoader';

// Mock vscode
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue: any) => defaultValue),
    })),
    workspaceFolders: [],
  },
  Uri: {
    file: (path: string) => ({ fsPath: path }),
  },
}));

describe('dataLoader', () => {
  describe('SAMPLE_TYPES', () => {
    it('should include all expected sample types', () => {
      expect(SAMPLE_TYPES).toContain('DNA');
      expect(SAMPLE_TYPES).toContain('RNA');
      expect(SAMPLE_TYPES).toContain('Plasmid');
      expect(SAMPLE_TYPES).toContain('Reagent');
      expect(SAMPLE_TYPES).toContain('Primer');
      expect(SAMPLE_TYPES).toContain('Equip');
      expect(SAMPLE_TYPES).toContain('Labware');
    });

    it('should have 8 sample types', () => {
      expect(SAMPLE_TYPES.length).toBe(8);
    });
  });

  describe('JsonSampleRecord interface', () => {
    it('should allow creating JsonSampleRecord objects', () => {
      // Type assertion to test interface structure
      const sample: JsonSampleRecord = {
        type: 'DNA',
        alias: 'TestAlias',
        descriptions: ['Test description'],
        sources: ['test.md'],
      };

      expect(sample.type).toBe('DNA');
      expect(sample.alias).toBe('TestAlias');
    });
  });

  describe('type checking', () => {
    it('should export SAMPLE_TYPES as readonly array', () => {
      expect(Array.isArray(SAMPLE_TYPES)).toBe(true);
      expect(SAMPLE_TYPES).toEqual(['DNA', 'RNA', 'Plasmid', 'Reagent', 'Primer', 'Protein', 'Equip', 'Labware']);
    });
  });
});
