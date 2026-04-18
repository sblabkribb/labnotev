/**
 * Phase D-5: regression tests for the mtime-based cache in
 * SampleCompletionProvider (Phase D-1).
 *
 * We mock `fs` so `statSync(...).mtimeMs` is test-controllable; the cache key
 * only depends on paths + type, so we never need the real filesystem.
 */
const statMtime = { value: 100 };

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    default: actual,
    statSync: vi.fn((_p: string) => ({ mtimeMs: statMtime.value })),
  };
});

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
  CompletionItem: class {
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
  CompletionList: class extends Array {
    isIncomplete: boolean;
    constructor(items: unknown[], isIncomplete: boolean) {
      super(...items);
      this.isIncomplete = isIncomplete;
    }
  },
  CompletionItemKind: { Reference: 1, Event: 2, Snippet: 3 },
  MarkdownString: vi.fn().mockImplementation((v) => ({ value: v })),
  Range: class {
    start: { line: number; character: number };
    end: { line: number; character: number };
    constructor(sl: number, sc: number, el: number, ec: number) {
      this.start = { line: sl, character: sc };
      this.end = { line: el, character: ec };
    }
  },
}));

vi.mock('../lib/dataLoader', () => ({
  SAMPLE_TYPES: ['DNA', 'RNA', 'Plasmid', 'Reagent', 'Primer', 'Protein', 'Equip', 'Labware'],
  MONGO_BACKED_TYPES: ['Equip', 'Labware'],
  getMongoIds: vi.fn(() => []),
  getMongoRecord: vi.fn(() => undefined),
  ensureRemoteDataLoaded: vi.fn(() => Promise.resolve()),
}));

vi.mock('../lib/sampleStorage', () => ({
  getLabsamplesFolder: vi.fn((docPath: string) =>
    docPath.replace(/[^/\\]+$/, '').replace(/\\/g, '/') + 'resources/labsamples'
  ),
  getGlobalLabsamplesFolder: vi.fn((root: string) => root + '/resources/labsamples'),
  loadSamplesByType: vi.fn(() => ({ 'DNA-1': { type: 'DNA', alias: 'A', descriptions: [], sources: [] } })),
  loadReferenceSamplesByType: vi.fn(() => ({})),
}));

const createDoc = (text: string) => ({
  lineAt: vi.fn().mockReturnValue({ text }),
  uri: { fsPath: '/test/file.md' },
  languageId: 'markdown',
});
const createPos = (line: number, character: number) => ({ line, character });

describe('SampleCompletionProvider mtime cache (Phase D-1)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    statMtime.value = 100;
    const { refreshSampleRecordsCache } = await import('../providers/SampleCompletionProvider');
    refreshSampleRecordsCache();
  });

  it('does not re-read JSON when mtime is unchanged', async () => {
    const { SampleCompletionProvider } = await import('../providers/SampleCompletionProvider');
    const { loadSamplesByType } = await import('../lib/sampleStorage');
    const provider = new SampleCompletionProvider();

    provider.provideCompletionItems(createDoc('@dna:') as any, createPos(0, 5) as any, {} as any, {} as any);
    const firstCallCount = (loadSamplesByType as any).mock.calls.length;

    provider.provideCompletionItems(createDoc('@dna:') as any, createPos(0, 5) as any, {} as any, {} as any);
    const secondCallCount = (loadSamplesByType as any).mock.calls.length;

    expect(secondCallCount).toBe(firstCallCount);
  });

  it('invalidates the cache when mtime of an underlying file changes', async () => {
    const { SampleCompletionProvider } = await import('../providers/SampleCompletionProvider');
    const { loadSamplesByType } = await import('../lib/sampleStorage');
    const provider = new SampleCompletionProvider();

    provider.provideCompletionItems(createDoc('@dna:') as any, createPos(0, 5) as any, {} as any, {} as any);
    const firstCallCount = (loadSamplesByType as any).mock.calls.length;

    statMtime.value = 200;
    provider.provideCompletionItems(createDoc('@dna:') as any, createPos(0, 5) as any, {} as any, {} as any);
    const secondCallCount = (loadSamplesByType as any).mock.calls.length;

    expect(secondCallCount).toBeGreaterThan(firstCallCount);
  });

  it('refreshSampleRecordsCache clears the cache so the next call re-reads disk', async () => {
    const { SampleCompletionProvider, refreshSampleRecordsCache } = await import(
      '../providers/SampleCompletionProvider'
    );
    const { loadSamplesByType } = await import('../lib/sampleStorage');
    const provider = new SampleCompletionProvider();

    provider.provideCompletionItems(createDoc('@dna:') as any, createPos(0, 5) as any, {} as any, {} as any);
    const firstCallCount = (loadSamplesByType as any).mock.calls.length;

    refreshSampleRecordsCache();
    provider.provideCompletionItems(createDoc('@dna:') as any, createPos(0, 5) as any, {} as any, {} as any);
    const secondCallCount = (loadSamplesByType as any).mock.calls.length;

    expect(secondCallCount).toBeGreaterThan(firstCallCount);
  });

  it('skips disk lookup entirely when the line has no @ prefix', async () => {
    const { SampleCompletionProvider } = await import('../providers/SampleCompletionProvider');
    const { loadSamplesByType } = await import('../lib/sampleStorage');
    const provider = new SampleCompletionProvider();

    const result = provider.provideCompletionItems(
      createDoc('hello world') as any,
      createPos(0, 11) as any,
      {} as any,
      {} as any
    );

    expect(result).toBeUndefined();
    expect(loadSamplesByType).not.toHaveBeenCalled();
  });
});
