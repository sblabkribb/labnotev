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
});
