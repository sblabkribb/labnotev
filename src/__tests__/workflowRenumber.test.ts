import type { WorkflowChecklistItem } from '../lib/workflowStructure';

function item(fileName: string, title: string, done = false): WorkflowChecklistItem {
  return { fileName, title, done };
}

const DESIGN = '001_WD010_Design.labnote.md';
const TEST = '002_WT010_Test.labnote.md';
const EXTRA = '003_WX010_Extra.labnote.md';

describe('planRenumberWorkflows', () => {
  it('computes renames and renumbered items when the README order changed', async () => {
    const { planRenumberWorkflows } = await import('../lib/workflowRenumber');

    // README order: Test first, Design second (user reordered)
    const result = planRenumberWorkflows({
      items: [item(TEST, '002 WT010 Test', true), item(DESIGN, '001 WD010 Design')],
      diskWorkflowFiles: [DESIGN, TEST],
    });

    if ('error' in result) throw new Error(`unexpected error: ${result.error.code}`);
    expect(result.changed).toBe(true);
    expect(result.renames).toEqual([
      { oldFileName: TEST, newFileName: '001_WT010_Test.labnote.md' },
      { oldFileName: DESIGN, newFileName: '002_WD010_Design.labnote.md' },
    ]);
    expect(result.newItems).toEqual([
      { fileName: '001_WT010_Test.labnote.md', title: '001 WT010 Test', done: true },
      { fileName: '002_WD010_Design.labnote.md', title: '002 WD010 Design', done: false },
    ]);
  });

  it('returns changed=false with no renames when order already matches numbering', async () => {
    const { planRenumberWorkflows } = await import('../lib/workflowRenumber');

    const result = planRenumberWorkflows({
      items: [item(DESIGN, '001 WD010 Design'), item(TEST, '002 WT010 Test')],
      diskWorkflowFiles: [DESIGN, TEST],
    });

    if ('error' in result) throw new Error(`unexpected error: ${result.error.code}`);
    expect(result.changed).toBe(false);
    expect(result.renames).toEqual([]);
    expect(result.newItems.map(i => i.fileName)).toEqual([DESIGN, TEST]);
  });

  it('errors with no_items on an empty checklist', async () => {
    const { planRenumberWorkflows } = await import('../lib/workflowRenumber');
    const result = planRenumberWorkflows({ items: [], diskWorkflowFiles: [] });
    expect('error' in result && result.error.code).toBe('no_items');
  });

  it('errors with invalid_filename when a checklist entry is not a workflow file name', async () => {
    const { planRenumberWorkflows } = await import('../lib/workflowRenumber');
    const result = planRenumberWorkflows({
      items: [item(DESIGN, '001 WD010 Design'), item('notes.labnote.md', 'Notes')],
      diskWorkflowFiles: [DESIGN, 'notes.labnote.md'],
    });
    if (!('error' in result)) throw new Error('expected error');
    expect(result.error.code).toBe('invalid_filename');
    expect(result.error.details).toContain('notes.labnote.md');
  });

  it('errors with missing_files when a listed file is absent on disk', async () => {
    const { planRenumberWorkflows } = await import('../lib/workflowRenumber');
    const result = planRenumberWorkflows({
      items: [item(DESIGN, '001 WD010 Design'), item(TEST, '002 WT010 Test')],
      diskWorkflowFiles: [DESIGN],
    });
    if (!('error' in result)) throw new Error('expected error');
    expect(result.error.code).toBe('missing_files');
    expect(result.error.details).toContain(TEST);
  });

  it('aborts with orphan_files when a disk workflow file is not in the checklist', async () => {
    const { planRenumberWorkflows } = await import('../lib/workflowRenumber');
    const result = planRenumberWorkflows({
      items: [item(DESIGN, '001 WD010 Design')],
      diskWorkflowFiles: [DESIGN, EXTRA],
    });
    if (!('error' in result)) throw new Error('expected error');
    expect(result.error.code).toBe('orphan_files');
    expect(result.error.details).toContain(EXTRA);
  });

  it('replaces only the leading 3-digit number in the title', async () => {
    const { planRenumberWorkflows } = await import('../lib/workflowRenumber');
    const result = planRenumberWorkflows({
      items: [item(TEST, '002 WT010 Test'), item(DESIGN, '001 WD010 Design')],
      diskWorkflowFiles: [DESIGN, TEST],
    });
    if ('error' in result) throw new Error(`unexpected error: ${result.error.code}`);
    expect(result.newItems[0].title).toBe('001 WT010 Test');
    expect(result.newItems[1].title).toBe('002 WD010 Design');
  });

  it('prefixes a number when the title has no leading sequence', async () => {
    const { planRenumberWorkflows } = await import('../lib/workflowRenumber');
    const result = planRenumberWorkflows({
      items: [item(DESIGN, 'WD010 Design')],
      diskWorkflowFiles: [DESIGN],
    });
    if ('error' in result) throw new Error(`unexpected error: ${result.error.code}`);
    // DESIGN keeps position 0 -> 001; title had no leading number -> prefixed
    expect(result.newItems[0].title).toBe('001 WD010 Design');
  });

  it('does not mutate the input items array', async () => {
    const { planRenumberWorkflows } = await import('../lib/workflowRenumber');
    const items = [item(TEST, '002 WT010 Test'), item(DESIGN, '001 WD010 Design')];
    const copy = items.map(i => ({ ...i }));
    planRenumberWorkflows({ items, diskWorkflowFiles: [DESIGN, TEST] });
    expect(items).toEqual(copy);
  });
});
