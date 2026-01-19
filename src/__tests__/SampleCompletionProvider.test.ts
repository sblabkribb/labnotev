/**
 * Tests for SampleCompletionProvider
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SampleCompletionProvider } from '../providers/SampleCompletionProvider';

// Mock vscode
vi.mock('vscode', () => ({
  languages: {
    registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })),
  },
  CompletionItem: vi.fn().mockImplementation((label, kind) => ({
    label,
    kind,
    insertText: undefined,
    detail: undefined,
    sortText: undefined,
    command: undefined,
    documentation: undefined,
    range: undefined,
  })),
  CompletionItemKind: {
    Reference: 1,
    Event: 2,
    Snippet: 3,
  },
  MarkdownString: vi.fn().mockImplementation((value) => ({ value })),
  Range: vi.fn().mockImplementation((startLine, startChar, endLine, endChar) => ({
    start: { line: startLine, character: startChar },
    end: { line: endLine, character: endChar },
  })),
}));

// Mock dataLoader
vi.mock('../lib/dataLoader', () => ({
  SAMPLE_TYPES: ['DNA', 'RNA', 'Plasmid', 'Reagent', 'Primer', 'Equip', 'Labware'],
  MONGO_BACKED_TYPES: ['Equip', 'Labware'],
  loadIdsByType: vi.fn(() => []),
  getSampleInfo: vi.fn(() => null),
  getMongoIds: vi.fn(() => []),
  getMongoRecord: vi.fn(() => undefined),
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
      // Mock sample data with alias and description
      const { loadIdsByType, getSampleInfo } = await import('../lib/dataLoader');
      vi.mocked(loadIdsByType).mockReturnValue(['DNA-123']);
      vi.mocked(getSampleInfo).mockReturnValue({
        alias: 'SampleA',
        descriptions: ['Test description'],
        sources: [],
      });

      const document = createMockDocument('@dna:');
      const position = createMockPosition(0, 5);

      const result = provider.provideCompletionItems(
        document as any,
        position as any,
        {} as any,
        {} as any
      ) as any[];

      // Find the sample completion item (not the "새 ID 생성" option)
      const sampleItem = result.find((item: any) => item.sortText?.startsWith('0_'));
      
      expect(sampleItem).toBeDefined();
      // insertText should be "ID|Alias" without description
      expect(sampleItem.insertText).toBe('DNA-123|SampleA');
      // Should NOT contain description
      expect(sampleItem.insertText).not.toContain('Test description');
    });

    it('should include only ID when sample has no alias', async () => {
      const { loadIdsByType, getSampleInfo } = await import('../lib/dataLoader');
      vi.mocked(loadIdsByType).mockReturnValue(['DNA-456']);
      vi.mocked(getSampleInfo).mockReturnValue({
        alias: null,
        descriptions: ['Some description'],
        sources: [],
      });

      const document = createMockDocument('@dna:');
      const position = createMockPosition(0, 5);

      const result = provider.provideCompletionItems(
        document as any,
        position as any,
        {} as any,
        {} as any
      ) as any[];

      const sampleItem = result.find((item: any) => item.sortText?.startsWith('0_'));
      
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
