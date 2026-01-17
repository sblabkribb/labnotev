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
});
