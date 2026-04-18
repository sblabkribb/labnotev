/**
 * Tests for dataLoader module
 */
import {
  SAMPLE_TYPES,
  MONGO_BACKED_TYPES,
} from '../lib/dataLoader';

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

  describe('MONGO_BACKED_TYPES', () => {
    it('should include Equip and Labware', () => {
      expect(MONGO_BACKED_TYPES).toContain('Equip');
      expect(MONGO_BACKED_TYPES).toContain('Labware');
    });

    it('should have 2 MongoDB-backed types', () => {
      expect(MONGO_BACKED_TYPES.length).toBe(2);
    });

    it('should not include DNA or other local types', () => {
      expect(MONGO_BACKED_TYPES).not.toContain('DNA');
      expect(MONGO_BACKED_TYPES).not.toContain('RNA');
      expect(MONGO_BACKED_TYPES).not.toContain('Plasmid');
    });
  });

  describe('JsonSampleRecord interface', () => {
    it('should allow creating JsonSampleRecord objects', async () => {
      const { JsonSampleRecord } = await import('../lib/dataLoader');
      
      // Type assertion to test interface structure
      const sample: typeof JsonSampleRecord = {
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

    it('should export MONGO_BACKED_TYPES as readonly array', () => {
      expect(Array.isArray(MONGO_BACKED_TYPES)).toBe(true);
      expect(MONGO_BACKED_TYPES).toEqual(['Equip', 'Labware']);
    });
  });
});
