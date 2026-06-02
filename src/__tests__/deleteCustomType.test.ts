import { mockVscode } from './setup';
import {
  SampleTreeItem,
  SampleTreeItemType,
} from '../views/SampleTreeViewProvider';

/**
 * Issue #29: custom sample types can be deleted from the TreeView. Built-in
 * types stay protected and a type that is still in use (registered samples or
 * document references) is blocked. Deletion only edits the
 * `labnotev.customSampleTypes` setting; JSON data files are preserved.
 */
describe('SampleTreeItem contextValue for Type nodes', () => {
  it('marks custom types as type_custom (enables delete menu)', () => {
    const item = new SampleTreeItem('Foo [0]', SampleTreeItemType.Type, {
      scope: 'local',
      sampleType: 'Foo',
      isCustom: true,
    });
    expect(item.contextValue).toBe('type_custom');
  });

  it('keeps built-in types as type (no delete menu)', () => {
    const item = new SampleTreeItem('DNA [0]', SampleTreeItemType.Type, {
      scope: 'local',
      sampleType: 'DNA',
      isCustom: false,
    });
    expect(item.contextValue).toBe('type');
  });
});

describe('labnotev.deleteCustomType', () => {
  let registered: Map<string, (...args: any[]) => any>;
  let sampleTreeProvider: any;
  let sectionEditorProvider: any;
  let updateSpy: any;
  let configStore: string[];

  const typeItem = (sampleType: string) => ({
    itemType: SampleTreeItemType.Type,
    sampleType,
    scope: 'local',
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    registered = new Map();
    mockVscode.commands.registerCommand.mockImplementation(
      (id: string, cb: (...args: any[]) => any) => {
        registered.set(id, cb);
        return { dispose: vi.fn() };
      }
    );

    configStore = ['MyType', 'Other'];
    updateSpy = vi.fn().mockResolvedValue(undefined);
    mockVscode.workspace.getConfiguration.mockReturnValue({
      get: vi.fn((_key: string, def?: unknown) => configStore ?? def),
      has: vi.fn(() => false),
      inspect: vi.fn(),
      update: updateSpy,
    } as any);
    mockVscode.workspace.findFiles = vi.fn().mockResolvedValue([]);

    sampleTreeProvider = {
      refresh: vi.fn(),
      getSampleIds: vi.fn(() => []),
    };
    sectionEditorProvider = {
      broadcastCustomTypesUpdated: vi.fn(),
      getActiveDocument: vi.fn(() => undefined),
    };

    const { registerSampleCommands } = await import('../commands/sampleCommands');
    registerSampleCommands({ subscriptions: [] } as any, {
      sampleTreeProvider,
      sectionEditorProvider,
    });
  });

  it('ignores built-in types', async () => {
    const cb = registered.get('labnotev.deleteCustomType');
    expect(cb).toBeDefined();
    await cb!(typeItem('DNA'));
    expect(updateSpy).not.toHaveBeenCalled();
    expect(sectionEditorProvider.broadcastCustomTypesUpdated).not.toHaveBeenCalled();
  });

  it('blocks deletion when registered samples exist', async () => {
    sampleTreeProvider.getSampleIds = vi.fn((scope: string) =>
      scope === 'local' ? ['MyType-1'] : []
    );
    const cb = registered.get('labnotev.deleteCustomType');
    await cb!(typeItem('MyType'));
    expect(mockVscode.window.showWarningMessage).toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(sectionEditorProvider.broadcastCustomTypesUpdated).not.toHaveBeenCalled();
  });

  it('blocks deletion when a document references the type id', async () => {
    mockVscode.workspace.findFiles = vi
      .fn()
      .mockResolvedValueOnce([
        { fsPath: '/w/a.labnote.md', toString: () => 'file:///w/a.labnote.md' },
      ])
      .mockResolvedValueOnce([]);
    mockVscode.workspace.openTextDocument = vi.fn().mockResolvedValue({
      getText: () => 'uses MyType-1737000000000 here',
    });
    const cb = registered.get('labnotev.deleteCustomType');
    await cb!(typeItem('MyType'));
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('removes the type from config after confirmation', async () => {
    (mockVscode.window.showWarningMessage as any).mockResolvedValueOnce('Delete');
    const cb = registered.get('labnotev.deleteCustomType');
    await cb!(typeItem('MyType'));
    expect(updateSpy).toHaveBeenCalledWith(
      'customSampleTypes',
      ['Other'],
      mockVscode.ConfigurationTarget.Workspace
    );
    expect(sampleTreeProvider.refresh).toHaveBeenCalledTimes(1);
    expect(sectionEditorProvider.broadcastCustomTypesUpdated).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the user cancels confirmation', async () => {
    mockVscode.window.showWarningMessage.mockResolvedValueOnce(undefined);
    const cb = registered.get('labnotev.deleteCustomType');
    await cb!(typeItem('MyType'));
    expect(updateSpy).not.toHaveBeenCalled();
    expect(sectionEditorProvider.broadcastCustomTypesUpdated).not.toHaveBeenCalled();
  });
});
