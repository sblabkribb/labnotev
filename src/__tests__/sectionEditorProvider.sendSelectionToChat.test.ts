import { mockVscode } from './setup';

/**
 * Unit tests for `SectionEditorProvider.handleSendSelectionToChat`.
 *
 * The handler is a small, side-effectful method: it builds a Chat prompt
 * (with a `#file:` reference variable and a metadata header) and forwards
 * it to `workbench.action.chat.open`. We invoke the public method directly
 * so we can avoid the full `resolveCustomTextEditor` setup and assert only
 * the contract that v0.56.0 introduced.
 */

function makeDocument(fsPath: string, uriString = `file://${fsPath}`) {
  return {
    uri: {
      fsPath,
      toString: () => uriString,
    },
  } as any;
}

async function makeProvider() {
  const { SectionEditorProvider } = await import('../sectionEditorProvider');
  const ctx = {
    subscriptions: [],
    extensionUri: { fsPath: '/test' },
    extensionPath: '/test',
  } as any;
  return new SectionEditorProvider(ctx);
}

describe('SectionEditorProvider.handleSendSelectionToChat', () => {
  let asRelativePathSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    asRelativePathSpy = vi.fn(
      (uri: { fsPath: string }, _includeWorkspaceFolder?: boolean) =>
        // Strip a leading slash so the result looks like a workspace-relative
        // path (matches the shape `asRelativePath` returns in real workspaces).
        uri.fsPath.replace(/^\/+/, '')
    );
    (mockVscode.workspace as any).asRelativePath = asRelativePathSpy;
  });

  it('opens Chat with a prompt that contains #file:, the meta line, and the fenced selection', async () => {
    const provider = await makeProvider();
    const doc = makeDocument('/workspace/notes/exp01.labnote.md');

    await provider.handleSendSelectionToChat(doc, {
      selectedText: 'Add 10 uL of buffer',
      chatContextOpId: 'UHW010',
      chatContextSectionHeading: 'Method',
    });

    expect(mockVscode.commands.executeCommand).toHaveBeenCalledTimes(1);
    const [commandId, options] = mockVscode.commands.executeCommand.mock
      .calls[0] as [string, { query: string; isPartialQuery: boolean }];
    expect(commandId).toBe('workbench.action.chat.open');
    expect(options.isPartialQuery).toBe(true);

    const query = options.query;
    const lines = query.split('\n');
    expect(lines[0]).toBe('#file:workspace/notes/exp01.labnote.md');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe(
      'Selected from exp01.labnote.md / UnitOp UHW010 / Section "Method":'
    );
    expect(lines[3]).toBe('');
    expect(lines[4]).toBe('```');
    expect(lines[5]).toBe('Add 10 uL of buffer');
    expect(lines[6]).toBe('```');
  });

  it('omits UnitOp / Section segments when chat context props are not supplied', async () => {
    const provider = await makeProvider();
    const doc = makeDocument('/workspace/notes/exp01.labnote.md');

    await provider.handleSendSelectionToChat(doc, {
      selectedText: 'just text',
    });

    expect(mockVscode.commands.executeCommand).toHaveBeenCalledTimes(1);
    const [, options] = mockVscode.commands.executeCommand.mock.calls[0] as [
      string,
      { query: string }
    ];
    expect(options.query.split('\n')[2]).toBe('Selected from exp01.labnote.md:');
  });

  it('is a no-op when the selected text is empty or whitespace', async () => {
    const provider = await makeProvider();
    const doc = makeDocument('/workspace/notes/exp01.labnote.md');

    await provider.handleSendSelectionToChat(doc, { selectedText: '' });
    await provider.handleSendSelectionToChat(doc, { selectedText: '   \n\t' });
    await provider.handleSendSelectionToChat(doc, undefined);

    expect(mockVscode.commands.executeCommand).not.toHaveBeenCalled();
    expect(mockVscode.window.showErrorMessage).not.toHaveBeenCalled();
  });

  it('shows a localized error toast when executeCommand throws', async () => {
    const provider = await makeProvider();
    const doc = makeDocument('/workspace/notes/exp01.labnote.md');

    mockVscode.commands.executeCommand.mockImplementationOnce(() =>
      Promise.reject(new Error('Chat is not installed'))
    );

    await provider.handleSendSelectionToChat(doc, {
      selectedText: 'hello',
    });

    expect(mockVscode.window.showErrorMessage).toHaveBeenCalledTimes(1);
    const msg = mockVscode.window.showErrorMessage.mock.calls[0][0] as string;
    expect(msg).toBe('Failed to open Chat. Ensure VS Code Chat is enabled.');
  });
});
