import { describe, it, expect } from 'vitest';
import {
  getSeoulDateString,
  getSeoulDateTimeString,
  createDateSlashItem,
  createDateTimeSlashItem,
  createSampleIdSlashItems,
} from '../slashCommands';

describe('Slash Commands', () => {
  describe('getSeoulDateString', () => {
    it('should return date in YYYY-MM-DD format', () => {
      const result = getSeoulDateString();
      expect(/^\d{4}-\d{2}-\d{2}$/.test(result)).toBe(true);
    });
  });

  describe('getSeoulDateTimeString', () => {
    it('should return datetime in YYYY-MM-DD HH:mm format', () => {
      const result = getSeoulDateTimeString();
      expect(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(result)).toBe(true);
    });
  });

  describe('createDateSlashItem', () => {
    it('should create a slash item with name "Insert Date"', () => {
      const mockEditor = { /* mock editor */ } as any;
      const item = createDateSlashItem(mockEditor);
      
      expect(item.name).toBe('Insert Date');
      expect(item.aliases).toContain('date');
      expect(item.group).toBe('Lab Note');
    });

    it('should have execute function', () => {
      const mockEditor = { /* mock editor */ } as any;
      const item = createDateSlashItem(mockEditor);
      
      expect(typeof item.execute).toBe('function');
    });
  });

  describe('createDateTimeSlashItem', () => {
    it('should create a slash item with name "Insert DateTime"', () => {
      const mockEditor = { /* mock editor */ } as any;
      const item = createDateTimeSlashItem(mockEditor);
      
      expect(item.name).toBe('Insert DateTime');
      expect(item.aliases).toContain('datetime');
      expect(item.aliases).toContain('now');
      expect(item.group).toBe('Lab Note');
    });

    it('should have execute function', () => {
      const mockEditor = { /* mock editor */ } as any;
      const item = createDateTimeSlashItem(mockEditor);
      
      expect(typeof item.execute).toBe('function');
    });
  });

  describe('createSampleIdSlashItems', () => {
    it('should create slash items for all sample types', () => {
      const mockEditor = { /* mock editor */ } as any;
      const items = createSampleIdSlashItems(mockEditor);
      
      expect(items.length).toBeGreaterThan(0);
      
      // Check for DNA sample type
      const dnaItem = items.find(item => item.name.includes('DNA'));
      expect(dnaItem).toBeDefined();
      expect(dnaItem!.group).toBe('Sample');
      
      // Check for RNA sample type
      const rnaItem = items.find(item => item.name.includes('RNA'));
      expect(rnaItem).toBeDefined();
      
      // Check for Protein sample type
      const proteinItem = items.find(item => item.name.includes('Protein'));
      expect(proteinItem).toBeDefined();
    });

    it('should have aliases for sample types', () => {
      const mockEditor = { /* mock editor */ } as any;
      const items = createSampleIdSlashItems(mockEditor);
      
      const dnaItem = items.find(item => item.name.includes('DNA'));
      expect(dnaItem!.aliases).toContain('dna');
    });

    it('should have execute function for each item', () => {
      const mockEditor = { /* mock editor */ } as any;
      const items = createSampleIdSlashItems(mockEditor);
      
      items.forEach(item => {
        expect(typeof item.execute).toBe('function');
      });
    });
  });
});
