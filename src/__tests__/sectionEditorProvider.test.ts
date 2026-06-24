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

  // Issue #36: a workflow whose experimenter value got polluted with the
  // literal text "experiment_type: labnote" must still detect as 'workflow'.
  // The detector must match keys line-anchored, not as a loose substring.
  it('should detect workflow even when experimenter value contains experiment_type text', async () => {
    const { detectMdFileType } = await import('../sectionEditorProvider');
    const md = `---
title: WD010 Test
experimenter: experiment_type: labnote
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

  // Issue #37: the tree-view "insert unit operation" command must resolve the
  // target workflow document even when the single-slot tracking
  // (activeEditor / _lastActiveEditor) is empty — e.g. focus moved to the
  // sidebar and a previously-closed editor cleared `_lastActiveEditor`. The
  // authoritative live set `_allEditors` still holds the open workflow editor
  // (with its resolve-time mode='workflow'), so picking must scan it.
  describe('pickWorkflowDocument', () => {
    const wfContent = `---
title: WD010 Test
experimenter: Tester
---
`;
    const readmeContent = `---
title: Test
experiment_type: labnote
---
`;
    const makeEditor = (mode: 'labnote' | 'workflow' | 'unknown', content: string, fsPath: string) => ({
      document: {
        getText: () => content,
        uri: { fsPath, toString: () => `file://${fsPath}` },
      },
      mode,
    }) as any;

    it('returns the tracked document when its cached mode is workflow (fast path)', async () => {
      const { pickWorkflowDocument, detectMdFileType } = await import('../sectionEditorProvider');
      const wf = makeEditor('workflow', wfContent, '/ws/labnote/001_X/001_WD010.labnote.md');
      expect(pickWorkflowDocument(wf, [wf], detectMdFileType)).toBe(wf.document);
    });

    it('returns an open workflow editor from _allEditors when no slot is tracked', async () => {
      const { pickWorkflowDocument, detectMdFileType } = await import('../sectionEditorProvider');
      const wf = makeEditor('workflow', wfContent, '/ws/labnote/001_X/001_WD010.labnote.md');
      // tracked undefined (slots cleared) but the live editor survives.
      expect(pickWorkflowDocument(undefined, [wf], detectMdFileType)).toBe(wf.document);
    });

    it('returns the tracked document when mode is stale labnote but content detects workflow', async () => {
      const { pickWorkflowDocument, detectMdFileType } = await import('../sectionEditorProvider');
      const stale = makeEditor('labnote', wfContent, '/somewhere/odd/001_WD010.labnote.md');
      expect(pickWorkflowDocument(stale, [stale], detectMdFileType)).toBe(stale.document);
    });

    it('returns undefined when only a labnote README is open', async () => {
      const { pickWorkflowDocument, detectMdFileType } = await import('../sectionEditorProvider');
      const readme = makeEditor('labnote', readmeContent, '/ws/labnote/001_X/README.labnote.md');
      expect(pickWorkflowDocument(readme, [readme], detectMdFileType)).toBeUndefined();
    });

    it('returns undefined when there are no editors at all', async () => {
      const { pickWorkflowDocument, detectMdFileType } = await import('../sectionEditorProvider');
      expect(pickWorkflowDocument(undefined, [], detectMdFileType)).toBeUndefined();
    });
  });

  it('should expose getActiveWorkflowDocument returning undefined when no document is active', async () => {
    const { SectionEditorProvider } = await import('../sectionEditorProvider');
    const mockContext = {
      subscriptions: [],
      extensionUri: { fsPath: '/test' },
      extensionPath: '/test',
    } as any;
    const provider = new SectionEditorProvider(mockContext);
    expect(provider.getActiveWorkflowDocument()).toBeUndefined();
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

  // Issue #37: after a tree-view insert, the webview must refresh even when the
  // target editor is not the active slot (focus on sidebar / slots cleared).
  // appendUnitOpToDocument must post `unitOpAdded` to the panel owning the
  // document, resolved via _allEditors — not only when it is `activeEditor`.
  it('posts unitOpAdded to the owning panel even when no slot is active', async () => {
    const { SectionEditorProvider, buildUnitOperationBlock } = await import('../sectionEditorProvider');
    const mockContext = {
      subscriptions: [],
      extensionUri: { fsPath: '/test' },
      extensionPath: '/test',
    } as any;
    const provider = new SectionEditorProvider(mockContext);

    const content = `---
title: WD010 Test
experimenter: Tester
---

## [WD010 Test]

## Related Unit Operations

`;
    const mockDoc = {
      uri: { fsPath: '/test.labnote.md', toString: () => 'file:///test.labnote.md' },
      getText: vi.fn(() => content),
      positionAt: vi.fn((offset: number) => ({ line: 0, character: offset })),
    } as any;

    const postMessage = vi.fn();
    const editor = {
      document: mockDoc,
      webviewPanel: { webview: { postMessage } },
      mode: 'workflow',
    };
    // Simulate slots cleared (focus on sidebar) while the editor stays live.
    (provider as any).activeEditor = undefined;
    (provider as any)._lastActiveEditor = undefined;
    (provider as any)._allEditors = new Set([editor]);

    const block = buildUnitOperationBlock('HW001', 'Centrifugation', 'desc', 'hw', 'Tester');
    await provider.appendUnitOpToDocument(mockDoc, block);

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'unitOpAdded' })
    );
  });
});
