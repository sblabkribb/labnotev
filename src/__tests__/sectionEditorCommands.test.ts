import { mockVscode } from './setup';

describe('commands with SectionEditorProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getActiveLabnoteEditTarget', () => {
    it('should return section mode when sectionEditorProvider has active labnote document', async () => {
      const { getActiveLabnoteEditTarget } = await import('../lib/labnoteWorkflowContext');
      const mockProvider = {
        getActiveDocument: vi.fn().mockReturnValue({ uri: { fsPath: '/test/README.labnote.md' } }),
        getEditorMode: vi.fn().mockReturnValue('labnote'),
      } as any;

      // No active text editor
      mockVscode.window.activeTextEditor = undefined;

      const target = getActiveLabnoteEditTarget(mockProvider);
      expect(target).toBeDefined();
      expect(target!.mode).toBe('section');
    });

    it('should return undefined when sectionEditorProvider has active workflow mode', async () => {
      const { getActiveLabnoteEditTarget } = await import('../lib/labnoteWorkflowContext');
      const mockProvider = {
        getActiveDocument: vi.fn().mockReturnValue({ uri: { fsPath: '/test/workflow.md' } }),
        getEditorMode: vi.fn().mockReturnValue('workflow'),
      } as any;

      mockVscode.window.activeTextEditor = undefined;

      const target = getActiveLabnoteEditTarget(mockProvider);
      expect(target).toBeUndefined();
    });

    it('should prefer text editor over section editor', async () => {
      const { getActiveLabnoteEditTarget } = await import('../lib/labnoteWorkflowContext');
      
      mockVscode.window.activeTextEditor = {
        document: {
          uri: { fsPath: '/workspace/labnote/001_Test/README.labnote.md' },
          getText: vi.fn().mockReturnValue(''),
        },
      };

      const mockProvider = {
        getActiveDocument: vi.fn().mockReturnValue({ uri: { fsPath: '/test/README.labnote.md' } }),
        getEditorMode: vi.fn().mockReturnValue('labnote'),
      } as any;

      const target = getActiveLabnoteEditTarget(mockProvider);
      expect(target).toBeDefined();
      expect(target!.mode).toBe('readme');
    });
  });

  describe('labnoteDirFromTarget', () => {
    it('should extract directory from section mode target', async () => {
      const { labnoteDirFromTarget } = await import('../lib/labnoteWorkflowContext');
      const target = {
        mode: 'section' as const,
        document: { uri: { fsPath: '/workspace/labnote/001_Test/README.labnote.md' } },
        provider: {} as any,
      };
      const dir = labnoteDirFromTarget(target);
      expect(dir).toContain('001_Test');
    });
  });
});
