import { describe, it, expect, vi } from 'vitest';
import {
  getSeoulDateString,
  getSeoulDateTimeString,
  createDateSlashItem,
  createDateTimeSlashItem,
  createSampleIdSlashItems,
  getLabNoteSlashMenuItems,
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
      expect(dnaId).toMatch(/^DNA-\d+(-\d+)?$/);

      const rnaId = generateSampleId('RNA');
      expect(rnaId).toMatch(/^RNA-\d+(-\d+)?$/);
    });

    it('should generate unique IDs', () => {
      const id1 = generateSampleId('DNA');
      const id2 = generateSampleId('DNA');
      expect(id1).not.toBe(id2);
    });
  });

  // BlockNote expects 'name' and 'execute' properties (ReactSlashMenuItem interface)
  describe('슬래시 명령 BlockNote 호환성', () => {
    it('ReactSlashMenuItem 인터페이스와 호환되어야 함', () => {
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: vi.fn().mockReturnValue([{ id: 'new-block' }]),
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;

      const items = getLabNoteSlashMenuItems(mockEditor);
      items.forEach(item => {
        // BlockNote 필수 속성 확인 - name과 execute 사용
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('execute');
        expect(typeof item.execute).toBe('function');
      });
    });

    it('모든 커스텀 슬래시 명령이 있어야 함', () => {
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: vi.fn().mockReturnValue([{ id: 'new-block' }]),
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;

      const items = getLabNoteSlashMenuItems(mockEditor);
      
      // 날짜 명령 2개 + 샘플 타입 8개 + 워크플로 템플릿 29개 = 39개
      expect(items.length).toBeGreaterThanOrEqual(2 + SAMPLE_TYPES.length);
    });
  });

  describe('createDateSlashItem - BlockNote ReactSlashMenuItem 형식', () => {
    it('should have name property (BlockNote requirement)', () => {
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: vi.fn().mockReturnValue([{ id: 'new-block' }]),
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;
      const item = createDateSlashItem(mockEditor);
      
      expect(item.name).toBe('Insert Date');
      expect(item.aliases).toContain('date');
    });

    it('should have execute function (BlockNote requirement)', () => {
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: vi.fn().mockReturnValue([{ id: 'new-block' }]),
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;
      const item = createDateSlashItem(mockEditor);
      
      expect(typeof item.execute).toBe('function');
    });

    it('should insert date when execute is called', () => {
      const mockInsertBlocks = vi.fn().mockReturnValue([{ id: 'new-block' }]);
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: mockInsertBlocks,
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;

      const item = createDateSlashItem(mockEditor);
      item.execute(mockEditor);

      expect(mockInsertBlocks).toHaveBeenCalledTimes(1);
      const [blocks, position, placement] = mockInsertBlocks.mock.calls[0];
      expect(blocks[0].type).toBe('paragraph');
      expect(blocks[0].content[0].text).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(placement).toBe('after');
    });
  });

  describe('createDateTimeSlashItem - BlockNote ReactSlashMenuItem 형식', () => {
    it('should have name property (BlockNote requirement)', () => {
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: vi.fn().mockReturnValue([{ id: 'new-block' }]),
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;
      const item = createDateTimeSlashItem(mockEditor);
      
      expect(item.name).toBe('Insert DateTime');
      expect(item.aliases).toContain('datetime');
      expect(item.aliases).toContain('now');
    });

    it('should have execute function (BlockNote requirement)', () => {
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: vi.fn().mockReturnValue([{ id: 'new-block' }]),
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;
      const item = createDateTimeSlashItem(mockEditor);
      
      expect(typeof item.execute).toBe('function');
    });

    it('should insert datetime when execute is called', () => {
      const mockInsertBlocks = vi.fn().mockReturnValue([{ id: 'new-block' }]);
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: mockInsertBlocks,
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;

      const item = createDateTimeSlashItem(mockEditor);
      item.execute(mockEditor);

      expect(mockInsertBlocks).toHaveBeenCalledTimes(1);
      const [blocks] = mockInsertBlocks.mock.calls[0];
      expect(blocks[0].content[0].text).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });
  });

  describe('createSampleIdSlashItems - BlockNote ReactSlashMenuItem 형식', () => {
    it('should create items for all sample types', () => {
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: vi.fn().mockReturnValue([{ id: 'new-block' }]),
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;
      const items = createSampleIdSlashItems(mockEditor);
      
      expect(items.length).toBe(SAMPLE_TYPES.length);
      
      // Verify all types have items
      for (const type of SAMPLE_TYPES) {
        const item = items.find(i => i.name.includes(type));
        expect(item).toBeDefined();
      }
    });

    it('should have name property for each item (BlockNote requirement)', () => {
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: vi.fn().mockReturnValue([{ id: 'new-block' }]),
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;
      const items = createSampleIdSlashItems(mockEditor);
      
      const dnaItem = items.find(i => i.name.includes('DNA'));
      expect(dnaItem).toBeDefined();
      expect(dnaItem!.name).toBe('Insert DNA Sample ID');
    });

    it('should have execute function for each item', () => {
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: vi.fn().mockReturnValue([{ id: 'new-block' }]),
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;
      const items = createSampleIdSlashItems(mockEditor);
      
      items.forEach(item => {
        expect(typeof item.execute).toBe('function');
      });
    });

    it('should have aliases for each sample type', () => {
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: vi.fn().mockReturnValue([{ id: 'new-block' }]),
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;
      const items = createSampleIdSlashItems(mockEditor);
      
      const dnaItem = items.find(i => i.name.includes('DNA'));
      expect(dnaItem!.aliases).toContain('dna');
      
      const rnaItem = items.find(i => i.name.includes('RNA'));
      expect(rnaItem!.aliases).toContain('rna');
    });

    it('should insert sample ID when execute is called', () => {
      const mockInsertBlocks = vi.fn().mockReturnValue([{ id: 'new-block' }]);
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: mockInsertBlocks,
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;

      const items = createSampleIdSlashItems(mockEditor);
      const dnaItem = items.find(i => i.name.includes('DNA'));
      
      dnaItem!.execute(mockEditor);

      expect(mockInsertBlocks).toHaveBeenCalledTimes(1);
      const [blocks] = mockInsertBlocks.mock.calls[0];
      expect(blocks[0].content[0].text).toMatch(/^DNA-\d+(-\d+)?$/);
    });
  });

  describe('hint property for better UX (BlockNote standard)', () => {
    it('should have hint explaining the command', () => {
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: vi.fn().mockReturnValue([{ id: 'new-block' }]),
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;
      
      const dateItem = createDateSlashItem(mockEditor);
      expect(dateItem.hint).toBeDefined();
      expect(dateItem.hint).toContain('YYYY-MM-DD');

      const datetimeItem = createDateTimeSlashItem(mockEditor);
      expect(datetimeItem.hint).toBeDefined();

      const sampleItems = createSampleIdSlashItems(mockEditor);
      sampleItems.forEach(item => {
        expect(item.hint).toBeDefined();
      });
    });
  });

  describe('Workflow Templates', () => {
    it('should export WORKFLOWS constant', async () => {
      const { WORKFLOWS } = await import('../data/workflows');
      expect(WORKFLOWS).toBeDefined();
      expect(Array.isArray(WORKFLOWS)).toBe(true);
      expect(WORKFLOWS.length).toBeGreaterThan(0);
    });

    it('should have Design, Build, Test, Learn categories', async () => {
      const { WORKFLOWS } = await import('../data/workflows');
      const categories = [...new Set(WORKFLOWS.map(w => w.category))];
      expect(categories).toContain('Design');
      expect(categories).toContain('Build');
      expect(categories).toContain('Test');
      expect(categories).toContain('Learn');
    });

    it('should have id, name, description, category for each workflow', async () => {
      const { WORKFLOWS } = await import('../data/workflows');
      WORKFLOWS.forEach(workflow => {
        expect(workflow).toHaveProperty('id');
        expect(workflow).toHaveProperty('name');
        expect(workflow).toHaveProperty('description');
        expect(workflow).toHaveProperty('category');
      });
    });

    it('should export createWorkflowSlashItems function', async () => {
      const { createWorkflowSlashItems } = await import('../slashCommands');
      expect(typeof createWorkflowSlashItems).toBe('function');
    });

    it('should create slash item for /workflow command', async () => {
      const { createWorkflowSlashItems } = await import('../slashCommands');
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: vi.fn().mockReturnValue([{ id: 'new-block' }]),
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;

      const items = createWorkflowSlashItems(mockEditor);
      expect(items.length).toBeGreaterThan(0);
      
      // Check first item has proper structure
      const firstItem = items[0];
      expect(firstItem).toHaveProperty('name');
      expect(firstItem).toHaveProperty('execute');
      expect(firstItem).toHaveProperty('aliases');
      expect(firstItem).toHaveProperty('group', 'Workflow');
    });

    it('should insert workflow template when execute is called', async () => {
      const { createWorkflowSlashItems } = await import('../slashCommands');
      const mockInsertBlocks = vi.fn().mockReturnValue([{ id: 'new-block' }]);
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: mockInsertBlocks,
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;

      const items = createWorkflowSlashItems(mockEditor);
      const firstItem = items[0];
      
      firstItem.execute(mockEditor);

      expect(mockInsertBlocks).toHaveBeenCalled();
    });
  });

  describe('Unit Operations', () => {
    it('should export UNIT_OPERATIONS constant', async () => {
      const { UNIT_OPERATIONS } = await import('../data/unitOperations');
      expect(UNIT_OPERATIONS).toBeDefined();
      expect(Array.isArray(UNIT_OPERATIONS)).toBe(true);
      expect(UNIT_OPERATIONS.length).toBeGreaterThan(0);
    });

    it('should have Hardware and Software categories', async () => {
      const { UNIT_OPERATIONS } = await import('../data/unitOperations');
      const categories = [...new Set(UNIT_OPERATIONS.map(op => op.category))];
      expect(categories).toContain('Hardware');
      expect(categories).toContain('Software');
    });

    it('should have id, name, description, category for each operation', async () => {
      const { UNIT_OPERATIONS } = await import('../data/unitOperations');
      UNIT_OPERATIONS.forEach(op => {
        expect(op).toHaveProperty('id');
        expect(op).toHaveProperty('name');
        expect(op).toHaveProperty('description');
        expect(op).toHaveProperty('category');
      });
    });

    it('should export createOperationSlashItems function', async () => {
      const { createOperationSlashItems } = await import('../slashCommands');
      expect(typeof createOperationSlashItems).toBe('function');
    });

    it('should create slash item for /operation command', async () => {
      const { createOperationSlashItems } = await import('../slashCommands');
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: vi.fn().mockReturnValue([{ id: 'new-block' }]),
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;

      const items = createOperationSlashItems(mockEditor);
      expect(items.length).toBeGreaterThan(0);
      
      // Check first item has proper structure
      const firstItem = items[0];
      expect(firstItem).toHaveProperty('name');
      expect(firstItem).toHaveProperty('execute');
      expect(firstItem).toHaveProperty('aliases');
      expect(firstItem).toHaveProperty('group', 'Operation');
    });

    it('should insert operation template when execute is called', async () => {
      const { createOperationSlashItems } = await import('../slashCommands');
      const mockInsertBlocks = vi.fn().mockReturnValue([{ id: 'new-block' }]);
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: mockInsertBlocks,
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;

      const items = createOperationSlashItems(mockEditor);
      const firstItem = items[0];
      
      firstItem.execute(mockEditor);

      expect(mockInsertBlocks).toHaveBeenCalled();
    });

    it('should include all required sections in operation template', async () => {
      const { createOperationSlashItems } = await import('../slashCommands');
      const mockInsertBlocks = vi.fn().mockReturnValue([{ id: 'new-block' }]);
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: mockInsertBlocks,
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;

      const items = createOperationSlashItems(mockEditor);
      const firstItem = items[0];
      
      firstItem.execute(mockEditor);

      const [blocks] = mockInsertBlocks.mock.calls[0];
      
      // Should have at least 17 blocks:
      // 1 heading + 1 description + 1 separator + 8 section headings + 8+ section contents
      expect(blocks.length).toBeGreaterThanOrEqual(17);
      
      // Extract all text content from blocks
      const allText = blocks.map((b: any) => {
        if (b.content && Array.isArray(b.content)) {
          return b.content.map((c: any) => c.text || '').join('');
        }
        return '';
      }).join('\n');
      
      // Check for required section headings
      expect(allText).toContain('Meta');
      expect(allText).toContain('Input');
      expect(allText).toContain('Reagent');
      expect(allText).toContain('Consumables');
      expect(allText).toContain('Equipment');
      expect(allText).toContain('Method');
      expect(allText).toContain('Output');
      expect(allText).toContain('Results');
    });

    it('should include Meta section with Experimenter, Start_date, End_date', async () => {
      const { createOperationSlashItems } = await import('../slashCommands');
      const mockInsertBlocks = vi.fn().mockReturnValue([{ id: 'new-block' }]);
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: mockInsertBlocks,
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;

      const items = createOperationSlashItems(mockEditor);
      const firstItem = items[0];
      
      firstItem.execute(mockEditor);

      const [blocks] = mockInsertBlocks.mock.calls[0];
      
      // Extract all text content from blocks
      const allText = blocks.map((b: any) => {
        if (b.content && Array.isArray(b.content)) {
          return b.content.map((c: any) => c.text || '').join('');
        }
        return '';
      }).join('\n');
      
      // Check for Meta section fields
      expect(allText).toContain('Experimenter');
      expect(allText).toContain('Start_date');
      expect(allText).toContain('End_date');
    });

    it('should include Start_date with current datetime format', async () => {
      const { createOperationSlashItems } = await import('../slashCommands');
      const mockInsertBlocks = vi.fn().mockReturnValue([{ id: 'new-block' }]);
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: mockInsertBlocks,
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;

      const items = createOperationSlashItems(mockEditor);
      const firstItem = items[0];
      
      firstItem.execute(mockEditor);

      const [blocks] = mockInsertBlocks.mock.calls[0];
      
      // Extract all text content from blocks
      const allText = blocks.map((b: any) => {
        if (b.content && Array.isArray(b.content)) {
          return b.content.map((c: any) => c.text || '').join('');
        }
        return '';
      }).join('\n');
      
      // Check for datetime format in Start_date (YYYY-MM-DD HH:mm)
      expect(allText).toMatch(/Start_date.*\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
    });
  });
});
