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
import { calculateMatchScore } from '../Editor';

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

  // BlockNote 0.46 expects 'title' and 'onItemClick' properties (DefaultReactSuggestionItem interface)
  describe('슬래시 명령 BlockNote 호환성', () => {
    it('DefaultReactSuggestionItem 인터페이스와 호환되어야 함', () => {
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: vi.fn().mockReturnValue([{ id: 'new-block' }]),
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;

      const items = getLabNoteSlashMenuItems(mockEditor);
      items.forEach(item => {
        // BlockNote 0.46 필수 속성 확인 - title과 onItemClick 사용
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('onItemClick');
        expect(typeof item.onItemClick).toBe('function');
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

  describe('createDateSlashItem - BlockNote DefaultReactSuggestionItem 형식', () => {
    it('should have title property (BlockNote requirement)', () => {
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: vi.fn().mockReturnValue([{ id: 'new-block' }]),
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;
      const item = createDateSlashItem(mockEditor);
      
      expect(item.title).toBe('Insert Date');
      expect(item.aliases).toContain('date');
    });

    it('should have onItemClick function (BlockNote 0.46 requirement)', () => {
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: vi.fn().mockReturnValue([{ id: 'new-block' }]),
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;
      const item = createDateSlashItem(mockEditor);
      
      expect(typeof item.onItemClick).toBe('function');
    });

    it('should insert date when onItemClick is called', () => {
      const mockInsertBlocks = vi.fn().mockReturnValue([{ id: 'new-block' }]);
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: mockInsertBlocks,
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
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

  describe('createDateTimeSlashItem - BlockNote DefaultReactSuggestionItem 형식', () => {
    it('should have title property (BlockNote requirement)', () => {
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: vi.fn().mockReturnValue([{ id: 'new-block' }]),
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;
      const item = createDateTimeSlashItem(mockEditor);
      
      expect(item.title).toBe('Insert DateTime');
      expect(item.aliases).toContain('datetime');
      expect(item.aliases).toContain('now');
    });

    it('should have onItemClick function (BlockNote 0.46 requirement)', () => {
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: vi.fn().mockReturnValue([{ id: 'new-block' }]),
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;
      const item = createDateTimeSlashItem(mockEditor);
      
      expect(typeof item.onItemClick).toBe('function');
    });

    it('should insert datetime when onItemClick is called', () => {
      const mockInsertBlocks = vi.fn().mockReturnValue([{ id: 'new-block' }]);
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: mockInsertBlocks,
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;

      const item = createDateTimeSlashItem(mockEditor);
      item.onItemClick();

      expect(mockInsertBlocks).toHaveBeenCalledTimes(1);
      const [blocks] = mockInsertBlocks.mock.calls[0];
      expect(blocks[0].content[0].text).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });
  });

  describe('createSampleIdSlashItems - BlockNote DefaultReactSuggestionItem 형식', () => {
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
        const item = items.find(i => i.title.includes(type));
        expect(item).toBeDefined();
      }
    });

    it('should have title property for each item (BlockNote requirement)', () => {
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: vi.fn().mockReturnValue([{ id: 'new-block' }]),
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;
      const items = createSampleIdSlashItems(mockEditor);
      
      const dnaItem = items.find(i => i.title.includes('DNA'));
      expect(dnaItem).toBeDefined();
      expect(dnaItem!.title).toBe('Insert DNA Sample ID');
    });

    it('should have onItemClick function for each item', () => {
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: vi.fn().mockReturnValue([{ id: 'new-block' }]),
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;
      const items = createSampleIdSlashItems(mockEditor);
      
      items.forEach(item => {
        expect(typeof item.onItemClick).toBe('function');
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
      
      const dnaItem = items.find(i => i.title.includes('DNA'));
      expect(dnaItem!.aliases).toContain('dna');
      
      const rnaItem = items.find(i => i.title.includes('RNA'));
      expect(rnaItem!.aliases).toContain('rna');
    });

    it('should insert sample ID when onItemClick is called', () => {
      const mockInsertBlocks = vi.fn().mockReturnValue([{ id: 'new-block' }]);
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: mockInsertBlocks,
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;

      const items = createSampleIdSlashItems(mockEditor);
      const dnaItem = items.find(i => i.title.includes('DNA'));
      
      dnaItem!.onItemClick();

      expect(mockInsertBlocks).toHaveBeenCalledTimes(1);
      const [blocks] = mockInsertBlocks.mock.calls[0];
      expect(blocks[0].content[0].text).toMatch(/^DNA-\d+(-\d+)?$/);
    });
  });

  describe('subtext property for better UX (BlockNote standard)', () => {
    it('should have subtext explaining the command', () => {
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: vi.fn().mockReturnValue([{ id: 'new-block' }]),
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;
      
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
      
      // Check first item has proper structure for BlockNote 0.46
      const firstItem = items[0];
      expect(firstItem).toHaveProperty('title');
      expect(firstItem).toHaveProperty('onItemClick');
      expect(firstItem).toHaveProperty('aliases');
      expect(firstItem).toHaveProperty('group', 'Workflow');
    });

    it('should insert workflow template when onItemClick is called', async () => {
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
      
      firstItem.onItemClick();

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
      
      // Check first item has proper structure for BlockNote 0.46
      const firstItem = items[0];
      expect(firstItem).toHaveProperty('title');
      expect(firstItem).toHaveProperty('onItemClick');
      expect(firstItem).toHaveProperty('aliases');
      expect(firstItem).toHaveProperty('group', 'Operation');
    });

    it('should insert operation template when onItemClick is called', async () => {
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
      
      firstItem.onItemClick();

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
      
      firstItem.onItemClick();

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
      
      firstItem.onItemClick();

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
      
      firstItem.onItemClick();

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

  describe('createSampleSlashItemsWithExisting - 기존 샘플 목록 포함', () => {
    it('should create slash items including existing samples', async () => {
      const { createSampleSlashItemsWithExisting } = await import('../slashCommands');
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: vi.fn().mockReturnValue([{ id: 'new-block' }]),
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;

      const existingSamples = {
        'DNA-123': { type: 'DNA', alias: '샘플A', descriptions: ['설명A'], sources: ['test.md'] },
        'DNA-456': { type: 'DNA', alias: null, descriptions: [], sources: ['test.md'] },
      };

      const onNewSample = vi.fn();
      const items = createSampleSlashItemsWithExisting(
        mockEditor,
        'DNA',
        existingSamples,
        onNewSample
      );

      // Should have: 1 "새 ID 생성" + 2 existing samples = 3 items
      expect(items.length).toBe(3);

      // First item should be "새 ID 생성"
      expect(items[0].title).toContain('새 DNA ID 생성');
    });

    it('should include existing sample with alias in title', async () => {
      const { createSampleSlashItemsWithExisting } = await import('../slashCommands');
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: vi.fn().mockReturnValue([{ id: 'new-block' }]),
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;

      const existingSamples = {
        'DNA-123': { type: 'DNA', alias: '샘플A', descriptions: ['설명A'], sources: ['test.md'] },
      };

      const items = createSampleSlashItemsWithExisting(mockEditor, 'DNA', existingSamples, vi.fn());

      // Second item should be existing sample with alias
      expect(items[1].title).toBe('DNA-123 (샘플A)');
      expect(items[1].subtext).toBe('설명A');
    });

    it('should insert ID|alias format when existing sample selected', async () => {
      const { createSampleSlashItemsWithExisting } = await import('../slashCommands');
      const mockInsertBlocks = vi.fn().mockReturnValue([{ id: 'new-block' }]);
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: mockInsertBlocks,
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;

      const existingSamples = {
        'DNA-123': { type: 'DNA', alias: '샘플A', descriptions: ['설명A'], sources: ['test.md'] },
      };

      const items = createSampleSlashItemsWithExisting(mockEditor, 'DNA', existingSamples, vi.fn());
      
      // Click on existing sample
      items[1].onItemClick();

      // Should insert ID|alias format
      const [blocks] = mockInsertBlocks.mock.calls[0];
      expect(blocks[0].content[0].text).toBe('DNA-123|샘플A');
    });

    it('should insert ID only when existing sample has no alias', async () => {
      const { createSampleSlashItemsWithExisting } = await import('../slashCommands');
      const mockInsertBlocks = vi.fn().mockReturnValue([{ id: 'new-block' }]);
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: mockInsertBlocks,
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;

      const existingSamples = {
        'DNA-456': { type: 'DNA', alias: null, descriptions: ['어떤 설명'], sources: ['test.md'] },
      };

      const items = createSampleSlashItemsWithExisting(mockEditor, 'DNA', existingSamples, vi.fn());
      
      // Click on existing sample without alias
      items[1].onItemClick();

      // Should insert ID only
      const [blocks] = mockInsertBlocks.mock.calls[0];
      expect(blocks[0].content[0].text).toBe('DNA-456');
    });

    it('should call onNewSample callback when creating new ID', async () => {
      const { createSampleSlashItemsWithExisting } = await import('../slashCommands');
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: vi.fn().mockReturnValue([{ id: 'new-block' }]),
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;

      const onNewSample = vi.fn();
      const items = createSampleSlashItemsWithExisting(mockEditor, 'DNA', {}, onNewSample);
      
      // Click on "새 ID 생성"
      items[0].onItemClick();

      // Should call callback with new ID and type
      expect(onNewSample).toHaveBeenCalled();
      const [sampleType, sampleId] = onNewSample.mock.calls[0];
      expect(sampleType).toBe('DNA');
      expect(sampleId).toMatch(/^DNA-\d+/);
    });

    it('should work with empty existing samples', async () => {
      const { createSampleSlashItemsWithExisting } = await import('../slashCommands');
      const mockEditor = {
        getTextCursorPosition: () => ({ block: { id: 'test-block', content: [] } }),
        insertBlocks: vi.fn().mockReturnValue([{ id: 'new-block' }]),
        setTextCursorPosition: vi.fn(),
        removeBlocks: vi.fn(),
      } as any;

      const items = createSampleSlashItemsWithExisting(mockEditor, 'RNA', {}, vi.fn());

      // Should have only 1 item (새 ID 생성)
      expect(items.length).toBe(1);
      expect(items[0].title).toContain('새 RNA ID 생성');
    });
  });

  describe('calculateMatchScore - 다중 검색어 점수 계산', () => {
    it('should return 0 when no terms match', () => {
      const item = {
        title: 'Insert Date',
        subtext: 'Insert current date',
        aliases: ['date', 'today'],
      };
      const score = calculateMatchScore(item, ['xyz', 'abc']);
      expect(score).toBe(0);
    });

    it('should return 1 when one term matches title', () => {
      const item = {
        title: 'Insert Date',
        subtext: 'Insert current date',
        aliases: ['date', 'today'],
      };
      const score = calculateMatchScore(item, ['date']);
      expect(score).toBe(1);
    });

    it('should return 1 when one term matches subtext', () => {
      const item = {
        title: 'DNA Sample',
        subtext: 'enzyme buffer solution',
        aliases: ['dna'],
      };
      const score = calculateMatchScore(item, ['enzyme']);
      expect(score).toBe(1);
    });

    it('should return 1 when one term matches aliases', () => {
      const item = {
        title: 'Insert Date',
        subtext: 'Insert current date',
        aliases: ['date', 'today'],
      };
      const score = calculateMatchScore(item, ['today']);
      expect(score).toBe(1);
    });

    it('should return 2 when two terms match', () => {
      const item = {
        title: 'DNA-123 (sample1)',
        subtext: 'DNA sample description',
        aliases: ['dna-123', 'sample1'],
      };
      const score = calculateMatchScore(item, ['dna', '123']);
      expect(score).toBe(2);
    });

    it('should return 3 when three terms match', () => {
      const item = {
        title: 'DNA-123 (myalias)',
        subtext: 'enzyme buffer test',
        aliases: ['dna-123', 'myalias'],
      };
      const score = calculateMatchScore(item, ['dna', 'enzyme', 'myalias']);
      expect(score).toBe(3);
    });

    it('should be case insensitive', () => {
      const item = {
        title: 'DNA Sample',
        subtext: 'Enzyme Buffer',
        aliases: ['DNA', 'ENZYME'],
      };
      const score = calculateMatchScore(item, ['dna', 'ENZYME', 'buffer']);
      expect(score).toBe(3);
    });

    it('should handle items with missing optional fields', () => {
      const item = {
        title: 'Simple Item',
      };
      const score = calculateMatchScore(item, ['simple']);
      expect(score).toBe(1);
    });

    it('should handle empty query terms', () => {
      const item = {
        title: 'DNA Sample',
        subtext: 'description',
        aliases: ['dna'],
      };
      const score = calculateMatchScore(item, []);
      expect(score).toBe(0);
    });

    it('should correctly sort items by score', () => {
      const items = [
        { title: 'DNA-123', subtext: 'different', aliases: ['dna'] },      // score 1 (dna only)
        { title: 'DNA-456 (test)', subtext: 'buffer enzyme', aliases: ['dna', 'test'] }, // score 2 (dna + enzyme)
        { title: 'RNA-789', subtext: 'different', aliases: ['rna'] },      // score 0 (no match)
      ];
      const queryTerms = ['dna', 'enzyme'];
      
      const scoredItems = items
        .map(item => ({ item, score: calculateMatchScore(item, queryTerms) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score);
      
      // DNA-456 has highest score (dna + enzyme = 2)
      expect(scoredItems[0].item.title).toBe('DNA-456 (test)');
      expect(scoredItems[0].score).toBe(2);
      
      // DNA-123 has score 1 (dna only)
      expect(scoredItems[1].item.title).toBe('DNA-123');
      expect(scoredItems[1].score).toBe(1);
      
      // RNA-789 should be filtered out (score 0)
      expect(scoredItems.length).toBe(2);
    });
  });
});
