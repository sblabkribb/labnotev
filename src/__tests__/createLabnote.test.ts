import { mockVscode } from './setup';

describe('Create Labnote Command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getNextLabnoteNumber', () => {
    it('should return 001 when no labnote folders exist', async () => {
      const { getNextLabnoteNumber } = await import('../lib/labnoteStructure');
      
      const result = getNextLabnoteNumber([]);
      
      expect(result).toBe('001');
    });

    it('should return 002 when 001 exists', async () => {
      const { getNextLabnoteNumber } = await import('../lib/labnoteStructure');
      
      const result = getNextLabnoteNumber(['001_First_Experiment']);
      
      expect(result).toBe('002');
    });

    it('should find the next number in a gap', async () => {
      const { getNextLabnoteNumber } = await import('../lib/labnoteStructure');
      
      const result = getNextLabnoteNumber(['001_First', '003_Third']);
      
      expect(result).toBe('004');
    });

    it('should handle non-sequential folders', async () => {
      const { getNextLabnoteNumber } = await import('../lib/labnoteStructure');
      
      const result = getNextLabnoteNumber(['005_Fifth', '010_Tenth']);
      
      expect(result).toBe('011');
    });
  });

  describe('sanitizeTitle', () => {
    it('should replace spaces with underscores', async () => {
      const { sanitizeTitle } = await import('../lib/labnoteStructure');
      
      const result = sanitizeTitle('My Experiment Title');
      
      expect(result).toBe('My_Experiment_Title');
    });

    it('should remove special characters', async () => {
      const { sanitizeTitle } = await import('../lib/labnoteStructure');
      
      const result = sanitizeTitle('Test: Experiment #1');
      
      expect(result).toBe('Test_Experiment_1');
    });

    it('should keep Korean characters', async () => {
      const { sanitizeTitle } = await import('../lib/labnoteStructure');
      
      const result = sanitizeTitle('실험 노트 테스트');
      
      expect(result).toBe('실험_노트_테스트');
    });
  });

  describe('generateReadmeContent', () => {
    it('should include title in YAML front matter', async () => {
      const { generateReadmeContent } = await import('../lib/labnoteStructure');
      
      const result = generateReadmeContent('My Experiment');
      
      expect(result).toContain('title: My Experiment');
    });

    it('should include YAML front matter', async () => {
      const { generateReadmeContent } = await import('../lib/labnoteStructure');
      
      const result = generateReadmeContent('Test');
      
      expect(result).toContain('---');
      expect(result).toContain('title:');
      expect(result).toContain('created_date:');
      expect(result).toContain('last_updated_date:');
    });

    it('should include author if provided', async () => {
      const { generateReadmeContent } = await import('../lib/labnoteStructure');
      
      const result = generateReadmeContent('Test', 'John Doe');
      
      expect(result).toContain('author: John Doe');
    });

    it('should include empty author field if not provided', async () => {
      const { generateReadmeContent } = await import('../lib/labnoteStructure');
      
      const result = generateReadmeContent('Test');
      
      expect(result).toContain('author:');
    });

    it('should include Experiment Objective section', async () => {
      const { generateReadmeContent } = await import('../lib/labnoteStructure');
      
      const result = generateReadmeContent('Test');
      
      expect(result).toContain('## 🎯 Experiment Objective');
      expect(result).toContain('Briefly describe the main objective');
    });

    it('should include Related Workflows section', async () => {
      const { generateReadmeContent } = await import('../lib/labnoteStructure');
      
      const result = generateReadmeContent('Test');
      
      expect(result).toContain('## 🗂️ Related Workflows');
      expect(result).toContain('New workflow');
    });

    it('should include experiment_type and sample_tracking in YAML', async () => {
      const { generateReadmeContent } = await import('../lib/labnoteStructure');
      
      const result = generateReadmeContent('Test');
      
      expect(result).toContain('experiment_type: labnote');
      expect(result).toContain('sample_tracking: yes');
    });
  });

  describe('createLabnoteStructure', () => {
    it('should export createLabnoteStructure function', async () => {
      const { createLabnoteStructure } = await import('../lib/labnoteStructure');
      
      expect(typeof createLabnoteStructure).toBe('function');
    });

    it('should return structure with correct folder paths', async () => {
      const path = await import('path');
      const { createLabnoteStructure } = await import('../lib/labnoteStructure');
      
      const result = createLabnoteStructure('/workspace', 'Test Experiment', [], 'Author');
      
      // Use path.join to handle platform-specific path separators
      expect(result.labnoteFolder).toBe(path.join('/workspace', 'labnote', '001_Test_Experiment'));
      expect(result.readmePath).toBe(path.join('/workspace', 'labnote', '001_Test_Experiment', 'README.labnote.md'));
      expect(result.imagesFolder).toBe(path.join('/workspace', 'labnote', '001_Test_Experiment', 'images'));
      expect(result.resourcesFolder).toBe(path.join('/workspace', 'labnote', '001_Test_Experiment', 'resources'));
    });
  });
});
