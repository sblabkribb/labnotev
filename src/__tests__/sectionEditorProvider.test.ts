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
});
