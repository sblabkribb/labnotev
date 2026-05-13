import './setup';

const WORKFLOW_FILE = '/ws/labnote/001_Exp/001_WD010_Design.labnote.md';
const README_FILE = '/ws/labnote/001_Exp/README.labnote.md';

const ORIGINAL_BODY = `---
title: WD010 Design
experimenter: alice
created_date: 2026-01-01
last_updated_date: 2026-01-01
end_date: ''
---

## [WD010 Design]

> Original description

## Related Unit Operations

- UHW010
`;

const ORIGINAL_README = `# 001_Exp

## Related Workflows

> Enter the list of related workflow files between the markers below.

[ ] [001 WD010 Design](./001_WD010_Design.labnote.md)
[x] [002 WS180 Other](./002_WS180_Other.labnote.md)

## Other Section
`;

describe('planRenameWorkflow', () => {
  it('rewrites front matter title, H2 header, README checklist item, and computes new filename', async () => {
    const { planRenameWorkflow } = await import('../lib/workflowRename');

    const result = planRenameWorkflow({
      workflowFilePath: WORKFLOW_FILE,
      oldWorkflowContent: ORIGINAL_BODY,
      readmePath: README_FILE,
      oldReadmeContent: ORIGINAL_README,
      newName: 'Design v2',
    });

    if ('error' in result) throw new Error(`unexpected error: ${result.error.code}`);

    expect(result.newFilePath.endsWith('001_WD010_Design_v2.labnote.md')).toBe(true);
    expect(result.newFileContent).toContain('title: WD010 Design v2');
    expect(result.newFileContent).toContain('## [WD010 Design v2]');
    // sanity: old strings must be gone
    expect(result.newFileContent).not.toMatch(/^title: WD010 Design$/m);
    expect(result.newFileContent).not.toContain('## [WD010 Design]\n');

    expect(result.newReadmeContent).not.toBeNull();
    expect(result.newReadmeContent!).toContain('[001 WD010 Design v2](./001_WD010_Design_v2.labnote.md)');
    // the other workflow item is preserved verbatim
    expect(result.newReadmeContent!).toContain('[x] [002 WS180 Other](./002_WS180_Other.labnote.md)');
  });

  it('rejects when the new name is identical to the old name', async () => {
    const { planRenameWorkflow } = await import('../lib/workflowRename');
    const result = planRenameWorkflow({
      workflowFilePath: WORKFLOW_FILE,
      oldWorkflowContent: ORIGINAL_BODY,
      readmePath: README_FILE,
      oldReadmeContent: ORIGINAL_README,
      newName: 'Design',
    });
    expect(result).toEqual({ error: { code: 'no_change' } });
  });

  it('rejects an empty name', async () => {
    const { planRenameWorkflow } = await import('../lib/workflowRename');
    const result = planRenameWorkflow({
      workflowFilePath: WORKFLOW_FILE,
      oldWorkflowContent: ORIGINAL_BODY,
      readmePath: README_FILE,
      oldReadmeContent: ORIGINAL_README,
      newName: '   ',
    });
    expect(result).toEqual({ error: { code: 'empty_name' } });
  });

  it('rejects a name that sanitises to an empty string', async () => {
    const { planRenameWorkflow } = await import('../lib/workflowRename');
    const result = planRenameWorkflow({
      workflowFilePath: WORKFLOW_FILE,
      oldWorkflowContent: ORIGINAL_BODY,
      readmePath: README_FILE,
      oldReadmeContent: ORIGINAL_README,
      newName: '???',
    });
    expect(result).toEqual({ error: { code: 'sanitized_empty' } });
  });

  it('does not touch other workflow checklist items in the README', async () => {
    const { planRenameWorkflow } = await import('../lib/workflowRename');
    const result = planRenameWorkflow({
      workflowFilePath: WORKFLOW_FILE,
      oldWorkflowContent: ORIGINAL_BODY,
      readmePath: README_FILE,
      oldReadmeContent: ORIGINAL_README,
      newName: 'Brand New',
    });
    if ('error' in result) throw new Error('unexpected error');
    expect(result.newReadmeContent!).toContain('[x] [002 WS180 Other](./002_WS180_Other.labnote.md)');
  });

  it('returns null newReadmeContent when README has no matching checklist item', async () => {
    const { planRenameWorkflow } = await import('../lib/workflowRename');
    const readmeWithoutItem = ORIGINAL_README.replace(
      '[ ] [001 WD010 Design](./001_WD010_Design.labnote.md)\n',
      ''
    );
    const result = planRenameWorkflow({
      workflowFilePath: WORKFLOW_FILE,
      oldWorkflowContent: ORIGINAL_BODY,
      readmePath: README_FILE,
      oldReadmeContent: readmeWithoutItem,
      newName: 'Standalone',
    });
    if ('error' in result) throw new Error('unexpected error');
    expect(result.newReadmeContent).toBeNull();
    expect(result.newFileContent).toContain('title: WD010 Standalone');
  });

  it('rejects a malformed filename that does not match the workflow pattern', async () => {
    const { planRenameWorkflow } = await import('../lib/workflowRename');
    const result = planRenameWorkflow({
      workflowFilePath: '/ws/labnote/001_Exp/not_a_workflow.md',
      oldWorkflowContent: ORIGINAL_BODY,
      readmePath: null,
      oldReadmeContent: null,
      newName: 'Foo',
    });
    expect(result).toEqual({ error: { code: 'invalid_filename' } });
  });

  it('rejects when the README has multiple checklist items pointing to the same workflow file', async () => {
    const { planRenameWorkflow } = await import('../lib/workflowRename');
    const dupReadme = ORIGINAL_README.replace(
      '[x] [002 WS180 Other](./002_WS180_Other.labnote.md)',
      '[ ] [001 WD010 Design Duplicate](./001_WD010_Design.labnote.md)'
    );
    const result = planRenameWorkflow({
      workflowFilePath: WORKFLOW_FILE,
      oldWorkflowContent: ORIGINAL_BODY,
      readmePath: README_FILE,
      oldReadmeContent: dupReadme,
      newName: 'NewLabel',
    });
    expect(result).toEqual({ error: { code: 'ambiguous_readme' } });
  });

  it('only touches the front matter title, not a stray `title:` line inside the body', async () => {
    const { planRenameWorkflow } = await import('../lib/workflowRename');
    const bodyWithStrayTitle = ORIGINAL_BODY.replace(
      '## Related Unit Operations',
      '```\ntitle: ignore me\n```\n\n## Related Unit Operations'
    );
    const result = planRenameWorkflow({
      workflowFilePath: WORKFLOW_FILE,
      oldWorkflowContent: bodyWithStrayTitle,
      readmePath: null,
      oldReadmeContent: null,
      newName: 'Updated',
    });
    if ('error' in result) throw new Error(`unexpected error: ${result.error.code}`);
    expect(result.newFileContent).toContain('title: WD010 Updated');
    expect(result.newFileContent).toContain('title: ignore me'); // preserved verbatim
  });

  it('only rewrites the H2 heading whose id matches the workflow id', async () => {
    const { planRenameWorkflow } = await import('../lib/workflowRename');
    const bodyWithOtherH2 = ORIGINAL_BODY.replace(
      '## Related Unit Operations',
      '## [WS180 Unrelated]\n\nstuff\n\n## Related Unit Operations'
    );
    const result = planRenameWorkflow({
      workflowFilePath: WORKFLOW_FILE,
      oldWorkflowContent: bodyWithOtherH2,
      readmePath: null,
      oldReadmeContent: null,
      newName: 'Updated',
    });
    if ('error' in result) throw new Error(`unexpected error: ${result.error.code}`);
    expect(result.newFileContent).toContain('## [WD010 Updated]');
    expect(result.newFileContent).toContain('## [WS180 Unrelated]'); // untouched
  });
});
