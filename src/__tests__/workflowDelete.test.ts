const README = `# 001_Exp

## Related Workflows

> Enter the list of related workflow files between the markers below.

[ ] [001 WD010 Design](./001_WD010_Design.labnote.md)
[x] [002 WT010 Test](./002_WT010_Test.labnote.md)
[ ] [003 WX010 Extra](./003_WX010_Extra.labnote.md)

## Other Section
`;

describe('removeWorkflowFromReadme', () => {
  it('removes the matching checklist entry and keeps the others in order', async () => {
    const { removeWorkflowFromReadme } = await import('../lib/workflowDelete');

    const result = removeWorkflowFromReadme(README, '002_WT010_Test.labnote.md');

    expect(result.changed).toBe(true);
    expect(result.content).toContain('[001 WD010 Design](./001_WD010_Design.labnote.md)');
    expect(result.content).toContain('[003 WX010 Extra](./003_WX010_Extra.labnote.md)');
    expect(result.content).not.toContain('002_WT010_Test.labnote.md');
    // Other sections and instructions preserved
    expect(result.content).toContain('## Other Section');
    expect(result.content).toContain('> Enter the list of related workflow files between the markers below.');
  });

  it('returns changed=false and the original content when the file is not listed', async () => {
    const { removeWorkflowFromReadme } = await import('../lib/workflowDelete');

    const result = removeWorkflowFromReadme(README, '099_WZ999_Missing.labnote.md');

    expect(result.changed).toBe(false);
    expect(result.content).toBe(README);
  });

  it('removes the last remaining entry, leaving an empty checklist', async () => {
    const { removeWorkflowFromReadme } = await import('../lib/workflowDelete');

    const single = `# 001_Exp

## Related Workflows

> Enter the list of related workflow files between the markers below.

[ ] [001 WD010 Design](./001_WD010_Design.labnote.md)

## Other Section
`;

    const result = removeWorkflowFromReadme(single, '001_WD010_Design.labnote.md');

    expect(result.changed).toBe(true);
    expect(result.content).not.toContain('001_WD010_Design.labnote.md');
    expect(result.content).toContain('## Related Workflows');
    expect(result.content).toContain('## Other Section');
  });

  it('does not mutate the input string', async () => {
    const { removeWorkflowFromReadme } = await import('../lib/workflowDelete');

    const copy = String(README);
    removeWorkflowFromReadme(README, '002_WT010_Test.labnote.md');
    expect(README).toBe(copy);
  });

  it('preserves checklist entries the strict parser cannot recognise (e.g. non-ASCII file names)', async () => {
    const { removeWorkflowFromReadme } = await import('../lib/workflowDelete');

    // The middle entry has a Korean file name that the strict checklist regex
    // ([\w\-_.]+) cannot match. A parse-and-regenerate approach would silently
    // drop it; line-based removal must keep it verbatim.
    const withKorean = `# 001_Exp

## Related Workflows

> Enter the list of related workflow files between the markers below.

[ ] [001 WD010 Design](./001_WD010_Design.labnote.md)
[ ] [002 설계 노트](./002_WD020_설계.labnote.md)
[ ] [003 WX010 Extra](./003_WX010_Extra.labnote.md)

## Other Section
`;

    const result = removeWorkflowFromReadme(withKorean, '001_WD010_Design.labnote.md');

    expect(result.changed).toBe(true);
    expect(result.content).not.toContain('001_WD010_Design.labnote.md');
    // Both the Korean entry and the trailing standard entry survive.
    expect(result.content).toContain('[002 설계 노트](./002_WD020_설계.labnote.md)');
    expect(result.content).toContain('[003 WX010 Extra](./003_WX010_Extra.labnote.md)');
  });

  it('removes a checklist entry that has a non-ASCII file name', async () => {
    const { removeWorkflowFromReadme } = await import('../lib/workflowDelete');

    const withKorean = `# 001_Exp

## Related Workflows

[ ] [001 WD010 Design](./001_WD010_Design.labnote.md)
[ ] [002 설계 노트](./002_WD020_설계.labnote.md)

## Other Section
`;

    const result = removeWorkflowFromReadme(withKorean, '002_WD020_설계.labnote.md');

    expect(result.changed).toBe(true);
    expect(result.content).not.toContain('002_WD020_설계.labnote.md');
    expect(result.content).toContain('[001 WD010 Design](./001_WD010_Design.labnote.md)');
  });

  it('removes a standard `- [ ]` task-list checklist entry', async () => {
    const { removeWorkflowFromReadme } = await import('../lib/workflowDelete');

    const standard = `# 001_Exp

## Related Workflows

- [ ] [001 WD010 Design](./001_WD010_Design.labnote.md)
- [x] [002 WT010 Test](./002_WT010_Test.labnote.md)

## Other Section
`;

    const result = removeWorkflowFromReadme(standard, '002_WT010_Test.labnote.md');

    expect(result.changed).toBe(true);
    expect(result.content).not.toContain('002_WT010_Test.labnote.md');
    expect(result.content).toContain('- [ ] [001 WD010 Design](./001_WD010_Design.labnote.md)');
  });
});
