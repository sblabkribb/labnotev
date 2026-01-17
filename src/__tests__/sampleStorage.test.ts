import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Sample Storage', () => {
  describe('extractSampleInfoFromText', () => {
    it('should extract sample ID with alias and description', async () => {
      const { extractSampleInfoFromText } = await import('../lib/sampleStorage');
      
      const text = 'DNA-1737123456789|샘플1:신규 데이터';
      const samples = extractSampleInfoFromText(text);
      
      expect(samples.length).toBe(1);
      expect(samples[0].id).toBe('DNA-1737123456789');
      expect(samples[0].type).toBe('DNA');
      expect(samples[0].alias).toBe('샘플1');
      expect(samples[0].description).toBe('신규 데이터');
    });

    it('should extract sample ID with alias only', async () => {
      const { extractSampleInfoFromText } = await import('../lib/sampleStorage');
      
      const text = 'RNA-1737123456789|RNA-001';
      const samples = extractSampleInfoFromText(text);
      
      expect(samples.length).toBe(1);
      expect(samples[0].id).toBe('RNA-1737123456789');
      expect(samples[0].alias).toBe('RNA-001');
      expect(samples[0].description).toBeNull();
    });

    it('should extract sample ID with description only (legacy format)', async () => {
      const { extractSampleInfoFromText } = await import('../lib/sampleStorage');
      
      const text = 'Protein-123: 단백질 샘플 설명';
      const samples = extractSampleInfoFromText(text);
      
      expect(samples.length).toBe(1);
      expect(samples[0].id).toBe('Protein-123');
      expect(samples[0].alias).toBeNull();
      expect(samples[0].description).toBe('단백질 샘플 설명');
    });

    it('should extract sample ID without additional info', async () => {
      const { extractSampleInfoFromText } = await import('../lib/sampleStorage');
      
      const text = 'This contains DNA-999 sample.';
      const samples = extractSampleInfoFromText(text);
      
      expect(samples.length).toBe(1);
      expect(samples[0].id).toBe('DNA-999');
      expect(samples[0].alias).toBeNull();
      expect(samples[0].description).toBeNull();
    });

    it('should extract multiple samples from text', async () => {
      const { extractSampleInfoFromText } = await import('../lib/sampleStorage');
      
      const text = `
        - DNA-123|샘플A:설명A
        - RNA-456|샘플B
        - Protein-789
      `;
      const samples = extractSampleInfoFromText(text);
      
      expect(samples.length).toBe(3);
      expect(samples[0].id).toBe('DNA-123');
      expect(samples[0].alias).toBe('샘플A');
      expect(samples[1].id).toBe('RNA-456');
      expect(samples[1].alias).toBe('샘플B');
      expect(samples[2].id).toBe('Protein-789');
    });

    it('should handle all sample types', async () => {
      const { extractSampleInfoFromText } = await import('../lib/sampleStorage');
      
      const text = 'DNA-1 RNA-2 Plasmid-3 Reagent-4 Primer-5 Protein-6 Equip-7 Labware-8';
      const samples = extractSampleInfoFromText(text);
      
      expect(samples.length).toBe(8);
      expect(samples.map(s => s.type)).toEqual([
        'DNA', 'RNA', 'Plasmid', 'Reagent', 'Primer', 'Protein', 'Equip', 'Labware'
      ]);
    });
  });

  describe('SampleInfo interface', () => {
    it('should have correct structure', async () => {
      const { extractSampleInfoFromText } = await import('../lib/sampleStorage');
      
      const text = 'DNA-123|별칭:설명';
      const samples = extractSampleInfoFromText(text);
      
      expect(samples[0]).toHaveProperty('id');
      expect(samples[0]).toHaveProperty('type');
      expect(samples[0]).toHaveProperty('alias');
      expect(samples[0]).toHaveProperty('description');
    });
  });

  describe('buildSampleDatabase', () => {
    it('should group samples by type', async () => {
      const { extractSampleInfoFromText, buildSampleDatabase } = await import('../lib/sampleStorage');
      
      const text = 'DNA-1|A DNA-2|B RNA-3|C';
      const samples = extractSampleInfoFromText(text);
      const db = buildSampleDatabase(samples, 'test.md');
      
      expect(db['DNA']).toBeDefined();
      expect(db['RNA']).toBeDefined();
      expect(Object.keys(db['DNA'])).toHaveLength(2);
      expect(Object.keys(db['RNA'])).toHaveLength(1);
    });

    it('should store sample info with sources', async () => {
      const { extractSampleInfoFromText, buildSampleDatabase } = await import('../lib/sampleStorage');
      
      const text = 'DNA-123|샘플:설명';
      const samples = extractSampleInfoFromText(text);
      const db = buildSampleDatabase(samples, 'experiment.md');
      
      expect(db['DNA']['DNA-123']).toEqual({
        type: 'DNA',
        alias: '샘플',
        descriptions: ['설명'],
        sources: ['experiment.md'],
      });
    });

    it('should handle samples without alias or description', async () => {
      const { extractSampleInfoFromText, buildSampleDatabase } = await import('../lib/sampleStorage');
      
      const text = 'DNA-999';
      const samples = extractSampleInfoFromText(text);
      const db = buildSampleDatabase(samples, 'test.md');
      
      expect(db['DNA']['DNA-999']).toEqual({
        type: 'DNA',
        alias: null,
        descriptions: [],
        sources: ['test.md'],
      });
    });
  });

  describe('mergeSampleDatabases', () => {
    it('should merge two databases', async () => {
      const { mergeSampleDatabases } = await import('../lib/sampleStorage');
      
      const existing = {
        DNA: {
          'DNA-1': { type: 'DNA', alias: 'old', descriptions: ['old desc'], sources: ['file1.md'] }
        }
      };
      const newData = {
        DNA: {
          'DNA-1': { type: 'DNA', alias: 'new', descriptions: ['new desc'], sources: ['file2.md'] },
          'DNA-2': { type: 'DNA', alias: null, descriptions: [], sources: ['file2.md'] }
        }
      };
      
      const merged = mergeSampleDatabases(existing, newData);
      
      expect(merged['DNA']['DNA-1'].alias).toBe('new'); // new overwrites
      expect(merged['DNA']['DNA-1'].descriptions).toContain('old desc');
      expect(merged['DNA']['DNA-1'].descriptions).toContain('new desc');
      expect(merged['DNA']['DNA-1'].sources).toContain('file1.md');
      expect(merged['DNA']['DNA-1'].sources).toContain('file2.md');
      expect(merged['DNA']['DNA-2']).toBeDefined();
    });
  });
});
