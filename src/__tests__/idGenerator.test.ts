import { describe, it, expect } from 'vitest';
import { generateUniqueSampleId } from '../labsample/utils/idGenerator';

describe('ID Generator', () => {
  describe('generateUniqueSampleId', () => {
    it('should generate ID with timestamp format', () => {
      const existing: string[] = [];
      const newId = generateUniqueSampleId(existing, 'DNA');
      
      // Format: DNA-{timestamp}
      const pattern = /^DNA-\d+$/;
      expect(pattern.test(newId)).toBe(true);
      
      // Timestamp should be numeric and at least 13 digits (milliseconds)
      const parts = newId.split('-');
      expect(parts.length).toBe(2);
      expect(parts[0]).toBe('DNA');
      expect(/^\d+$/.test(parts[1])).toBe(true);
      expect(parts[1].length).toBeGreaterThanOrEqual(13);
    });

    it('should generate unique IDs', () => {
      const existing: string[] = [];
      const id1 = generateUniqueSampleId(existing, 'DNA');
      existing.push(id1);
      const id2 = generateUniqueSampleId(existing, 'DNA');
      
      expect(id1).not.toBe(id2);
    });

    it('should generate different IDs for different types', () => {
      const existing: string[] = [];
      const dnaId = generateUniqueSampleId(existing, 'DNA');
      const rnaId = generateUniqueSampleId(existing, 'RNA');
      
      expect(dnaId).not.toBe(rnaId);
      expect(dnaId.startsWith('DNA-')).toBe(true);
      expect(rnaId.startsWith('RNA-')).toBe(true);
    });

    it('should handle existing old format IDs', () => {
      // Old format IDs should not affect new format generation
      const existing = ['DNA-20250115-001', 'DNA-20250115-002'];
      const newId = generateUniqueSampleId(existing, 'DNA');
      
      // New ID should use timestamp format
      const pattern = /^DNA-\d+$/;
      expect(pattern.test(newId)).toBe(true);
      expect(existing.includes(newId)).toBe(false);
    });

    it('should handle duplicate timestamp (very rare case)', () => {
      const timestamp = Date.now();
      const existing = [`DNA-${timestamp}`];
      const newId = generateUniqueSampleId(existing, 'DNA');
      
      // Should handle duplicate timestamp by incrementing
      expect(newId).not.toBe(`DNA-${timestamp}`);
      expect(newId.startsWith('DNA-')).toBe(true);
    });

    it('should generate Equip ID with timestamp format', () => {
      const existing: string[] = [];
      const newId = generateUniqueSampleId(existing, 'Equip');
      
      const pattern = /^Equip-\d+$/;
      expect(pattern.test(newId)).toBe(true);
    });

    it('should generate Labware ID with timestamp format', () => {
      const existing: string[] = [];
      const newId = generateUniqueSampleId(existing, 'Labware');
      
      const pattern = /^Labware-\d+$/;
      expect(pattern.test(newId)).toBe(true);
    });

    it('should generate Protein ID with timestamp format', () => {
      const existing: string[] = [];
      const newId = generateUniqueSampleId(existing, 'Protein');
      
      const pattern = /^Protein-\d+$/;
      expect(pattern.test(newId)).toBe(true);
    });
  });
});
