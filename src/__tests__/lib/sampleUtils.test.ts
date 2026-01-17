import { describe, it, expect, beforeEach } from 'vitest';
import {
  SAMPLE_TYPES,
  SampleType,
  sampleTypeColors,
  generateSampleId,
  resetIdCounter,
} from '../../lib/sampleUtils';

describe('sampleUtils', () => {
  describe('SAMPLE_TYPES', () => {
    it('should include all 8 sample types', () => {
      expect(SAMPLE_TYPES.length).toBe(8);
      expect(SAMPLE_TYPES).toContain('DNA');
      expect(SAMPLE_TYPES).toContain('RNA');
      expect(SAMPLE_TYPES).toContain('Plasmid');
      expect(SAMPLE_TYPES).toContain('Reagent');
      expect(SAMPLE_TYPES).toContain('Primer');
      expect(SAMPLE_TYPES).toContain('Protein');
      expect(SAMPLE_TYPES).toContain('Equip');
      expect(SAMPLE_TYPES).toContain('Labware');
    });
  });

  describe('sampleTypeColors', () => {
    it('should have color for each type', () => {
      for (const type of SAMPLE_TYPES) {
        expect(sampleTypeColors[type]).toBeDefined();
        expect(typeof sampleTypeColors[type]).toBe('string');
        // Should be a valid hex color
        expect(sampleTypeColors[type]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });
  });

  describe('generateSampleId', () => {
    beforeEach(() => {
      resetIdCounter();
    });

    it('should generate ID with timestamp format', () => {
      const newId = generateSampleId('DNA');
      
      // Format: DNA-{timestamp} or DNA-{timestamp}-{counter}
      const pattern = /^DNA-\d+(-\d+)?$/;
      expect(pattern.test(newId)).toBe(true);
      
      // Timestamp should be numeric and at least 13 digits (milliseconds)
      const parts = newId.split('-');
      expect(parts[0]).toBe('DNA');
      expect(/^\d+$/.test(parts[1])).toBe(true);
      expect(parts[1].length).toBeGreaterThanOrEqual(13);
    });

    it('should generate unique IDs', () => {
      const id1 = generateSampleId('DNA');
      const id2 = generateSampleId('DNA');
      
      expect(id1).not.toBe(id2);
    });

    it('should generate different IDs for different types', () => {
      const dnaId = generateSampleId('DNA');
      const rnaId = generateSampleId('RNA');
      
      expect(dnaId).not.toBe(rnaId);
      expect(dnaId.startsWith('DNA-')).toBe(true);
      expect(rnaId.startsWith('RNA-')).toBe(true);
    });

    it('should handle same-millisecond calls with counter', () => {
      // Generate multiple IDs quickly to test counter
      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        ids.push(generateSampleId('DNA'));
      }
      
      // All IDs should be unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(5);
    });

    it('should generate Equip ID with timestamp format', () => {
      const newId = generateSampleId('Equip');
      
      const pattern = /^Equip-\d+(-\d+)?$/;
      expect(pattern.test(newId)).toBe(true);
    });

    it('should generate Labware ID with timestamp format', () => {
      const newId = generateSampleId('Labware');
      
      const pattern = /^Labware-\d+(-\d+)?$/;
      expect(pattern.test(newId)).toBe(true);
    });

    it('should generate Protein ID with timestamp format', () => {
      const newId = generateSampleId('Protein');
      
      const pattern = /^Protein-\d+(-\d+)?$/;
      expect(pattern.test(newId)).toBe(true);
    });
  });
});
