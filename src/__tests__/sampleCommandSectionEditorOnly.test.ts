/**
 * Tests that the TreeView "Insert to Editor" and "Move to Definition" commands
 * stay inside the Section Editor and never act on a plain markdown text editor.
 *
 * Background: previously these commands could fall back to inserting into the
 * active markdown editor or open a second text editor for the same `.labnote.md`
 * file, breaking the Section Editor's structured editing model. The new
 * contract is:
 *   - if a markdown text editor is the active editor, both commands show an
 *     info nudge and do nothing
 *   - otherwise they delegate to the Section Editor webview only
 */
import { mockVscode } from './setup';

vi.mock('vscode', () => mockVscode);

describe('Sample TreeView commands — Section Editor-only contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVscode.window.activeTextEditor = undefined;
  });

  // ----- insertSampleToEditor -----

  describe('labnotev.insertSampleToEditor', () => {
    const sampleItem = {
      itemType: 'sample',
      sampleType: 'DNA',
      sampleId: 'DNA-123',
      alias: 'MyAlias',
      sampleDescription: null,
    };

    it('shows a nudge and does nothing when a markdown text editor is active', async () => {
      const mockEditor = {
        document: { languageId: 'markdown', getText: vi.fn(() => '') },
        edit: vi.fn(),
        selection: { active: { line: 0, character: 0 } },
        setDecorations: vi.fn(),
      };
      mockVscode.window.activeTextEditor = mockEditor as any;

      const { activate } = await import('../extension');
      await activate({
        subscriptions: [],
        extensionUri: { fsPath: '/test' },
        extensionPath: '/test',
      } as any);

      const cmd = mockVscode.commands.registerCommand.mock.calls.find(
        (c: any[]) => c[0] === 'labnotev.insertSampleToEditor'
      );
      expect(cmd).toBeDefined();
      await cmd![1](sampleItem);

      expect(mockVscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringMatching(/Section Editor/)
      );
      expect(mockEditor.edit).not.toHaveBeenCalled();
    });

    it('shows a nudge when no Section Editor and no active markdown editor', async () => {
      mockVscode.window.activeTextEditor = undefined;

      const { activate } = await import('../extension');
      await activate({
        subscriptions: [],
        extensionUri: { fsPath: '/test' },
        extensionPath: '/test',
      } as any);

      const cmd = mockVscode.commands.registerCommand.mock.calls.find(
        (c: any[]) => c[0] === 'labnotev.insertSampleToEditor'
      );
      await cmd![1](sampleItem);

      expect(mockVscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringMatching(/Section Editor/)
      );
    });

    it('does nothing when called with no item (command palette)', async () => {
      const { activate } = await import('../extension');
      await activate({
        subscriptions: [],
        extensionUri: { fsPath: '/test' },
        extensionPath: '/test',
      } as any);

      const cmd = mockVscode.commands.registerCommand.mock.calls.find(
        (c: any[]) => c[0] === 'labnotev.insertSampleToEditor'
      );
      await cmd![1](undefined);

      expect(mockVscode.window.showInformationMessage).not.toHaveBeenCalled();
    });
  });

  // ----- moveToDefinition -----

  describe('labnotev.moveToDefinition', () => {
    const sampleItem = {
      itemType: 'sample',
      sampleType: 'DNA',
      sampleId: 'DNA-123',
      alias: 'MyAlias',
      scope: 'local',
    };

    it('shows a nudge when a markdown text editor is active', async () => {
      const mockEditor = {
        document: { languageId: 'markdown', getText: vi.fn(() => '') },
        setDecorations: vi.fn(),
      };
      mockVscode.window.activeTextEditor = mockEditor as any;

      const { activate } = await import('../extension');
      await activate({
        subscriptions: [],
        extensionUri: { fsPath: '/test' },
        extensionPath: '/test',
      } as any);

      const cmd = mockVscode.commands.registerCommand.mock.calls.find(
        (c: any[]) => c[0] === 'labnotev.moveToDefinition'
      );
      await cmd![1](sampleItem);

      expect(mockVscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringMatching(/Section Editor/)
      );
    });

    it('shows "Definition not found" when the webview cannot scroll to a definition', async () => {
      // No active text editor, no Section Editor doc → tryScroll... returns false.
      mockVscode.window.activeTextEditor = undefined;

      const { activate } = await import('../extension');
      await activate({
        subscriptions: [],
        extensionUri: { fsPath: '/test' },
        extensionPath: '/test',
      } as any);

      const cmd = mockVscode.commands.registerCommand.mock.calls.find(
        (c: any[]) => c[0] === 'labnotev.moveToDefinition'
      );
      await cmd![1](sampleItem);

      expect(mockVscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringMatching(/Definition not found/)
      );
    });

    it('also accepts string (sampleType, sampleId) call form from the webview fallback', async () => {
      mockVscode.window.activeTextEditor = undefined;

      const { activate } = await import('../extension');
      await activate({
        subscriptions: [],
        extensionUri: { fsPath: '/test' },
        extensionPath: '/test',
      } as any);

      const cmd = mockVscode.commands.registerCommand.mock.calls.find(
        (c: any[]) => c[0] === 'labnotev.moveToDefinition'
      );
      await cmd![1]('DNA', 'DNA-123');

      expect(mockVscode.window.showInformationMessage).toHaveBeenCalledWith(
        expect.stringMatching(/Definition not found/)
      );
    });

    it('does nothing when called with no args (command palette)', async () => {
      const { activate } = await import('../extension');
      await activate({
        subscriptions: [],
        extensionUri: { fsPath: '/test' },
        extensionPath: '/test',
      } as any);

      const cmd = mockVscode.commands.registerCommand.mock.calls.find(
        (c: any[]) => c[0] === 'labnotev.moveToDefinition'
      );
      await cmd![1](undefined);

      expect(mockVscode.window.showInformationMessage).not.toHaveBeenCalled();
    });
  });
});
