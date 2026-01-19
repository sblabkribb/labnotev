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
  })),
  CompletionItemKind: {
    Reference: 1,
    Event: 2,
    Snippet: 3,
  },
  MarkdownString: vi.fn().mockImplementation((value) => ({ value })),
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
