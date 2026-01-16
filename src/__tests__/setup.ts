import { vi } from 'vitest';

// Mock VSCode API
export const mockVscode = {
  window: {
    registerCustomEditorProvider: vi.fn(() => ({ dispose: vi.fn() })),
    showErrorMessage: vi.fn(),
    showInputBox: vi.fn(),
  },
  commands: {
    registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
    executeCommand: vi.fn(),
  },
  workspace: {
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
    applyEdit: vi.fn(),
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
  Range: vi.fn((startLine: number, startChar: number, endLine: number, endChar: number) => ({
    start: { line: startLine, character: startChar },
    end: { line: endLine, character: endChar },
  })),
  WorkspaceEdit: vi.fn(() => ({
    replace: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  })),
  ExtensionContext: vi.fn(),
};

vi.mock('vscode', () => mockVscode);

beforeEach(() => {
  vi.clearAllMocks();
});
