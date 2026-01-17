import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockVscode } from './setup';

describe('Sample Info Panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SampleInfoPanel class', () => {
    it('should export SampleInfoPanel class', async () => {
      const { SampleInfoPanel } = await import('../views/SampleInfoPanel');
      expect(SampleInfoPanel).toBeDefined();
    });

    it('should have static viewType property', async () => {
      const { SampleInfoPanel } = await import('../views/SampleInfoPanel');
      expect(SampleInfoPanel.viewType).toBe('labnotev.sampleInfo');
    });

    it('should have createOrShow static method', async () => {
      const { SampleInfoPanel } = await import('../views/SampleInfoPanel');
      expect(typeof SampleInfoPanel.createOrShow).toBe('function');
    });

    it('should have updateContent method', async () => {
      const { SampleInfoPanel } = await import('../views/SampleInfoPanel');
      expect(typeof SampleInfoPanel.prototype.updateContent).toBe('function');
    });
  });

  describe('Sample ID extraction', () => {
    it('should extract sample IDs from text', async () => {
      const { extractSampleIdsFromText } = await import('../views/SampleInfoPanel');
      
      const text = 'This document contains DNA-1737123456789 and RNA-1737123456790 samples.';
      const ids = extractSampleIdsFromText(text);
      
      expect(ids.length).toBe(2);
      expect(ids).toContain('DNA-1737123456789');
      expect(ids).toContain('RNA-1737123456790');
    });

    it('should extract multiple sample types', async () => {
      const { extractSampleIdsFromText } = await import('../views/SampleInfoPanel');
      
      const text = 'Samples: Protein-123, Equip-456, Labware-789';
      const ids = extractSampleIdsFromText(text);
      
      expect(ids.length).toBe(3);
      expect(ids).toContain('Protein-123');
      expect(ids).toContain('Equip-456');
      expect(ids).toContain('Labware-789');
    });

    it('should return empty array for text without sample IDs', async () => {
      const { extractSampleIdsFromText } = await import('../views/SampleInfoPanel');
      
      const text = 'This document has no sample IDs.';
      const ids = extractSampleIdsFromText(text);
      
      expect(ids.length).toBe(0);
    });

    it('should not extract invalid IDs', async () => {
      const { extractSampleIdsFromText } = await import('../views/SampleInfoPanel');
      
      const text = 'Invalid: DNA-, DNA-abc, -123';
      const ids = extractSampleIdsFromText(text);
      
      expect(ids.length).toBe(0);
    });
  });

  describe('HTML generation', () => {
    it('should generate HTML for sample list', async () => {
      const { generateSampleListHtml } = await import('../views/SampleInfoPanel');
      
      const sampleIds = ['DNA-123', 'RNA-456'];
      const html = generateSampleListHtml(sampleIds);
      
      expect(html).toContain('DNA-123');
      expect(html).toContain('RNA-456');
    });

    it('should show message when no samples found', async () => {
      const { generateSampleListHtml } = await import('../views/SampleInfoPanel');
      
      const html = generateSampleListHtml([]);
      
      expect(html).toContain('No sample IDs found');
    });
  });

  describe('Extended sample info extraction', () => {
    it('should extract sample info with alias and description', async () => {
      const { extractSampleInfoFromText } = await import('../views/SampleInfoPanel');
      
      const text = 'DNA-123|샘플1:설명 내용';
      const samples = extractSampleInfoFromText(text);
      
      expect(samples.length).toBe(1);
      expect(samples[0].id).toBe('DNA-123');
      expect(samples[0].type).toBe('DNA');
      expect(samples[0].alias).toBe('샘플1');
      expect(samples[0].description).toBe('설명 내용');
    });

    it('should extract sample info with alias only', async () => {
      const { extractSampleInfoFromText } = await import('../views/SampleInfoPanel');
      
      const text = 'RNA-456|별칭만';
      const samples = extractSampleInfoFromText(text);
      
      expect(samples.length).toBe(1);
      expect(samples[0].alias).toBe('별칭만');
      expect(samples[0].description).toBeNull();
    });
  });

  describe('Extended HTML generation with sample info', () => {
    it('should generate HTML with alias and description', async () => {
      const { generateSampleInfoHtml, SampleDisplayInfo } = await import('../views/SampleInfoPanel');
      
      const samples: SampleDisplayInfo[] = [
        { id: 'DNA-123', type: 'DNA', alias: '샘플1', description: '설명 내용', sources: ['test.md'] }
      ];
      const html = generateSampleInfoHtml(samples);
      
      expect(html).toContain('DNA-123');
      expect(html).toContain('샘플1');
      expect(html).toContain('설명 내용');
    });

    it('should include action buttons (Rename, Replace, Go to)', async () => {
      const { generateSampleInfoHtml, SampleDisplayInfo } = await import('../views/SampleInfoPanel');
      
      const samples: SampleDisplayInfo[] = [
        { id: 'DNA-123', type: 'DNA', alias: null, description: null, sources: [] }
      ];
      const html = generateSampleInfoHtml(samples);
      
      expect(html).toContain('Rename');
      expect(html).toContain('Replace');
      expect(html).toContain('위치로 이동');
    });
  });

  describe('findSampleLocation', () => {
    it('should find sample location in text', async () => {
      const { findSampleLocation } = await import('../views/SampleInfoPanel');
      
      const text = 'Line 1\nLine 2 with DNA-123\nLine 3';
      const location = findSampleLocation(text, 'DNA-123');
      
      expect(location).not.toBeNull();
      expect(location?.line).toBe(1); // 0-indexed
      expect(location?.character).toBe(12); // "Line 2 with " = 12 characters
    });

    it('should return null for non-existent sample', async () => {
      const { findSampleLocation } = await import('../views/SampleInfoPanel');
      
      const text = 'No samples here';
      const location = findSampleLocation(text, 'DNA-999');
      
      expect(location).toBeNull();
    });
  });
});
