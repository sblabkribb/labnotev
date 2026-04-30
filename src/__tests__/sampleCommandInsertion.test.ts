/**
 * Tests for sample command insertion (generateSampleId, inputSampleInfo)
 * Tests that @type: prefix is not duplicated when inserting new samples
 */
import { mockVscode } from './setup';

// Mock modules
vi.mock('vscode', () => mockVscode);
vi.mock('../lib/sampleUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/sampleUtils')>();
  return {
    ...actual,
    generateSampleId: vi.fn((type: string) => `${type}-1234567890123`),
  };
});
vi.mock('../lib/dataLoader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/dataLoader')>();
  return {
    ...actual,
    findResourcesFolder: vi.fn(() => '/test/resources'),
    ensureResourcesFolder: vi.fn(),
    saveSampleToResources: vi.fn(),
  };
});
vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('path')>();
  return {
    ...actual,
    basename: vi.fn((p: string) => p.split('/').pop() || p),
    dirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/')),
    join: vi.fn((...parts: string[]) => parts.join('/')),
  };
});

describe('Sample Command Insertion - Prefix Duplication Fix', () => {
  let mockEditor: any;
  let mockEditBuilder: any;
  let mockDocument: any;
  let mockPosition: any;
  let mockRange: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockEditBuilder = {
      insert: vi.fn(),
      replace: vi.fn(),
    };

    mockPosition = {
      line: 0,
      character: 8, // After "@labware:"
    };

    mockRange = {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 8 },
    };

    mockDocument = {
      lineAt: vi.fn((line: number) => ({
        text: '@labware:',
        range: mockRange,
      })),
      getText: vi.fn(() => '@labware:'),
      uri: { fsPath: '/test/file.md' },
    };

    mockEditor = {
      document: mockDocument,
      selection: {
        active: mockPosition,
      },
      edit: vi.fn((callback: (builder: any) => void) => {
        callback(mockEditBuilder);
        return Promise.resolve(true);
      }),
      // Used by applySampleIdHighlights (registered via registerUtilityCommands
      // during activate()); no-op so the activate() path doesn't throw in
      // tests that set `languageId = 'markdown'`.
      setDecorations: vi.fn(),
    };

    mockVscode.window.activeTextEditor = mockEditor;
    mockVscode.window.showInputBox = vi.fn()
      .mockResolvedValueOnce('TestAlias') // alias
      .mockResolvedValueOnce('Test Description'); // description
  });

  describe('generateSampleId command', () => {
    it('should replace existing @type: prefix instead of inserting after it', async () => {
      // Simulate user has typed "@labware:" and selected "새 ID 생성"
      const { activate } = await import('../extension');
      const mockContext = {
        subscriptions: [],
        extensionUri: { fsPath: '/test' },
        extensionPath: '/test',
      };

      await activate(mockContext as any);

      // Find and execute the generateSampleId command
      const commandCalls = mockVscode.commands.registerCommand.mock.calls;
      const generateSampleIdCall = commandCalls.find(
        (call: any[]) => call[0] === 'labnotev.generateSampleId'
      );

      expect(generateSampleIdCall).toBeDefined();
      const handler = generateSampleIdCall![1];

      // Execute handler
      await handler('Labware', mockDocument.uri);

      // Should use replace, not insert, to avoid duplication
      expect(mockEditBuilder.replace).toHaveBeenCalled();
      expect(mockEditBuilder.insert).not.toHaveBeenCalled();

      // Verify the replacement range includes the @labware: prefix
      const replaceCall = mockEditBuilder.replace.mock.calls[0];
      expect(replaceCall[0]).toBeDefined(); // range
      // Phase A/C: the production replacement now uses the `;` delimiter
      // (`@labware;Labware-\d+;...`) — accept either `;` or `:` so this test
      // continues to guard against prefix duplication regardless of the
      // exact delimiter emitted.
      expect(replaceCall[1]).toMatch(/^@labware[;:]Labware-\d+/);
    });

    it('should handle @dna: prefix correctly', async () => {
      mockDocument.lineAt = vi.fn(() => ({
        text: '@dna:',
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
      }));
      mockPosition.character = 5;

      const { activate } = await import('../extension');
      const mockContext = {
        subscriptions: [],
        extensionUri: { fsPath: '/test' },
        extensionPath: '/test',
      };

      await activate(mockContext as any);

      const commandCalls = mockVscode.commands.registerCommand.mock.calls;
      const generateSampleIdCall = commandCalls.find(
        (call: any[]) => call[0] === 'labnotev.generateSampleId'
      );
      const handler = generateSampleIdCall![1];

      await handler('DNA', mockDocument.uri);

      expect(mockEditBuilder.replace).toHaveBeenCalled();
      const replaceCall = mockEditBuilder.replace.mock.calls[0];
      expect(replaceCall[1]).toMatch(/^@dna[;:]DNA-\d+/);
    });

    it('should insert normally when no @type: prefix exists', async () => {
      // No prefix in document
      mockDocument.lineAt = vi.fn(() => ({
        text: 'Some text',
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 9 } },
      }));
      mockPosition.character = 9;

      const { activate } = await import('../extension');
      const mockContext = {
        subscriptions: [],
        extensionUri: { fsPath: '/test' },
        extensionPath: '/test',
      };

      await activate(mockContext as any);

      const commandCalls = mockVscode.commands.registerCommand.mock.calls;
      const generateSampleIdCall = commandCalls.find(
        (call: any[]) => call[0] === 'labnotev.generateSampleId'
      );
      const handler = generateSampleIdCall![1];

      await handler('DNA', mockDocument.uri);

      // Should use insert when no prefix exists
      expect(mockEditBuilder.insert).toHaveBeenCalled();
    });
  });

  describe('inputSampleInfo command', () => {
    beforeEach(() => {
      // Reset input box mocks for inputSampleInfo (needs sampleId first)
      mockVscode.window.showInputBox = vi.fn()
        .mockResolvedValueOnce('Labware-999') // sampleId
        .mockResolvedValueOnce('TestAlias') // alias
        .mockResolvedValueOnce('Test Description'); // description
    });

    it('should replace existing @type: prefix instead of inserting after it', async () => {
      const { activate } = await import('../extension');
      const mockContext = {
        subscriptions: [],
        extensionUri: { fsPath: '/test' },
        extensionPath: '/test',
      };

      await activate(mockContext as any);

      const commandCalls = mockVscode.commands.registerCommand.mock.calls;
      const inputSampleInfoCall = commandCalls.find(
        (call: any[]) => call[0] === 'labnotev.inputSampleInfo'
      );

      expect(inputSampleInfoCall).toBeDefined();
      const handler = inputSampleInfoCall![1];

      await handler('Labware', mockDocument.uri);

      expect(mockEditBuilder.replace).toHaveBeenCalled();
      expect(mockEditBuilder.insert).not.toHaveBeenCalled();

      const replaceCall = mockEditBuilder.replace.mock.calls[0];
      expect(replaceCall[1]).toMatch(/^@labware[;:]Labware-999/);
    });

    it('should handle @rna: prefix correctly', async () => {
      mockDocument.lineAt = vi.fn(() => ({
        text: '@rna:',
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
      }));
      mockPosition.character = 5;

      mockVscode.window.showInputBox = vi.fn()
        .mockResolvedValueOnce('RNA-888')
        .mockResolvedValueOnce('RNAAlias')
        .mockResolvedValueOnce('RNA Description');

      const { activate } = await import('../extension');
      const mockContext = {
        subscriptions: [],
        extensionUri: { fsPath: '/test' },
        extensionPath: '/test',
      };

      await activate(mockContext as any);

      const commandCalls = mockVscode.commands.registerCommand.mock.calls;
      const inputSampleInfoCall = commandCalls.find(
        (call: any[]) => call[0] === 'labnotev.inputSampleInfo'
      );
      const handler = inputSampleInfoCall![1];

      await handler('RNA', mockDocument.uri);

      expect(mockEditBuilder.replace).toHaveBeenCalled();
      const replaceCall = mockEditBuilder.replace.mock.calls[0];
      expect(replaceCall[1]).toMatch(/^@rna[;:]RNA-888/);
    });
  });

  // Phase C-3 regression: the TreeView `insertSampleDefinition` path used to
  // insert text after an existing `@type;`/`@type:` prefix, leaving duplicates
  // like `@dna:@dna;DNA-123;Alias`. With Phase C-2 it must detect the prefix
  // under the caret and replace it instead.
  describe('insertSampleDefinition TreeView command (Phase C-2)', () => {
    it('should replace an existing @dna: prefix when inserting a DNA definition from the TreeView', async () => {
      mockDocument.lineAt = vi.fn(() => ({
        text: '@dna:',
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
      }));
      mockDocument.languageId = 'markdown';
      mockPosition.character = 5;

      const { activate } = await import('../extension');
      const mockContext = {
        subscriptions: [],
        extensionUri: { fsPath: '/test' },
        extensionPath: '/test',
      };
      await activate(mockContext as any);

      const commandCalls = mockVscode.commands.registerCommand.mock.calls;
      const insertDefCall = commandCalls.find(
        (call: any[]) => call[0] === 'labnotev.insertSampleDefinition'
      );
      expect(insertDefCall).toBeDefined();
      const handler = insertDefCall![1];

      const item = {
        itemType: 'sample',
        sampleType: 'DNA',
        sampleId: 'DNA-123',
        alias: 'MyAlias',
        sampleDescription: null,
      };
      // Force fallback to the activeTextEditor path (no sectionEditor doc).
      await handler(item);

      expect(mockEditBuilder.replace).toHaveBeenCalled();
      expect(mockEditBuilder.insert).not.toHaveBeenCalled();
      const replaceCall = mockEditBuilder.replace.mock.calls[0];
      // The replacement text is the full definition including a single
      // `@dna;` prefix — not two prefixes.
      expect(replaceCall[1]).toBe('@dna;DNA-123;MyAlias');
    });

    it('should fall back to insert when no prefix is at the caret', async () => {
      mockDocument.lineAt = vi.fn(() => ({
        text: 'some body text',
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 14 } },
      }));
      mockDocument.languageId = 'markdown';
      mockPosition.character = 14;

      const { activate } = await import('../extension');
      const mockContext = {
        subscriptions: [],
        extensionUri: { fsPath: '/test' },
        extensionPath: '/test',
      };
      await activate(mockContext as any);

      const commandCalls = mockVscode.commands.registerCommand.mock.calls;
      const insertDefCall = commandCalls.find(
        (call: any[]) => call[0] === 'labnotev.insertSampleDefinition'
      );
      const handler = insertDefCall![1];

      const item = {
        itemType: 'sample',
        sampleType: 'DNA',
        sampleId: 'DNA-9',
        alias: 'A',
        sampleDescription: null,
      };
      await handler(item);

      expect(mockEditBuilder.insert).toHaveBeenCalled();
      expect(mockEditBuilder.replace).not.toHaveBeenCalled();
    });
  });
});
