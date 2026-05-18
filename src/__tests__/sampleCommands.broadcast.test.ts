import { mockVscode } from './setup';
import { SampleTreeItemType } from '../views/SampleTreeViewProvider';

/**
 * Verifies that every TreeView mutating command broadcasts a fresh
 * `sampleDefsUpdated` payload to all live Section Editor webviews after
 * the underlying state change lands. Without this, edits made from the
 * TreeView leak through to disk but stay invisible to any open webview
 * that wasn't the active one at the time of the change.
 */
describe('sample TreeView commands → broadcastSampleDefsUpdated()', () => {
  let registered: Map<string, (...args: any[]) => any>;
  let sampleTreeProvider: any;
  let sectionEditorProvider: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    registered = new Map();
    mockVscode.commands.registerCommand.mockImplementation((id: string, cb: (...args: any[]) => any) => {
      registered.set(id, cb);
      return { dispose: vi.fn() };
    });

    sampleTreeProvider = {
      refresh: vi.fn(),
      deleteSample: vi.fn().mockResolvedValue(undefined),
      moveSampleToGlobal: vi.fn().mockResolvedValue(undefined),
      moveSampleToLocal: vi.fn().mockResolvedValue(undefined),
      editSample: vi.fn().mockResolvedValue(undefined),
      updateSample: vi.fn(),
      getSampleSources: vi.fn(() => undefined),
    };
    sectionEditorProvider = {
      broadcastSampleDefsUpdated: vi.fn(),
      getActiveDocument: vi.fn(() => undefined),
    };

    const { registerSampleCommands } = await import('../commands/sampleCommands');
    registerSampleCommands({ subscriptions: [] } as any, {
      sampleTreeProvider,
      sectionEditorProvider,
    });
  });

  it('labnotev.deleteSample broadcasts after user confirms', async () => {
    // The command compares against `vscode.l10n.t('Delete')`, which the
    // mock l10n returns verbatim ('Delete') in English-source mode.
    // setup.ts's signature is `Promise<undefined>` so we cast to bypass the
    // narrowed type and feed a real button label back to the awaiter.
    (mockVscode.window.showWarningMessage as any).mockResolvedValueOnce('Delete');
    const cb = registered.get('labnotev.deleteSample');
    expect(cb).toBeDefined();
    await cb!({
      itemType: SampleTreeItemType.Sample,
      sampleType: 'Reagent',
      sampleId: 'R001',
      scope: 'local',
    });
    expect(sampleTreeProvider.deleteSample).toHaveBeenCalledTimes(1);
    expect(sectionEditorProvider.broadcastSampleDefsUpdated).toHaveBeenCalledTimes(1);
  });

  it('labnotev.deleteSample does NOT broadcast when user cancels', async () => {
    mockVscode.window.showWarningMessage.mockResolvedValueOnce(undefined);
    const cb = registered.get('labnotev.deleteSample');
    await cb!({
      itemType: SampleTreeItemType.Sample,
      sampleType: 'Reagent',
      sampleId: 'R001',
      scope: 'local',
    });
    expect(sampleTreeProvider.deleteSample).not.toHaveBeenCalled();
    expect(sectionEditorProvider.broadcastSampleDefsUpdated).not.toHaveBeenCalled();
  });

  it('labnotev.moveSampleToGlobal broadcasts after move', async () => {
    const cb = registered.get('labnotev.moveSampleToGlobal');
    expect(cb).toBeDefined();
    await cb!({ sampleType: 'Reagent', sampleId: 'R001' });
    expect(sampleTreeProvider.moveSampleToGlobal).toHaveBeenCalledTimes(1);
    expect(sectionEditorProvider.broadcastSampleDefsUpdated).toHaveBeenCalledTimes(1);
  });

  it('labnotev.moveSampleToLocal broadcasts after move', async () => {
    const cb = registered.get('labnotev.moveSampleToLocal');
    expect(cb).toBeDefined();
    await cb!({ sampleType: 'Reagent', sampleId: 'R001' });
    expect(sampleTreeProvider.moveSampleToLocal).toHaveBeenCalledTimes(1);
    expect(sectionEditorProvider.broadcastSampleDefsUpdated).toHaveBeenCalledTimes(1);
  });

  it('labnotev.editSample broadcasts even when the definition is not found anywhere', async () => {
    // Simulate "no active webview, no active plain editor, no sources, no
    // workspace match" — the JSON update should still surface to webviews.
    mockVscode.window.activeTextEditor = undefined;
    mockVscode.workspace.findFiles = vi.fn().mockResolvedValue([]);
    // User-entered new alias / description.
    mockVscode.window.showInputBox = vi
      .fn()
      .mockResolvedValueOnce('newAlias')
      .mockResolvedValueOnce('newDesc');

    const cb = registered.get('labnotev.editSample');
    expect(cb).toBeDefined();
    await cb!({
      itemType: SampleTreeItemType.Sample,
      sampleType: 'Reagent',
      sampleId: 'R001',
      alias: 'oldAlias',
      sampleDescription: 'oldDesc',
      scope: 'local',
    });
    expect(sectionEditorProvider.broadcastSampleDefsUpdated).toHaveBeenCalledTimes(1);
  });
});
