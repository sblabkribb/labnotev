describe('Workflow Structure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isValidReadmePath', () => {
    it('should return true for README.labnote.md in labnote subfolder', async () => {
      const { isValidReadmePath } = await import('../lib/workflowStructure');
      
      expect(isValidReadmePath('C:\\workspace\\labnote\\001_Experiment\\README.labnote.md')).toBe(true);
      expect(isValidReadmePath('/workspace/labnote/001_Experiment/README.labnote.md')).toBe(true);
    });

    it('should return false for README.labnote.md not in labnote folder', async () => {
      const { isValidReadmePath } = await import('../lib/workflowStructure');
      
      expect(isValidReadmePath('C:\\workspace\\docs\\README.labnote.md')).toBe(false);
      expect(isValidReadmePath('/workspace/other/001_Test/README.labnote.md')).toBe(false);
    });

    it('should return false for non-README files', async () => {
      const { isValidReadmePath } = await import('../lib/workflowStructure');
      
      expect(isValidReadmePath('C:\\workspace\\labnote\\001_Test\\notes.labnote.md')).toBe(false);
    });

    it('should return false for folders without 3-digit prefix', async () => {
      const { isValidReadmePath } = await import('../lib/workflowStructure');
      
      expect(isValidReadmePath('C:\\workspace\\labnote\\Test\\README.labnote.md')).toBe(false);
      expect(isValidReadmePath('/workspace/labnote/1_Test/README.labnote.md')).toBe(false);
    });

    it('should return false for old .md extension README', async () => {
      const { isValidReadmePath } = await import('../lib/workflowStructure');
      
      expect(isValidReadmePath('C:\\workspace\\labnote\\001_Test\\README.md')).toBe(false);
    });
  });

  describe('isValidWorkflowPath', () => {
    it('should return true for .labnote.md workflow files in labnote subfolder with 3-digit prefix', async () => {
      const { isValidWorkflowPath } = await import('../lib/workflowStructure');
      
      expect(isValidWorkflowPath('C:\\workspace\\labnote\\001_Test\\001_WD010_Design.labnote.md')).toBe(true);
      expect(isValidWorkflowPath('/workspace/labnote/001_Test/002_WB010_Build.labnote.md')).toBe(true);
    });

    it('should return false for files without 3-digit prefix', async () => {
      const { isValidWorkflowPath } = await import('../lib/workflowStructure');
      
      expect(isValidWorkflowPath('C:\\workspace\\labnote\\001_Test\\notes.labnote.md')).toBe(false);
    });

    it('should return false for README.labnote.md', async () => {
      const { isValidWorkflowPath } = await import('../lib/workflowStructure');
      
      expect(isValidWorkflowPath('C:\\workspace\\labnote\\001_Test\\README.labnote.md')).toBe(false);
    });

    it('should return false for files not in labnote folder', async () => {
      const { isValidWorkflowPath } = await import('../lib/workflowStructure');
      
      expect(isValidWorkflowPath('C:\\workspace\\docs\\001_WD010.labnote.md')).toBe(false);
    });

    it('should return false for old .md extension workflow files', async () => {
      const { isValidWorkflowPath } = await import('../lib/workflowStructure');
      
      expect(isValidWorkflowPath('C:\\workspace\\labnote\\001_Test\\001_WD010_Design.md')).toBe(false);
    });
  });

  describe('getNextWorkflowNumber', () => {
    it('should return 001 when no workflow files exist', async () => {
      const { getNextWorkflowNumber } = await import('../lib/workflowStructure');
      
      const result = getNextWorkflowNumber([]);
      
      expect(result).toBe('001');
    });

    it('should return 002 when 001 exists', async () => {
      const { getNextWorkflowNumber } = await import('../lib/workflowStructure');
      
      const result = getNextWorkflowNumber(['001_WD010_Design.labnote.md']);
      
      expect(result).toBe('002');
    });

    it('should find the next number after max', async () => {
      const { getNextWorkflowNumber } = await import('../lib/workflowStructure');
      
      const result = getNextWorkflowNumber(['001_WD010.labnote.md', '003_WB010.labnote.md']);
      
      expect(result).toBe('004');
    });

    it('should ignore README.labnote.md but count numbered files', async () => {
      const { getNextWorkflowNumber } = await import('../lib/workflowStructure');
      
      const result = getNextWorkflowNumber(['README.labnote.md', '001_WD010.labnote.md', '002_WB010.labnote.md']);
      
      expect(result).toBe('003');
    });
  });

  describe('sanitizeWorkflowName', () => {
    it('should replace spaces with underscores', async () => {
      const { sanitizeWorkflowName } = await import('../lib/workflowStructure');
      
      const result = sanitizeWorkflowName('My Workflow Name');
      
      expect(result).toBe('My_Workflow_Name');
    });

    it('should remove special characters', async () => {
      const { sanitizeWorkflowName } = await import('../lib/workflowStructure');
      
      const result = sanitizeWorkflowName('Test: Workflow #1');
      
      expect(result).toBe('Test_Workflow_1');
    });
  });

  describe('createWorkflowContent', () => {
    it('should include YAML front matter', async () => {
      const { createWorkflowContent } = await import('../lib/workflowStructure');

      const result = createWorkflowContent({
        id: 'WD010',
        name: 'General Design of Experiment',
        description: 'Test description',
      }, 'John Doe');

      expect(result).toContain('---');
      expect(result).toContain('title:');
      expect(result).toContain('experimenter: John Doe');
      expect(result).toContain('created_date:');
      expect(result).toContain('last_updated_date:');
      expect(result).toContain('end_date:');
    });

    it('should include workflow header with ID and name', async () => {
      const { createWorkflowContent } = await import('../lib/workflowStructure');

      const result = createWorkflowContent({
        id: 'WD010',
        name: 'General Design of Experiment',
        description: 'Test description',
      }, '');

      expect(result).toContain('## [WD010 General Design of Experiment]');
    });

    it('should include Related Unit Operations section', async () => {
      const { createWorkflowContent } = await import('../lib/workflowStructure');

      const result = createWorkflowContent({
        id: 'WD010',
        name: 'Test',
        description: 'Desc',
      }, '');

      expect(result).toContain('## Related Unit Operations');
    });
  });

  describe('parseExperimenterFromReadme', () => {
    it('returns the author name when present', async () => {
      const { parseExperimenterFromReadme } = await import('../lib/workflowStructure');

      const readme = `---
title: Test
author: 홍길동
experiment_type: labnote
sample_tracking: yes
---
`;
      expect(parseExperimenterFromReadme(readme)).toBe('홍길동');
    });

    // Issue #36: an empty author line must NOT let the regex spill over the
    // newline and capture the following `experiment_type: labnote` line.
    it('returns empty string when author is blank (does not capture next line)', async () => {
      const { parseExperimenterFromReadme } = await import('../lib/workflowStructure');

      const readme = `---
title: Test
author: 
experiment_type: labnote
sample_tracking: yes
---
`;
      expect(parseExperimenterFromReadme(readme)).toBe('');
    });
  });

  // Issue #36 end-to-end: creating a labnote folder without an author, then a
  // workflow, must still produce a file that detects as 'workflow' (not
  // 'labnote') so the Workflow Section Editor opens and unit-op insertion works.
  describe('empty-author workflow creation (issue #36)', () => {
    it('produces a workflow-detected file when the labnote README has no author', async () => {
      const { generateReadmeContent } = await import('../lib/labnoteStructure');
      const { parseExperimenterFromReadme, createWorkflowContent } = await import('../lib/workflowStructure');
      const { detectMdFileType } = await import('../sectionEditorProvider');

      const readme = generateReadmeContent('My Experiment', '');
      const experimenter = parseExperimenterFromReadme(readme);
      const workflowContent = createWorkflowContent(
        { id: 'WD010', name: 'General Design', description: 'Desc' },
        experimenter,
      );

      expect(detectMdFileType(workflowContent)).toBe('workflow');
    });
  });

  describe('createWorkflowFileName', () => {
    it('should create filename with .labnote.md extension', async () => {
      const { createWorkflowFileName } = await import('../lib/workflowStructure');

      const result = createWorkflowFileName('001', {
        id: 'WD010',
        name: 'General Design of Experiment',
        description: '',
      });

      expect(result).toBe('001_WD010_General_Design_of_Experiment.labnote.md');
    });
  });

  describe('parseWorkflowChecklistFromReadme', () => {
    it('should extract .labnote.md workflow links from README', async () => {
      const { parseWorkflowChecklistFromReadme } = await import('../lib/workflowStructure');
      
      const readmeContent = `# Test
## Related Workflows
> Instructions

[ ] [001 WD010 Design](./001_WD010_Design.labnote.md)
[x] [002 WB010 Build](./002_WB010_Build.labnote.md)

## Other Section
`;
      
      const result = parseWorkflowChecklistFromReadme(readmeContent);
      
      expect(result.length).toBe(2);
      expect(result[0].fileName).toBe('001_WD010_Design.labnote.md');
      expect(result[0].done).toBe(false);
      expect(result[1].fileName).toBe('002_WB010_Build.labnote.md');
      expect(result[1].done).toBe(true);
    });

    it('should return empty array if no workflows section', async () => {
      const { parseWorkflowChecklistFromReadme } = await import('../lib/workflowStructure');
      
      const readmeContent = `# Test
## Other Section
Content here
`;
      
      const result = parseWorkflowChecklistFromReadme(readmeContent);
      
      expect(result.length).toBe(0);
    });

    it('should parse links with non-ASCII file names (align with editor parser)', async () => {
      const { parseWorkflowChecklistFromReadme } = await import('../lib/workflowStructure');

      const readmeContent = `# Test
## Related Workflows

[ ] [001 WD010 Design](./001_WD010_Design.labnote.md)
[ ] [002 설계 노트](./002_WD020_설계.labnote.md)

## Other Section
`;

      const result = parseWorkflowChecklistFromReadme(readmeContent);

      expect(result.length).toBe(2);
      expect(result[1].fileName).toBe('002_WD020_설계.labnote.md');
      expect(result[1].title).toBe('002 설계 노트');
    });

    it('parses standard `- [ ]` task list items (and mixed with legacy)', async () => {
      const { parseWorkflowChecklistFromReadme } = await import('../lib/workflowStructure');

      const readmeContent = `# Test
## Related Workflows

- [ ] [001 WD010 Design](./001_WD010_Design.labnote.md)
- [x] [002 WB010 Build](002_WB010_Build.labnote.md)
[ ] [003 WT010 Test](./003_WT010_Test.labnote.md)

## Other Section
`;

      const result = parseWorkflowChecklistFromReadme(readmeContent);

      expect(result.length).toBe(3);
      expect(result[0].fileName).toBe('001_WD010_Design.labnote.md');
      expect(result[0].done).toBe(false);
      expect(result[1].fileName).toBe('002_WB010_Build.labnote.md');
      expect(result[1].done).toBe(true);
      expect(result[2].fileName).toBe('003_WT010_Test.labnote.md');
    });
  });

  describe('generateWorkflowChecklist', () => {
    it('should generate checklist markdown with .labnote.md links', async () => {
      const { generateWorkflowChecklist } = await import('../lib/workflowStructure');
      
      const items = [
        { fileName: '001_WD010_Design.labnote.md', title: '001 WD010 General Design', done: false },
        { fileName: '002_WB010_Build.labnote.md', title: '002 WB010 DNA Assembly', done: true },
      ];
      
      const result = generateWorkflowChecklist(items);
      
      expect(result).toContain('- [ ] [001 WD010 General Design](./001_WD010_Design.labnote.md)');
      expect(result).toContain('- [x] [002 WB010 DNA Assembly](./002_WB010_Build.labnote.md)');
      // Every emitted line must be a standard task-list item.
      for (const line of result.split('\n')) {
        expect(line).toMatch(/^- \[[ x]\] /);
      }
    });

    it('should return empty string for empty array', async () => {
      const { generateWorkflowChecklist } = await import('../lib/workflowStructure');
      
      const result = generateWorkflowChecklist([]);
      
      expect(result).toBe('');
    });
  });

  describe('updateReadmeWorkflowSection', () => {
    it('should insert workflow checklist below the description blockquote', async () => {
      const { updateReadmeWorkflowSection } = await import('../lib/workflowStructure');

      const readmeContent = `# Test
## Related Workflows

> Enter the list of related workflow files between the markers below.
> When you run the \`F1\`, \`New workflow\` command, the list will be automatically added between the markers.

## Other Section
`;
      const newChecklist = '[ ] [001 WD010 Design](./001_WD010_Design.labnote.md)';

      const result = updateReadmeWorkflowSection(readmeContent, newChecklist);

      const relatedSection = result.split('## Other Section')[0];
      expect(relatedSection).toContain('## Related Workflows');
      expect(relatedSection).toContain('> Enter the list of related workflow files');
      expect(relatedSection).toContain(newChecklist);
      // Checklist must appear after the blockquote (index of checklist > index of last blockquote line)
      const lastBlockquoteInSection = relatedSection.lastIndexOf('> ');
      const checklistIndex = relatedSection.indexOf(newChecklist);
      expect(checklistIndex).toBeGreaterThan(lastBlockquoteInSection);
    });

    it('replaces an existing `- [ ]` checklist block without duplicating items', async () => {
      const { updateReadmeWorkflowSection } = await import('../lib/workflowStructure');

      const readmeContent = `# Test
## 🗂️ Related Workflows

> Instructions

- [ ] [001 WD010 Design](./001_WD010_Design.labnote.md)
- [x] [002 WB010 Build](./002_WB010_Build.labnote.md)

## Other Section
`;
      const newChecklist =
        '- [ ] [001 WD010 Design](./001_WD010_Design.labnote.md)\n' +
        '- [x] [002 WB010 Build](./002_WB010_Build.labnote.md)\n' +
        '- [ ] [003 WT010 Test](./003_WT010_Test.labnote.md)';

      const result = updateReadmeWorkflowSection(readmeContent, newChecklist);

      // The old block must be replaced, not left above the new one.
      const related = result.split('## Other Section')[0];
      expect((related.match(/\[001 WD010 Design\]/g) || []).length).toBe(1);
      expect(related).toContain('003 WT010 Test');
    });

    it('replaces a legacy `[ ]` checklist block (migration path)', async () => {
      const { updateReadmeWorkflowSection } = await import('../lib/workflowStructure');

      const readmeContent = `# Test
## 🗂️ Related Workflows

> Instructions

[ ] [001 WD010 Design](./001_WD010_Design.labnote.md)

## Other Section
`;
      const newChecklist =
        '- [ ] [001 WD010 Design](./001_WD010_Design.labnote.md)\n' +
        '- [ ] [002 WB010 Build](./002_WB010_Build.labnote.md)';

      const result = updateReadmeWorkflowSection(readmeContent, newChecklist);

      const related = result.split('## Other Section')[0];
      // The legacy marker-less line must not survive alongside the new block.
      expect(related).not.toMatch(/^\[ \] \[001 WD010 Design\]/m);
      expect((related.match(/\[001 WD010 Design\]/g) || []).length).toBe(1);
    });
  });

  describe('parseWorkflowFileName', () => {
    it('parses a standard workflow filename into sequence/id/safeName', async () => {
      const { parseWorkflowFileName } = await import('../lib/workflowStructure');

      expect(parseWorkflowFileName('001_WD010_Design.labnote.md')).toEqual({
        sequence: '001',
        id: 'WD010',
        safeName: 'Design',
      });
    });

    it('returns null for a filename without the workflow prefix pattern', async () => {
      const { parseWorkflowFileName } = await import('../lib/workflowStructure');

      expect(parseWorkflowFileName('001_design.labnote.md')).toBeNull();
      expect(parseWorkflowFileName('README.labnote.md')).toBeNull();
      expect(parseWorkflowFileName('001_WD010_Design.md')).toBeNull();
    });

    it('preserves multi-underscore safeName segments', async () => {
      const { parseWorkflowFileName } = await import('../lib/workflowStructure');

      expect(parseWorkflowFileName('012_WS180_A_B_C.labnote.md')).toEqual({
        sequence: '012',
        id: 'WS180',
        safeName: 'A_B_C',
      });
    });

    it('accepts the uncategorised WX prefix', async () => {
      const { parseWorkflowFileName } = await import('../lib/workflowStructure');

      expect(parseWorkflowFileName('003_WX030_Foo.labnote.md')).toEqual({
        sequence: '003',
        id: 'WX030',
        safeName: 'Foo',
      });
    });
  });

  describe('extractWorkflowName', () => {
    it('returns the display name from the front matter title', async () => {
      const { extractWorkflowName } = await import('../lib/workflowStructure');

      const content = `---
title: WD010 General Design of Experiment
experimenter: alice
---

## [WD010 General Design of Experiment]
`;
      expect(extractWorkflowName(content, 'WD010')).toBe('General Design of Experiment');
    });

    it('falls back to the H2 heading when front matter title is missing', async () => {
      const { extractWorkflowName } = await import('../lib/workflowStructure');

      const content = `---
experimenter: bob
---

## [WD010 Heading Only Name]
`;
      expect(extractWorkflowName(content, 'WD010')).toBe('Heading Only Name');
    });

    it('returns null when neither front matter title nor H2 heading is present', async () => {
      const { extractWorkflowName } = await import('../lib/workflowStructure');

      expect(extractWorkflowName('# Just a body\n\nNo metadata.', 'WD010')).toBeNull();
    });

    it("returns null when the front matter title's id does not match the requested id", async () => {
      const { extractWorkflowName } = await import('../lib/workflowStructure');

      const content = `---
title: WS180 Some Other Name
---
`;
      expect(extractWorkflowName(content, 'WD010')).toBeNull();
    });
  });

  describe('Workflow interface', () => {
    it('should export WorkflowInfo interface', async () => {
      type WorkflowInfo = import('../lib/workflowStructure').WorkflowInfo;

      // Type check - this will fail at compile time if interface is wrong
      const workflow: WorkflowInfo = {
        id: 'WD010',
        name: 'Test',
        description: 'Desc',
      };

      expect(workflow).toBeDefined();
    });
  });
});
