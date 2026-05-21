/**
 * Tests for the orphan-cleanup half of the `onDidSaveTextDocument` hook
 * registered by `registerUtilityCommands`. When a markdown document is
 * saved with one of its sample definitions removed, the hook must:
 *   1. invoke `removeSourcesForDocument`, mutating the tree's JSON files
 *      so the sample disappears from disk,
 *   2. surface a toast describing what was removed (and *not* spam the
 *      toast when nothing was removed),
 *   3. refresh the tree provider and broadcast a fresh `sampleDefsUpdated`
 *      so any open webview also drops the stale highlight,
 *
 * and the formatting branch in `showOrphanRemovedNotice` must:
 *   - skip the toast on 0 removals,
 *   - list ids verbatim for 1..3 removals so the user can recognise what
 *     vanished,
 *   - collapse to a count for 4+ removals so the message stays readable.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { mockVscode } from './setup';
import { SampleRecord } from '../lib/sampleStorage';

type AnyHandler = (...args: any[]) => any;

let tmpRoot: string;

beforeEach(() => {
  vi.clearAllMocks();
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lnv-orphan-hook-'));
});

afterEach(() => {
  if (tmpRoot && fs.existsSync(tmpRoot)) {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

function writeRecords(folder: string, type: string, records: Record<string, SampleRecord>) {
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, `${type}.json`), JSON.stringify(records, null, 2));
}

function readRecords(folder: string, type: string): Record<string, SampleRecord> {
  const file = path.join(folder, `${type}.json`);
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function makeRecord(overrides: Partial<SampleRecord> = {}): SampleRecord {
  return {
    type: 'DNA',
    alias: null,
    descriptions: [],
    sources: [],
    ...overrides,
  };
}

async function registerHookAndCaptureListener(): Promise<{
  listener: AnyHandler;
  sampleTreeProvider: { refresh: ReturnType<typeof vi.fn> };
  sectionEditorProvider: { broadcastSampleDefsUpdated: ReturnType<typeof vi.fn> };
}> {
  const sampleTreeProvider = {
    refresh: vi.fn(),
    // `registerUtilityCommands` exposes a few other tree commands that touch
    // the provider, but the save hook only needs `refresh`.
  } as unknown as { refresh: ReturnType<typeof vi.fn> };
  const sectionEditorProvider = {
    broadcastSampleDefsUpdated: vi.fn(),
  };

  const { registerUtilityCommands } = await import('../commands/utilityCommands');
  registerUtilityCommands(
    { subscriptions: [] } as any,
    {
      sampleTreeProvider: sampleTreeProvider as any,
      sectionEditorProvider: sectionEditorProvider as any,
    }
  );

  // The save hook is registered last among the workspace event listeners;
  // grab the most recent listener so the test isn't fragile to call order
  // changes among the other workspace.* registrations.
  const calls = mockVscode.workspace.onDidSaveTextDocument.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  const listener = calls[calls.length - 1][0] as AnyHandler;
  return { listener, sampleTreeProvider, sectionEditorProvider };
}

describe('onDidSaveTextDocument → orphan sample cleanup', () => {
  it('removes the orphaned record from disk, refreshes tree, broadcasts, and toasts the id', async () => {
    const localFolder = path.join(tmpRoot, 'resources', 'labsamples');
    writeRecords(localFolder, 'DNA', {
      'DNA-001': makeRecord({ sources: ['note.labnote.md'] }),
    });

    const docPath = path.join(tmpRoot, 'note.labnote.md');
    const { listener, sampleTreeProvider, sectionEditorProvider } =
      await registerHookAndCaptureListener();

    await listener({
      languageId: 'markdown',
      uri: { fsPath: docPath },
      getText: () => '', // no @type;id tokens left in the document
    });

    // Record dropped from disk.
    expect(readRecords(localFolder, 'DNA')['DNA-001']).toBeUndefined();
    // Tree refresh + webview broadcast happened.
    expect(sampleTreeProvider.refresh).toHaveBeenCalledTimes(1);
    expect(sectionEditorProvider.broadcastSampleDefsUpdated).toHaveBeenCalledTimes(1);
    // Toast was raised with the removed id verbatim.
    const infoCalls = mockVscode.window.showInformationMessage.mock.calls;
    expect(infoCalls.length).toBe(1);
    expect(String(infoCalls[0][0])).toContain('DNA-001');
  });

  it('does not toast when nothing was removed, but still refreshes and broadcasts', async () => {
    const docPath = path.join(tmpRoot, 'note.labnote.md');
    const { listener, sampleTreeProvider, sectionEditorProvider } =
      await registerHookAndCaptureListener();

    await listener({
      languageId: 'markdown',
      uri: { fsPath: docPath },
      getText: () => '', // nothing to add, nothing to remove
    });

    expect(mockVscode.window.showInformationMessage).not.toHaveBeenCalled();
    expect(sampleTreeProvider.refresh).toHaveBeenCalledTimes(1);
    expect(sectionEditorProvider.broadcastSampleDefsUpdated).toHaveBeenCalledTimes(1);
  });

  it('ignores non-markdown documents entirely', async () => {
    const docPath = path.join(tmpRoot, 'note.labnote.md');
    const { listener, sampleTreeProvider, sectionEditorProvider } =
      await registerHookAndCaptureListener();

    await listener({
      languageId: 'json',
      uri: { fsPath: docPath },
      getText: () => '',
    });

    expect(mockVscode.window.showInformationMessage).not.toHaveBeenCalled();
    expect(sampleTreeProvider.refresh).not.toHaveBeenCalled();
    expect(sectionEditorProvider.broadcastSampleDefsUpdated).not.toHaveBeenCalled();
  });
});

describe('showOrphanRemovedNotice formatting', () => {
  it('skips the toast when nothing was removed', async () => {
    const { showOrphanRemovedNotice } = await import('../commands/utilityCommands');
    showOrphanRemovedNotice([]);
    expect(mockVscode.window.showInformationMessage).not.toHaveBeenCalled();
  });

  it('lists ids verbatim for small removals (1..3)', async () => {
    const { showOrphanRemovedNotice } = await import('../commands/utilityCommands');
    showOrphanRemovedNotice([
      { scope: 'local', type: 'DNA', id: 'DNA-001' },
      { scope: 'local', type: 'RNA', id: 'RNA-002' },
    ]);
    const calls = mockVscode.window.showInformationMessage.mock.calls;
    expect(calls.length).toBe(1);
    const msg = String(calls[0][0]);
    expect(msg).toContain('DNA-001');
    expect(msg).toContain('RNA-002');
  });

  it('collapses to a count when 4 or more samples were removed', async () => {
    const { showOrphanRemovedNotice } = await import('../commands/utilityCommands');
    showOrphanRemovedNotice([
      { scope: 'local', type: 'DNA', id: 'DNA-1' },
      { scope: 'local', type: 'DNA', id: 'DNA-2' },
      { scope: 'local', type: 'DNA', id: 'DNA-3' },
      { scope: 'local', type: 'DNA', id: 'DNA-4' },
      { scope: 'local', type: 'DNA', id: 'DNA-5' },
    ]);
    const calls = mockVscode.window.showInformationMessage.mock.calls;
    expect(calls.length).toBe(1);
    const msg = String(calls[0][0]);
    expect(msg).toContain('5');
    // Individual ids must not leak into the summary form.
    expect(msg).not.toContain('DNA-1');
    expect(msg).not.toContain('DNA-2');
  });
});
