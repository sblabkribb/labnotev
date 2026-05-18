import { mockVscode } from './setup';

// The helper relies on `findSampleDefinitionMatch` to locate the
// `@type;id;alias[:description]` slice in a document. To keep this test
// focused on the fallback ordering (active webview → active plain editor →
// sources[0] → workspace scan), we stub the matcher to return the first
// `@<TYPE>;<ID>` occurrence regardless of `(type, id, alias)`.
vi.mock('../lib/sampleStorage', () => ({
  findSampleDefinitionMatch: vi.fn((text: string) => {
    const m = text.match(/@\w+;\w+(?:;[^\n]*)?/);
    return m && m.index !== undefined
      ? { start: m.index, length: m[0].length }
      : null;
  }),
}));

// fs.existsSync is the only fs call the helper makes (for the sources[0]
// fallback). Stub it so we can deterministically opt into / out of that
// branch without writing real files.
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return { ...actual, existsSync: vi.fn(() => false) };
});

const baseItem = {
  sampleType: 'Reagent',
  sampleId: 'R001',
  alias: null,
  scope: 'local' as const,
};

describe('resolveDefinitionDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVscode.window.activeTextEditor = undefined;
    mockVscode.workspace.findFiles = vi.fn().mockResolvedValue([]);
  });

  it('(a) returns the active Section Editor document when it matches', async () => {
    const { resolveDefinitionDocument } = await import('../commands/sampleCommands');
    const activeDoc = {
      uri: { toString: () => 'file:///a.md', fsPath: '/a.md' },
      getText: () => '@Reagent;R001;alias:desc',
    };
    const result = await resolveDefinitionDocument(
      { getSampleSources: vi.fn(() => undefined) } as any,
      { getActiveDocument: () => activeDoc } as any,
      baseItem as any
    );
    expect(result?.doc).toBe(activeDoc);
    expect(result?.match.start).toBe(0);
  });

  it('(b) falls back to the active plain text editor (markdown)', async () => {
    const { resolveDefinitionDocument } = await import('../commands/sampleCommands');
    const plainDoc = {
      uri: { toString: () => 'file:///b.md', fsPath: '/b.md' },
      getText: () => '   @Reagent;R001;a:d',
      languageId: 'markdown',
    };
    mockVscode.window.activeTextEditor = { document: plainDoc } as any;
    const result = await resolveDefinitionDocument(
      { getSampleSources: vi.fn(() => undefined) } as any,
      { getActiveDocument: () => undefined } as any,
      baseItem as any
    );
    expect(result?.doc).toBe(plainDoc);
    expect(result?.match.start).toBe(3);
  });

  it('(c) opens sources[0] relative to the active doc directory', async () => {
    const fs = await import('fs');
    (fs.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const candDoc = {
      uri: { toString: () => 'file:///dir/src.md', fsPath: '/dir/src.md' },
      getText: () => '@Reagent;R001;x:y',
    };
    const openSpy = vi.fn().mockResolvedValue(candDoc);
    mockVscode.workspace.openTextDocument = openSpy as any;

    const { resolveDefinitionDocument } = await import('../commands/sampleCommands');
    const result = await resolveDefinitionDocument(
      { getSampleSources: vi.fn(() => ['src.md']) } as any,
      {
        getActiveDocument: () => ({
          uri: { fsPath: '/dir/active.md', toString: () => 'file:///dir/active.md' },
          getText: () => 'no match here',
        }),
      } as any,
      baseItem as any
    );
    expect(result?.doc).toBe(candDoc);
    expect(openSpy).toHaveBeenCalled();
  });

  it('(d) scans the workspace via findFiles as last resort', async () => {
    const wsUri = { toString: () => 'file:///x.labnote.md', fsPath: '/x.labnote.md' };
    const wsDoc = {
      uri: wsUri,
      getText: () => '@Reagent;R001;a:b',
    };
    mockVscode.workspace.findFiles = vi
      .fn()
      .mockResolvedValueOnce([wsUri as any]) // *.labnote.md
      .mockResolvedValueOnce([]); // *.workflow.md
    mockVscode.workspace.openTextDocument = vi.fn().mockResolvedValue(wsDoc) as any;

    const { resolveDefinitionDocument } = await import('../commands/sampleCommands');
    const result = await resolveDefinitionDocument(
      { getSampleSources: vi.fn(() => undefined) } as any,
      { getActiveDocument: () => undefined } as any,
      baseItem as any
    );
    expect(result?.doc).toBe(wsDoc);
    expect(mockVscode.workspace.findFiles).toHaveBeenCalledTimes(2);
  });

  it('returns undefined when no fallback can locate the definition', async () => {
    const { resolveDefinitionDocument } = await import('../commands/sampleCommands');
    const result = await resolveDefinitionDocument(
      { getSampleSources: vi.fn(() => undefined) } as any,
      { getActiveDocument: () => undefined } as any,
      baseItem as any
    );
    expect(result).toBeUndefined();
  });
});
