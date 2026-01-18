import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockVscode } from './setup';

describe('Workflow Structure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isValidReadmePath', () => {
    it('should return true for README.md in labnote subfolder', async () => {
      const { isValidReadmePath } = await import('../lib/workflowStructure');
      
      // Windows path
      expect(isValidReadmePath('C:\\workspace\\labnote\\001_Experiment\\README.md')).toBe(true);
      // Unix path
      expect(isValidReadmePath('/workspace/labnote/001_Experiment/README.md')).toBe(true);
    });

    it('should return false for README.md not in labnote folder', async () => {
      const { isValidReadmePath } = await import('../lib/workflowStructure');
      
      expect(isValidReadmePath('C:\\workspace\\docs\\README.md')).toBe(false);
      expect(isValidReadmePath('/workspace/other/001_Test/README.md')).toBe(false);
    });

    it('should return false for non-README files', async () => {
      const { isValidReadmePath } = await import('../lib/workflowStructure');
      
      expect(isValidReadmePath('C:\\workspace\\labnote\\001_Test\\notes.md')).toBe(false);
    });

    it('should return false for folders without 3-digit prefix', async () => {
      const { isValidReadmePath } = await import('../lib/workflowStructure');
      
      expect(isValidReadmePath('C:\\workspace\\labnote\\Test\\README.md')).toBe(false);
      expect(isValidReadmePath('/workspace/labnote/1_Test/README.md')).toBe(false);
    });
  });

  describe('isValidWorkflowPath', () => {
    it('should return true for .labnote.md workflow files in labnote subfolder', async () => {
      const { isValidWorkflowPath } = await import('../lib/workflowStructure');
      
      expect(isValidWorkflowPath('C:\\workspace\\labnote\\001_Test\\001_WD010_Design.labnote.md')).toBe(true);
      expect(isValidWorkflowPath('/workspace/labnote/001_Test/002_WB010_Build.labnote.md')).toBe(true);
    });

    it('should return false for regular .md files', async () => {
      const { isValidWorkflowPath } = await import('../lib/workflowStructure');
      
      expect(isValidWorkflowPath('C:\\workspace\\labnote\\001_Test\\001_WD010_Design.md')).toBe(false);
    });

    it('should return false for README.md', async () => {
      const { isValidWorkflowPath } = await import('../lib/workflowStructure');
      
      expect(isValidWorkflowPath('C:\\workspace\\labnote\\001_Test\\README.md')).toBe(false);
    });

    it('should return false for files not in labnote folder', async () => {
      const { isValidWorkflowPath } = await import('../lib/workflowStructure');
      
      expect(isValidWorkflowPath('C:\\workspace\\docs\\001_WD010.labnote.md')).toBe(false);
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

    it('should ignore non-workflow files like README.md and regular .md', async () => {
      const { getNextWorkflowNumber } = await import('../lib/workflowStructure');
      
      const result = getNextWorkflowNumber(['README.md', '001_WD010.labnote.md', '002_notes.md']);
      
      expect(result).toBe('002');
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
      }, '', 'John Doe');
      
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
      }, '', '');
      
      expect(result).toContain('## [WD010 General Design of Experiment]');
    });

    it('should include user description if provided', async () => {
      const { createWorkflowContent } = await import('../lib/workflowStructure');
      
      const result = createWorkflowContent({
        id: 'WD010',
        name: 'General Design of Experiment',
        description: 'Test description',
      }, 'Day 1 prep', '');
      
      expect(result).toContain('Day 1 prep');
    });

    it('should include Related Unit Operations section', async () => {
      const { createWorkflowContent } = await import('../lib/workflowStructure');
      
      const result = createWorkflowContent({
        id: 'WD010',
        name: 'Test',
        description: 'Desc',
      }, '', '');
      
      expect(result).toContain('## Related Unit Operations');
    });
  });

  describe('createWorkflowFileName', () => {
    it('should create filename with .labnote.md extension', async () => {
      const { createWorkflowFileName } = await import('../lib/workflowStructure');
      
      const result = createWorkflowFileName('001', {
        id: 'WD010',
        name: 'General Design of Experiment',
        description: '',
      }, '');
      
      expect(result).toBe('001_WD010_General_Design_of_Experiment.labnote.md');
    });

    it('should include description if provided', async () => {
      const { createWorkflowFileName } = await import('../lib/workflowStructure');
      
      const result = createWorkflowFileName('002', {
        id: 'WB010',
        name: 'DNA Assembly',
        description: '',
      }, 'Day 1');
      
      expect(result).toBe('002_WB010_DNA_Assembly_Day_1.labnote.md');
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
  });

  describe('generateWorkflowChecklist', () => {
    it('should generate checklist markdown with .labnote.md links', async () => {
      const { generateWorkflowChecklist } = await import('../lib/workflowStructure');
      
      const items = [
        { fileName: '001_WD010_Design.labnote.md', title: '001 WD010 General Design', done: false },
        { fileName: '002_WB010_Build.labnote.md', title: '002 WB010 DNA Assembly', done: true },
      ];
      
      const result = generateWorkflowChecklist(items);
      
      expect(result).toContain('[ ] [001 WD010 General Design](./001_WD010_Design.labnote.md)');
      expect(result).toContain('[x] [002 WB010 DNA Assembly](./002_WB010_Build.labnote.md)');
    });

    it('should return empty string for empty array', async () => {
      const { generateWorkflowChecklist } = await import('../lib/workflowStructure');
      
      const result = generateWorkflowChecklist([]);
      
      expect(result).toBe('');
    });
  });

  describe('Workflow interface', () => {
    it('should export WorkflowInfo interface', async () => {
      const module = await import('../lib/workflowStructure');
      
      // Type check - this will fail at compile time if interface is wrong
      const workflow: typeof module.WorkflowInfo = {
        id: 'WD010',
        name: 'Test',
        description: 'Desc',
      };
      
      expect(workflow).toBeDefined();
    });
  });
});
