import { describe, it, expect, vi } from 'vitest';
import {
  getSeoulDateString,
  getSeoulDateTimeString,
  createDateSlashItem,
  createDateTimeSlashItem,
  createSampleIdSlashItems,
  generateSampleId,
  SAMPLE_TYPES,
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

  describe('generateSampleId', () => {
    it('should generate ID with correct type prefix', () => {
      const dnaId = generateSampleId('DNA');
      expect(dnaId).toMatch(/^DNA-\d+$/);

      const rnaId = generateSampleId('RNA');
      expect(rnaId).toMatch(/^RNA-\d+$/);
    });

    it('should generate unique IDs', () => {
      const id1 = generateSampleId('DNA');
      const id2 = generateSampleId('DNA');
      expect(id1).not.toBe(id2);
    });
  });

  // BlockNote expects 'title' property, not 'name'
  describe('createDateSlashItem - BlockNote compatible format', () => {
    it('should have title property (BlockNote requirement)', () => {
      const mockEditor = {} as any;
      const item = createDateSlashItem(mockEditor);
      
      expect(item.title).toBe('Insert Date');
      expect(item.aliases).toContain('date');
    });

    it('should have onItemClick function (BlockNote requirement)', () => {
      const mockEditor = {} as any;
      const item = createDateSlashItem(mockEditor);
      
      expect(typeof item.onItemClick).toBe('function');
    });

    it('should insert date when onItemClick is called', () => {
      const mockInsertBlocks = vi.fn();
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block' } }),
        insertBlocks: mockInsertBlocks,
      } as any;

      const item = createDateSlashItem(mockEditor);
      item.onItemClick();

      expect(mockInsertBlocks).toHaveBeenCalledTimes(1);
      const [blocks, position, placement] = mockInsertBlocks.mock.calls[0];
      expect(blocks[0].type).toBe('paragraph');
      expect(blocks[0].content[0].text).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(placement).toBe('after');
    });
  });

  describe('createDateTimeSlashItem - BlockNote compatible format', () => {
    it('should have title property (BlockNote requirement)', () => {
      const mockEditor = {} as any;
      const item = createDateTimeSlashItem(mockEditor);
      
      expect(item.title).toBe('Insert DateTime');
      expect(item.aliases).toContain('datetime');
      expect(item.aliases).toContain('now');
    });

    it('should have onItemClick function (BlockNote requirement)', () => {
      const mockEditor = {} as any;
      const item = createDateTimeSlashItem(mockEditor);
      
      expect(typeof item.onItemClick).toBe('function');
    });

    it('should insert datetime when onItemClick is called', () => {
      const mockInsertBlocks = vi.fn();
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block' } }),
        insertBlocks: mockInsertBlocks,
      } as any;

      const item = createDateTimeSlashItem(mockEditor);
      item.onItemClick();

      expect(mockInsertBlocks).toHaveBeenCalledTimes(1);
      const [blocks] = mockInsertBlocks.mock.calls[0];
      expect(blocks[0].content[0].text).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });
  });

  describe('createSampleIdSlashItems - BlockNote compatible format', () => {
    it('should create items for all sample types', () => {
      const mockEditor = {} as any;
      const items = createSampleIdSlashItems(mockEditor);
      
      expect(items.length).toBe(SAMPLE_TYPES.length);
      
      // Verify all types have items
      for (const type of SAMPLE_TYPES) {
        const item = items.find(i => i.title.includes(type));
        expect(item).toBeDefined();
      }
    });

    it('should have title property for each item (BlockNote requirement)', () => {
      const mockEditor = {} as any;
      const items = createSampleIdSlashItems(mockEditor);
      
      const dnaItem = items.find(i => i.title.includes('DNA'));
      expect(dnaItem).toBeDefined();
      expect(dnaItem!.title).toBe('Insert DNA Sample ID');
    });

    it('should have onItemClick function for each item', () => {
      const mockEditor = {} as any;
      const items = createSampleIdSlashItems(mockEditor);
      
      items.forEach(item => {
        expect(typeof item.onItemClick).toBe('function');
      });
    });

    it('should have aliases for each sample type', () => {
      const mockEditor = {} as any;
      const items = createSampleIdSlashItems(mockEditor);
      
      const dnaItem = items.find(i => i.title.includes('DNA'));
      expect(dnaItem!.aliases).toContain('dna');
      
      const rnaItem = items.find(i => i.title.includes('RNA'));
      expect(rnaItem!.aliases).toContain('rna');
    });

    it('should insert sample ID when onItemClick is called', () => {
      const mockInsertBlocks = vi.fn();
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block' } }),
        insertBlocks: mockInsertBlocks,
      } as any;

      const items = createSampleIdSlashItems(mockEditor);
      const dnaItem = items.find(i => i.title.includes('DNA'));
      
      dnaItem!.onItemClick();

      expect(mockInsertBlocks).toHaveBeenCalledTimes(1);
      const [blocks] = mockInsertBlocks.mock.calls[0];
      expect(blocks[0].content[0].text).toMatch(/^DNA-\d+$/);
    });
  });

  describe('Subtext property for better UX', () => {
    it('should have subtext explaining the command', () => {
      const mockEditor = {} as any;
      
      const dateItem = createDateSlashItem(mockEditor);
      expect(dateItem.subtext).toBeDefined();
      expect(dateItem.subtext).toContain('YYYY-MM-DD');

      const datetimeItem = createDateTimeSlashItem(mockEditor);
      expect(datetimeItem.subtext).toBeDefined();

      const sampleItems = createSampleIdSlashItems(mockEditor);
      sampleItems.forEach(item => {
        expect(item.subtext).toBeDefined();
      });
    });
  });
});
