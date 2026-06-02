import { vi } from 'vitest';

// Generic VS Code listener / handler stub — mocks register-style APIs use this
// shape so callers can read `mock.calls[i][0]` (event/command id) and
// `mock.calls[i][1]` (handler) with proper tuple typing instead of `[]`.
type AnyHandler = (...args: any[]) => any;
type Disposable = { dispose: () => void };
const makeDisposable = (): Disposable => ({ dispose: vi.fn() });

// Mock VSCode API
export const mockVscode = {
  window: {
    registerCustomEditorProvider: vi.fn(
      (_viewType: string, _provider: unknown, _options?: unknown): Disposable => makeDisposable()
    ),
    registerTreeDataProvider: vi.fn(
      (_viewId: string, _provider: unknown): Disposable => makeDisposable()
    ),
    createTreeView: vi.fn((_viewId: string, _options: unknown) => ({
      dispose: vi.fn(),
      reveal: vi.fn(),
      onDidChangeSelection: vi.fn((_listener: AnyHandler) => makeDisposable()),
      onDidExpandElement: vi.fn((_listener: AnyHandler) => makeDisposable()),
      onDidCollapseElement: vi.fn((_listener: AnyHandler) => makeDisposable()),
    })),
    showErrorMessage: vi.fn((_msg: string, ..._items: string[]) => Promise.resolve(undefined)),
    showWarningMessage: vi.fn((_msg: string, ..._items: string[]) => Promise.resolve(undefined)),
    showInformationMessage: vi.fn((_msg: string, ..._items: string[]) => Promise.resolve(undefined)),
    showInputBox: vi.fn((_options?: unknown) => Promise.resolve(undefined as string | undefined)),
    showQuickPick: vi.fn((_items: unknown, _options?: unknown) => Promise.resolve(undefined as unknown)),
    showOpenDialog: vi.fn((_options?: unknown) => Promise.resolve(undefined as unknown[] | undefined)),
    activeTextEditor: undefined as unknown,
    onDidChangeActiveTextEditor: vi.fn((_listener: AnyHandler) => makeDisposable()),
    createTextEditorDecorationType: vi.fn((_options: unknown) => ({
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
    color?: unknown;
    constructor(id: string, color?: unknown) {
      this.id = id;
      this.color = color;
    }
  },
  ThemeColor: class MockThemeColor {
    id: string;
    constructor(id: string) {
      this.id = id;
    }
  },
  DecorationRangeBehavior: {
    ClosedClosed: 1,
    OpenOpen: 0,
    ClosedOpen: 2,
    OpenClosed: 3,
  },
  commands: {
    registerCommand: vi.fn(
      (_command: string, _callback: AnyHandler, _thisArg?: unknown): Disposable => makeDisposable()
    ),
    executeCommand: vi.fn((..._args: unknown[]) => Promise.resolve(undefined as unknown)),
  },
  env: {
    openExternal: vi.fn(),
  },
  // `vscode.l10n` shim — at runtime VS Code reads `l10n/bundle.l10n.<locale>.json`
  // and rewrites the source string. Tests only need the English-source identity
  // behaviour, but must also support the variadic (`{0}`, `{1}`) and the object
  // (`{ message, args }`) overloads so callers that pass either shape do not
  // crash. The format string is interpreted with indexed placeholders so tests
  // can assert on the same rendered text users see when the locale is the
  // English source.
  l10n: {
    t: vi.fn(
      (
        message: string | { message: string; args?: Array<string | number | boolean> },
        ...args: Array<string | number | boolean>
      ) => {
        const fmt = (s: string, a: Array<string | number | boolean>) =>
          a.length ? s.replace(/\{(\d+)\}/g, (_m, i) => String(a[Number(i)] ?? '')) : s;
        if (typeof message === 'string') return fmt(message, args);
        return fmt(message.message, message.args ?? []);
      }
    ),
    bundle: undefined,
    uri: undefined,
  },
  languages: {
    registerDocumentLinkProvider: vi.fn(
      (_selector: unknown, _provider: unknown): Disposable => makeDisposable()
    ),
    registerHoverProvider: vi.fn(
      (_selector: unknown, _provider: unknown): Disposable => makeDisposable()
    ),
    registerCompletionItemProvider: vi.fn(
      (_selector: unknown, _provider: unknown, ..._triggers: string[]): Disposable => makeDisposable()
    ),
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
    onDidChangeTextDocument: vi.fn((_listener: AnyHandler) => makeDisposable()),
    onDidSaveTextDocument: vi.fn((_listener: AnyHandler) => makeDisposable()),
    onDidChangeConfiguration: vi.fn((_listener: AnyHandler) => makeDisposable()),
    applyEdit: vi.fn((_edit: unknown) => Promise.resolve(true)),
    createFileSystemWatcher: vi.fn((_glob: string) => ({
      onDidChange: vi.fn((_listener: AnyHandler) => makeDisposable()),
      onDidCreate: vi.fn((_listener: AnyHandler) => makeDisposable()),
      onDidDelete: vi.fn((_listener: AnyHandler) => makeDisposable()),
      dispose: vi.fn(),
    })),
    findFiles: vi.fn((..._args: unknown[]) => Promise.resolve([])),
    openTextDocument: vi.fn((_uri: unknown) => Promise.resolve(undefined as unknown)),
    asRelativePath: vi.fn((p: unknown) =>
      typeof p === 'string' ? p : (p as { fsPath?: string })?.fsPath ?? String(p)
    ),
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string, defaultValue?: unknown) => defaultValue),
      has: vi.fn(() => false),
      inspect: vi.fn(),
      update: vi.fn(),
    })),
  },
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3,
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
  DataTransferItem: class MockDataTransferItem {
    value: unknown;
    constructor(value: unknown) {
      this.value = value;
    }
    asString(): Promise<string> {
      return Promise.resolve(String(this.value));
    }
  },
};

vi.mock('vscode', () => mockVscode);

beforeEach(() => {
  vi.clearAllMocks();
  mockVscode.env.openExternal.mockResolvedValue(true);
});
