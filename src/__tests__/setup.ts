import { vi } from 'vitest';

// Mock VSCode API
export const mockVscode = {
  window: {
    registerCustomEditorProvider: vi.fn(() => ({ dispose: vi.fn() })),
    registerTreeDataProvider: vi.fn(() => ({ dispose: vi.fn() })),
    createTreeView: vi.fn(() => ({
      dispose: vi.fn(),
      reveal: vi.fn(),
      onDidChangeSelection: vi.fn(() => ({ dispose: vi.fn() })),
      onDidExpandElement: vi.fn(() => ({ dispose: vi.fn() })),
      onDidCollapseElement: vi.fn(() => ({ dispose: vi.fn() })),
    })),
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showInformationMessage: vi.fn(),
    showInputBox: vi.fn(),
    showQuickPick: vi.fn(),
    showOpenDialog: vi.fn(),
    activeTextEditor: undefined as unknown,
    onDidChangeActiveTextEditor: vi.fn(() => ({ dispose: vi.fn() })),
    createTextEditorDecorationType: vi.fn(() => ({
      dispose: vi.fn(),
    })),
  },
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2,
  },
  TreeItem: class MockTreeItem {
    label: string | undefined;
    collapsibleState: number | undefined;
    contextValue?: string;
    iconPath?: unknown;
    command?: unknown;
    tooltip?: string;
    description?: string;
    constructor(label: string, collapsibleState?: number) {
      this.label = label;
      this.collapsibleState = collapsibleState;
    }
  },
  EventEmitter: class MockEventEmitter {
    event = vi.fn();
    fire = vi.fn();
    dispose = vi.fn();
  },
  ThemeIcon: class MockThemeIcon {
    id: string;
    color?: string;
    constructor(id: string, color?: string) {
      this.id = id;
      this.color = color;
    }
  },
  DecorationRangeBehavior: {
    ClosedClosed: 1,
    OpenOpen: 0,
    ClosedOpen: 2,
    OpenClosed: 3,
  },
  commands: {
    registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
    executeCommand: vi.fn(),
  },
  env: {
    openExternal: vi.fn(),
  },
  languages: {
    registerDocumentLinkProvider: vi.fn(() => ({ dispose: vi.fn() })),
    registerHoverProvider: vi.fn(() => ({ dispose: vi.fn() })),
    registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })),
  },
  CompletionItem: vi.fn().mockImplementation((label, kind) => ({
    label,
    kind,
    insertText: undefined,
    detail: undefined,
    sortText: undefined,
    command: undefined,
    documentation: undefined,
  })),
  CompletionItemKind: {
    Reference: 1,
    Event: 2,
    Snippet: 3,
    Text: 0,
    Method: 2,
    Function: 3,
    Constructor: 4,
    Field: 5,
    Variable: 6,
    Class: 7,
  },
  MarkdownString: vi.fn().mockImplementation((value) => ({ value })),
  workspace: {
    getWorkspaceFolder: vi.fn(() => ({
      uri: {
        fsPath: '/test/workspace',
        toString: () => 'file:///test/workspace',
      },
    })),
    workspaceFolders: [
      {
        uri: {
          fsPath: '/test/workspace',
          toString: () => 'file:///test/workspace',
        },
      },
    ],
    fs: {
      writeFile: vi.fn(),
      stat: vi.fn(),
      createDirectory: vi.fn(),
      readFile: vi.fn(),
    },
    onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
    onDidSaveTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
    applyEdit: vi.fn(),
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue?: unknown) => defaultValue),
      has: vi.fn(() => false),
      inspect: vi.fn(),
      update: vi.fn(),
    })),
  },
  Uri: {
    file: vi.fn((path: string) => ({
      fsPath: path,
      toString: () => `file://${path}`,
    })),
    joinPath: vi.fn((base: { fsPath: string }, ...paths: string[]) => ({
      fsPath: [base.fsPath, ...paths].join('/'),
      toString: () => `file://${[base.fsPath, ...paths].join('/')}`,
    })),
  },
  Range: class MockRange {
    start: { line: number; character: number };
    end: { line: number; character: number };
    constructor(
      startLine: number,
      startChar: number,
      endLine: number,
      endChar: number
    ) {
      this.start = { line: startLine, character: startChar };
      this.end = { line: endLine, character: endChar };
    }
  },
  WorkspaceEdit: class MockWorkspaceEdit {
    replace = vi.fn();
    insert = vi.fn();
    delete = vi.fn();
  },
  ExtensionContext: vi.fn(),
};

vi.mock('vscode', () => mockVscode);

beforeEach(() => {
  vi.clearAllMocks();
  mockVscode.env.openExternal.mockResolvedValue(true);
});
