/**
 * Regression for the cross-platform casing bug in the completion cache.
 *
 * `loadSampleIdsAndRecords` reads `${type}.json` (e.g. `DNA.json`) but the cache
 * invalidation list used to be built from `${type.toLowerCase()}.json`
 * (`dna.json`). On a case-sensitive filesystem the lowercase file does not
 * exist, so `statSync` throws and `fileMtime` returns `null`; the freshness
 * check `null === storedMtime` is always false, so the cache is never fresh and
 * the provider re-reads disk on every keystroke — defeating the Phase D-1 cache.
 *
 * This test models a case-sensitive FS: `statSync` only knows the uppercase
 * paths and throws for anything else. The "no re-read when unchanged" assertion
 * therefore fails when the tracked files use the wrong casing.
 */
import * as path from 'path';

const mtimes: Record<string, number> = {};

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    default: actual,
    statSync: vi.fn((p: string) => {
      const mtimeMs = mtimes[p];
      if (mtimeMs === undefined) {
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }
      return { mtimeMs };
    }),
  };
});

vi.mock('vscode', () => ({
  languages: { registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })) },
  workspace: { getWorkspaceFolder: vi.fn(() => ({ uri: { fsPath: '/workspace' } })) },
  window: { createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })) },
  CompletionItem: class {
    label: string;
    kind: number;
    insertText?: string;
    detail?: string;
    sortText?: string;
    command?: unknown;
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
  l10n: { t: vi.fn((m: string) => m), bundle: undefined, uri: undefined },
  Range: class {
    constructor(
      public sl: number,
      public sc: number,
      public el: number,
      public ec: number
    ) {}
  },
}));

const LOCAL_FOLDER = path.join('/doc', 'resources', 'labsamples');
const GLOBAL_FOLDER = path.join('/workspace', 'resources', 'labsamples');

vi.mock('../lib/dataLoader', () => ({
  SAMPLE_TYPES: ['DNA', 'RNA', 'Plasmid', 'Reagent', 'Primer', 'Protein', 'Equip', 'Labware'],
}));

vi.mock('../lib/sampleStorage', () => ({
  getLabsamplesFolder: vi.fn(() => LOCAL_FOLDER),
  getGlobalLabsamplesFolder: vi.fn(() => GLOBAL_FOLDER),
  loadSamplesByType: vi.fn(() => ({ 'DNA-1': { type: 'DNA', alias: 'A', descriptions: [], sources: [] } })),
  loadReferenceSamplesByType: vi.fn(() => ({})),
}));

const createDoc = () => ({
  lineAt: vi.fn().mockReturnValue({ text: '@dna:' }),
  uri: { fsPath: path.join('/doc', 'file.md') },
  languageId: 'markdown',
});
const pos = { line: 0, character: 5 };

// The real on-disk files use the same casing `loadSamplesByType` reads.
const LOCAL_UPPER = path.join(LOCAL_FOLDER, 'DNA.json');
const GLOBAL_UPPER = path.join(GLOBAL_FOLDER, 'DNA.json');

describe('SampleCompletionProvider cache invalidation (case-sensitive FS)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    for (const k of Object.keys(mtimes)) delete mtimes[k];
    mtimes[LOCAL_UPPER] = 100;
    mtimes[GLOBAL_UPPER] = 100;
    const { refreshSampleRecordsCache } = await import('../providers/SampleCompletionProvider');
    refreshSampleRecordsCache();
  });

  it('does not re-read disk when the underlying file is unchanged (cache is effective)', async () => {
    const { SampleCompletionProvider } = await import('../providers/SampleCompletionProvider');
    const { loadSamplesByType } = await import('../lib/sampleStorage');
    const provider = new SampleCompletionProvider();

    provider.provideCompletionItems(createDoc() as any, pos as any, {} as any, {} as any);
    const firstCount = (loadSamplesByType as any).mock.calls.length;

    // Nothing changed on disk — the second call must hit the cache. With the
    // casing bug the tracked (lowercase) files don't exist, so freshness is
    // always false and the provider re-reads disk here.
    provider.provideCompletionItems(createDoc() as any, pos as any, {} as any, {} as any);
    const secondCount = (loadSamplesByType as any).mock.calls.length;

    expect(secondCount).toBe(firstCount);
  });

  it('re-reads disk when the real (uppercase) JSON file changes', async () => {
    const { SampleCompletionProvider } = await import('../providers/SampleCompletionProvider');
    const { loadSamplesByType } = await import('../lib/sampleStorage');
    const provider = new SampleCompletionProvider();

    provider.provideCompletionItems(createDoc() as any, pos as any, {} as any, {} as any);
    const firstCount = (loadSamplesByType as any).mock.calls.length;

    mtimes[LOCAL_UPPER] = 200;
    provider.provideCompletionItems(createDoc() as any, pos as any, {} as any, {} as any);
    const secondCount = (loadSamplesByType as any).mock.calls.length;

    expect(secondCount).toBeGreaterThan(firstCount);
  });
});
