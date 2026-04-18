/**
 * Tests for SampleCompletionProvider
 */
import { SampleCompletionProvider } from '../providers/SampleCompletionProvider';

// Mock vscode
vi.mock('vscode', () => ({
  languages: {
    registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })),
  },
  workspace: {
    getWorkspaceFolder: vi.fn(() => ({ uri: { fsPath: '/workspace' } })),
  },
  window: {
    createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })),
  },
  CompletionItem: class MockCompletionItem {
    label: string;
    kind: number;
    insertText?: string;
    detail?: string;
    sortText?: string;
    command?: unknown;
    documentation?: unknown;
    range?: unknown;
    constructor(label: string, kind: number) {
      this.label = label;
      this.kind = kind;
    }
  },
  // Extend Array so tests can use Array.isArray(result) and result.find(...)
  CompletionList: class MockCompletionList extends Array {
    isIncomplete: boolean;
    constructor(items: unknown[], isIncomplete: boolean) {
      super(...items);
      this.isIncomplete = isIncomplete;
    }
  },
  CompletionItemKind: {
    Reference: 1,
    Event: 2,
    Snippet: 3,
  },
  MarkdownString: vi.fn().mockImplementation((value) => ({ value })),
  Range: class MockRange {
    start: { line: number; character: number };
    end: { line: number; character: number };
    constructor(
      startLine: number,
      startChar: number,
      endLine: number,
      endChar: number
    ) {
      this.start = { line: startLine, character: startChar };
      this.end = { line: endLine, character: endChar };
    }
  },
}));

// Mock dataLoader
vi.mock('../lib/dataLoader', () => ({
  SAMPLE_TYPES: ['DNA', 'RNA', 'Plasmid', 'Reagent', 'Primer', 'Protein', 'Equip', 'Labware'],
  MONGO_BACKED_TYPES: ['Equip', 'Labware'],
  getMongoIds: vi.fn(() => []),
  getMongoRecord: vi.fn(() => undefined),
}));

// Mock sampleStorage (completion uses same paths as Sample TreeView)
vi.mock('../lib/sampleStorage', () => ({
  getLabsamplesFolder: vi.fn((documentPath: string) => {
    const path = documentPath.replace(/[^/\\]+$/, '').replace(/\\/g, '/');
    return path + 'resources/labsamples';
  }),
  getGlobalLabsamplesFolder: vi.fn((workspaceRoot: string) => workspaceRoot + '/resources/labsamples'),
  loadSamplesByType: vi.fn(() => ({})),
  loadReferenceSamplesByType: vi.fn(() => ({})),
}));

describe('SampleCompletionProvider', () => {
  let provider: SampleCompletionProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new SampleCompletionProvider();
  });

  describe('constructor', () => {
    it('should create a SampleCompletionProvider instance', () => {
      expect(provider).toBeDefined();
      expect(provider).toBeInstanceOf(SampleCompletionProvider);
    });
  });

  describe('provideCompletionItems', () => {
    const createMockDocument = (lineText: string) => ({
      lineAt: vi.fn().mockReturnValue({ text: lineText }),
      uri: { fsPath: '/test/file.md' },
      languageId: 'markdown',
    });

    const createMockPosition = (line: number, character: number) => ({
      line,
      character,
    });

    it('should return undefined for non-matching prefix', () => {
      const document = createMockDocument('Hello world');
      const position = createMockPosition(0, 11);

      const result = provider.provideCompletionItems(
        document as any,
        position as any,
        {} as any,
        {} as any
      );

      expect(result).toBeUndefined();
    });

    it('should return undefined for text without @ prefix', () => {
      const document = createMockDocument('dna:test');
      const position = createMockPosition(0, 8);

      const result = provider.provideCompletionItems(
        document as any,
        position as any,
        {} as any,
        {} as any
      );

      expect(result).toBeUndefined();
    });

    it('should handle @dna: prefix', () => {
      const document = createMockDocument('@dna:');
      const position = createMockPosition(0, 5);

      const result = provider.provideCompletionItems(
        document as any,
        position as any,
        {} as any,
        {} as any
      );

      // Should return completion items (even if empty array due to mocked loadIdsByType)
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle @dna without colon (trigger before colon inserted)', () => {
      const document = createMockDocument('@dna');
      const position = createMockPosition(0, 4);

      const result = provider.provideCompletionItems(
        document as any,
        position as any,
        {} as any,
        {} as any
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle @sample: prefix for all types', () => {
      const document = createMockDocument('@sample:');
      const position = createMockPosition(0, 8);

      const result = provider.provideCompletionItems(
        document as any,
        position as any,
        {} as any,
        {} as any
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle @item: as Labware alias', () => {
      const document = createMockDocument('@item:');
      const position = createMockPosition(0, 6);

      const result = provider.provideCompletionItems(
        document as any,
        position as any,
        {} as any,
        {} as any
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return undefined for unknown prefix', () => {
      const document = createMockDocument('@unknown:');
      const position = createMockPosition(0, 9);

      const result = provider.provideCompletionItems(
        document as any,
        position as any,
        {} as any,
        {} as any
      );

      expect(result).toBeUndefined();
    });
  });

  describe('insertText format', () => {
    const createMockDocument = (lineText: string) => ({
      lineAt: vi.fn().mockReturnValue({ text: lineText }),
      uri: { fsPath: '/test/file.md' },
      languageId: 'markdown',
    });

    const createMockPosition = (line: number, character: number) => ({
      line,
      character,
    });

    it('should exclude description from insertText when referencing existing sample', async () => {
      // Mock sampleStorage (completion uses same paths as Sample TreeView)
      const { loadSamplesByType } = await import('../lib/sampleStorage');
      vi.mocked(loadSamplesByType).mockReturnValue({
        'DNA-123': {
          type: 'DNA',
          alias: 'SampleA',
          descriptions: ['Test description'],
          sources: [],
        },
      });

      const document = createMockDocument('@dna:');
      const position = createMockPosition(0, 5);

      const result = provider.provideCompletionItems(
        document as any,
        position as any,
        {} as any,
        {} as any
      ) as any[];

      // Find the sample completion item (not the "새 ID 생성" option which uses 0_new)
      const sampleItem = result.find((item: any) => item.sortText?.startsWith('1_'));
      
      expect(sampleItem).toBeDefined();
      // insertText should be "ID|Alias" without description
      expect(sampleItem.insertText).toBe('DNA-123|SampleA');
      // Should NOT contain description
      expect(sampleItem.insertText).not.toContain('Test description');
    });

    it('should include only ID when sample has no alias', async () => {
      const { loadSamplesByType } = await import('../lib/sampleStorage');
      vi.mocked(loadSamplesByType).mockReturnValue({
        'DNA-456': {
          type: 'DNA',
          alias: null,
          descriptions: ['Some description'],
          sources: [],
        },
      });

      const document = createMockDocument('@dna:');
      const position = createMockPosition(0, 5);

      const result = provider.provideCompletionItems(
        document as any,
        position as any,
        {} as any,
        {} as any
      ) as any[];

      const sampleItem = result.find((item: any) => item.sortText?.startsWith('1_'));
      
      expect(sampleItem).toBeDefined();
      expect(sampleItem.insertText).toBe('DNA-456');
    });
  });

  describe('Generate New ID option availability', () => {
    const createMockDocument = (lineText: string) => ({
      lineAt: vi.fn().mockReturnValue({ text: lineText }),
      uri: { fsPath: '/test/file.md' },
      languageId: 'markdown',
    });

    const createMockPosition = (line: number, character: number) => ({
      line,
      character,
    });

    it('should NOT include "Generate New ID" option for Equip type', () => {
      const document = createMockDocument('@equip:');
      const position = createMockPosition(0, 7);

      const result = provider.provideCompletionItems(
        document as any,
        position as any,
        {} as any,
        {} as any
      ) as any[];

      // Find the "새 ID 생성" option
      const newIdOption = result.find((item: any) => 
        item.label?.includes('새') && item.label?.includes('ID 생성')
      );
      
      expect(newIdOption).toBeUndefined();
    });

    it('should include "정보 입력" option for Equip type so @equip: works', () => {
      const document = createMockDocument('@equip:');
      const position = createMockPosition(0, 7);

      const result = provider.provideCompletionItems(
        document as any,
        position as any,
        {} as any,
        {} as any
      ) as any[];

      const manualOption = result.find((item: any) => item.label === '정보 입력');
      expect(manualOption).toBeDefined();
      expect(manualOption?.command?.command).toBe('labnotev.inputSampleInfo');
    });

    it('should include "Generate New ID" option for Labware type', () => {
      const document = createMockDocument('@labware:');
      const position = createMockPosition(0, 9);

      const result = provider.provideCompletionItems(
        document as any,
        position as any,
        {} as any,
        {} as any
      ) as any[];

      const newIdOption = result.find((item: any) => 
        item.label?.includes('새') && item.label?.includes('ID 생성')
      );
      
      expect(newIdOption).toBeDefined();
    });

    it('should include "Generate New ID" option for DNA type', () => {
      const document = createMockDocument('@dna:');
      const position = createMockPosition(0, 5);

      const result = provider.provideCompletionItems(
        document as any,
        position as any,
        {} as any,
        {} as any
      ) as any[];

      const newIdOption = result.find((item: any) => 
        item.label?.includes('새') && item.label?.includes('ID 생성')
      );
      
      expect(newIdOption).toBeDefined();
    });

    it('should NOT include "Generate New ID" option for @sample: prefix', () => {
      const document = createMockDocument('@sample:');
      const position = createMockPosition(0, 8);

      const result = provider.provideCompletionItems(
        document as any,
        position as any,
        {} as any,
        {} as any
      ) as any[];

      const newIdOption = result.find((item: any) => 
        item.label?.includes('새') && item.label?.includes('ID 생성')
      );
      
      expect(newIdOption).toBeUndefined();
    });
  });
});

describe('createSampleCompletionProvider', () => {
  it('should be exported as a function', async () => {
    const { createSampleCompletionProvider } = await import('../providers/SampleCompletionProvider');
    expect(typeof createSampleCompletionProvider).toBe('function');
  });

  it('should return a disposable when called', async () => {
    const { createSampleCompletionProvider } = await import('../providers/SampleCompletionProvider');
    const disposable = createSampleCompletionProvider();
    expect(disposable).toBeDefined();
    expect(disposable).toHaveProperty('dispose');
  });
});
