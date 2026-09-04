/**
 * Regression tests for the SampleCompletionProvider records cache.
 *
 * The cache used to be freshness-checked via `fs.statSync().mtimeMs`. The
 * platform-neutral `LabnoteFs` port exposes no `stat`, so the cache is now
 * keyed purely by `<localFolder>|<globalFolder>|<type>` and invalidated
 * *explicitly* via {@link refreshSampleRecordsCache}. These tests pin that
 * contract: repeated lookups reuse the cache, changed-on-disk data is NOT
 * observed until an explicit refresh, and a refresh forces a re-read.
 */
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
    filterText?: string;
    constructor(label: string, kind: number) {
      this.label = label;
      this.kind = kind;
    }
  },
  CompletionList: class extends Array {
    isIncomplete: boolean;
    constructor(items: unknown[], isIncomplete: boolean) {
      super(...(items as unknown[]) as never[]);
      this.isIncomplete = isIncomplete;
    }
  },
  CompletionItemKind: { Reference: 1, Event: 2, Snippet: 3 },
  MarkdownString: vi.fn().mockImplementation((v) => ({ value: v })),
  l10n: {
    t: vi.fn((message: string | { message: string; args?: Array<string | number | boolean> }, ...args: Array<string | number | boolean>) => {
      const fmt = (s: string, a: Array<string | number | boolean>) =>
        a.length ? s.replace(/\{(\d+)\}/g, (_m, i) => String(a[Number(i)] ?? '')) : s;
      if (typeof message === 'string') return fmt(message, args);
      return fmt(message.message, message.args ?? []);
    }),
    bundle: undefined,
    uri: undefined,
  },
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
}));

vi.mock('../lib/sampleStorage', () => ({
  getLabsamplesFolder: vi.fn((docPath: string) =>
    docPath.replace(/[^/\\]+$/, '').replace(/\\/g, '/') + 'resources/labsamples'
  ),
  getGlobalLabsamplesFolder: vi.fn((root: string) => root + '/resources/labsamples'),
  loadSamplesByType: vi.fn(() =>
    Promise.resolve({ 'DNA-1': { type: 'DNA', alias: 'A', descriptions: [], sources: [] } })
  ),
  loadReferenceSamplesByType: vi.fn(() => Promise.resolve({})),
}));

const createDoc = (text: string) => ({
  lineAt: vi.fn().mockReturnValue({ text }),
  uri: { fsPath: '/test/file.md' },
  languageId: 'markdown',
});
const createPos = (line: number, character: number) => ({ line, character });

describe('SampleCompletionProvider records cache (explicit invalidation)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { refreshSampleRecordsCache } = await import('../providers/SampleCompletionProvider');
    refreshSampleRecordsCache();
  });

  it('does not re-read disk on a second call for the same key (cache hit)', async () => {
    const { SampleCompletionProvider } = await import('../providers/SampleCompletionProvider');
    const { loadSamplesByType } = await import('../lib/sampleStorage');
    const provider = new SampleCompletionProvider();

    await provider.provideCompletionItems(createDoc('@dna:') as any, createPos(0, 5) as any, {} as any, {} as any);
    const firstCallCount = (loadSamplesByType as any).mock.calls.length;

    await provider.provideCompletionItems(createDoc('@dna:') as any, createPos(0, 5) as any, {} as any, {} as any);
    const secondCallCount = (loadSamplesByType as any).mock.calls.length;

    expect(secondCallCount).toBe(firstCallCount);
  });

  it('keeps serving cached data when the underlying JSON changes but no refresh is issued', async () => {
    const { SampleCompletionProvider } = await import('../providers/SampleCompletionProvider');
    const { loadSamplesByType } = await import('../lib/sampleStorage');
    const provider = new SampleCompletionProvider();

    await provider.provideCompletionItems(createDoc('@dna:') as any, createPos(0, 5) as any, {} as any, {} as any);
    const firstCallCount = (loadSamplesByType as any).mock.calls.length;

    // Simulate on-disk data changing. Without an explicit refresh the provider
    // must NOT re-read — freshness is no longer tracked by mtime.
    (loadSamplesByType as any).mockResolvedValue({
      'DNA-2': { type: 'DNA', alias: 'B', descriptions: [], sources: [] },
    });
    await provider.provideCompletionItems(createDoc('@dna:') as any, createPos(0, 5) as any, {} as any, {} as any);
    const secondCallCount = (loadSamplesByType as any).mock.calls.length;

    expect(secondCallCount).toBe(firstCallCount);
  });

  it('refreshSampleRecordsCache clears the cache so the next call re-reads disk', async () => {
    const { SampleCompletionProvider, refreshSampleRecordsCache } = await import(
      '../providers/SampleCompletionProvider'
    );
    const { loadSamplesByType } = await import('../lib/sampleStorage');
    const provider = new SampleCompletionProvider();

    await provider.provideCompletionItems(createDoc('@dna:') as any, createPos(0, 5) as any, {} as any, {} as any);
    const firstCallCount = (loadSamplesByType as any).mock.calls.length;

    refreshSampleRecordsCache();
    await provider.provideCompletionItems(createDoc('@dna:') as any, createPos(0, 5) as any, {} as any, {} as any);
    const secondCallCount = (loadSamplesByType as any).mock.calls.length;

    expect(secondCallCount).toBeGreaterThan(firstCallCount);
  });

  it('skips disk lookup entirely when the line has no @ prefix', async () => {
    const { SampleCompletionProvider } = await import('../providers/SampleCompletionProvider');
    const { loadSamplesByType } = await import('../lib/sampleStorage');
    const provider = new SampleCompletionProvider();

    const result = await provider.provideCompletionItems(
      createDoc('hello world') as any,
      createPos(0, 11) as any,
      {} as any,
      {} as any
    );

    expect(result).toBeUndefined();
    expect(loadSamplesByType).not.toHaveBeenCalled();
  });
});
