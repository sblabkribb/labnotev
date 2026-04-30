import { mockVscode } from './setup';

describe('SectionEditorProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have viewType labnotev.sectionEditor', async () => {
    const { SectionEditorProvider } = await import('../sectionEditorProvider');
    expect(SectionEditorProvider.viewType).toBe('labnotev.sectionEditor');
  });

  it('should detect labnote file type from experiment_type in front matter', async () => {
    const { detectMdFileType } = await import('../sectionEditorProvider');
    const md = `---
title: Test
author: Test
experiment_type: labnote
sample_tracking: yes
created_date: 2026-01-01
last_updated_date: 2026-01-01
---
`;
    expect(detectMdFileType(md)).toBe('labnote');
  });

  it('should detect workflow file type from experimenter field', async () => {
    const { detectMdFileType } = await import('../sectionEditorProvider');
    const md = `---
title: WD010 Test
experimenter: 홍길동
created_date: 2026-01-01
last_updated_date: 2026-01-01
end_date: ''
---

## [WD010 Test]

> Description
`;
    expect(detectMdFileType(md)).toBe('workflow');
  });

  it('should return unknown for non-lab MD files', async () => {
    const { detectMdFileType } = await import('../sectionEditorProvider');
    const md = `# Just a regular markdown file

Some content here.
`;
    expect(detectMdFileType(md)).toBe('unknown');
  });

  it('should build HW unit operation block with default sections', async () => {
    const { buildUnitOperationBlock } = await import('../sectionEditorProvider');
    const block = buildUnitOperationBlock('HW001', 'Centrifugation', 'Separate by centrifugal force', 'hw', '홍길동');
    expect(block.opId).toBe('HW001');
    expect(block.opName).toBe('Centrifugation');
    expect(block.opType).toBe('hw');
    expect(block.sections.some(s => s.heading === 'Meta')).toBe(true);
    expect(block.sections.some(s => s.heading === 'Input')).toBe(true);
    expect(block.sections.some(s => s.heading === 'Reagent')).toBe(true);
    expect(block.sections.some(s => s.heading === 'Equipment')).toBe(true);
    expect(block.sections.some(s => s.heading === 'Method')).toBe(true);
    expect(block.sections.some(s => s.heading === 'Output')).toBe(true);
  });

  it('should build SW unit operation block with default sections', async () => {
    const { buildUnitOperationBlock } = await import('../sectionEditorProvider');
    const block = buildUnitOperationBlock('SW001', 'Data Analysis', 'Analyze data', 'sw', '홍길동');
    expect(block.opId).toBe('SW001');
    expect(block.opType).toBe('sw');
    expect(block.sections.some(s => s.heading === 'Meta')).toBe(true);
    expect(block.sections.some(s => s.heading === 'Input')).toBe(true);
    expect(block.sections.some(s => s.heading === 'Output')).toBe(true);
    expect(block.sections.some(s => s.heading === 'Parameters')).toBe(true);
    expect(block.sections.some(s => s.heading === 'Environment')).toBe(true);
    expect(block.sections.some(s => s.heading === 'Discussion')).toBe(true);
  });

  it('should expose getActiveDocument returning undefined when no document is active', async () => {
    const { SectionEditorProvider } = await import('../sectionEditorProvider');
    const mockContext = {
      subscriptions: [],
      extensionUri: { fsPath: '/test' },
      extensionPath: '/test',
    } as any;
    const provider = new SectionEditorProvider(mockContext);
    expect(provider.getActiveDocument()).toBeUndefined();
  });

  it('should expose getEditorMode returning undefined when no document is active', async () => {
    const { SectionEditorProvider } = await import('../sectionEditorProvider');
    const mockContext = {
      subscriptions: [],
      extensionUri: { fsPath: '/test' },
      extensionPath: '/test',
    } as any;
    const provider = new SectionEditorProvider(mockContext);
    expect(provider.getEditorMode()).toBeUndefined();
  });

  // Regression guard: appendUnitOpToDocument must persist the new unit op to
  // the underlying TextDocument via WorkspaceEdit.replace. Earlier revisions
  // built the WorkspaceEdit but never called `.replace`, so the change relied
  // on the webview's auto-save path and was lost if the editor closed during
  // the 1.5s debounce window.
  it('should persist appended unit op via WorkspaceEdit.replace', async () => {
    const { SectionEditorProvider, buildUnitOperationBlock } = await import('../sectionEditorProvider');
    const mockContext = {
      subscriptions: [],
      extensionUri: { fsPath: '/test' },
      extensionPath: '/test',
    } as any;
    const provider = new SectionEditorProvider(mockContext);

    const initialContent = `---
title: WD010 Test
experimenter: Tester
created_date: 2026-01-01
last_updated_date: 2026-01-01
end_date: ''
---

## [WD010 Test]

> Test workflow

## Related Unit Operations

`;

    const mockDoc = {
      uri: { fsPath: '/test.labnote.md', toString: () => 'file:///test.labnote.md' },
      getText: vi.fn(() => initialContent),
      positionAt: vi.fn((offset: number) => ({ line: 0, character: offset })),
    } as any;

    // Capture WorkspaceEdit instances so we can inspect `.replace` per-instance
    const editInstances: Array<{ replace: ReturnType<typeof vi.fn> }> = [];
    const OriginalWE = mockVscode.WorkspaceEdit;
    mockVscode.WorkspaceEdit = class MockSpyWE extends OriginalWE {
      constructor() {
        super();
        editInstances.push(this as unknown as { replace: ReturnType<typeof vi.fn> });
      }
    } as typeof OriginalWE;

    try {
      const block = buildUnitOperationBlock('HW001', 'Centrifugation', 'Separate by centrifugal force', 'hw', 'Tester');
      await provider.appendUnitOpToDocument(mockDoc, block);
    } finally {
      mockVscode.WorkspaceEdit = OriginalWE;
    }

    expect(editInstances).toHaveLength(1);
    expect(editInstances[0].replace).toHaveBeenCalledTimes(1);
    const replaceArgs = editInstances[0].replace.mock.calls[0];
    // [uri, range, newContent]
    expect(replaceArgs[0]).toBe(mockDoc.uri);
    expect(typeof replaceArgs[2]).toBe('string');
    expect(replaceArgs[2]).toContain('HW001');
    expect(replaceArgs[2]).toContain('Centrifugation');
    expect(mockVscode.workspace.applyEdit).toHaveBeenCalled();
  });
});
