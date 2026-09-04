/**
 * Tests for `removeSourcesForDocument` — the reverse direction of
 * `saveSamplesFromDocument`. When a markdown document is saved with one of
 * its `@type;id;...` definitions deleted, this helper drops the document's
 * basename from the relevant `sources` arrays and, if no other document
 * still references the sample, deletes the record entirely.
 *
 * The cases below exercise the safety guards too:
 *   - records that started with empty sources (Add Sample flow) are never
 *     touched (so a freshly tree-created sample doesn't vanish on the next
 *     save of an unrelated file),
 *   - sources are compared by basename (matching what saveSamplesFromDocument
 *     writes),
 *   - if the local and global folders resolve to the same directory,
 *     processing happens only once so the user doesn't see two toasts.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { NodeFileSystem } from '@labnotev/core/node';
import { removeSourcesForDocument, SampleRecord } from '../lib/sampleStorage';

const nodeFs = new NodeFileSystem();

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lnv-remove-sources-'));
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

describe('removeSourcesForDocument', () => {
  it('keeps the record when the document still defines the token', async () => {
    const docPath = path.join(tmpRoot, 'a.labnote.md');
    const localFolder = path.join(tmpRoot, 'resources', 'labsamples');
    writeRecords(localFolder, 'DNA', {
      'DNA-001': makeRecord({ sources: ['a.labnote.md'] }),
    });

    const removed = await removeSourcesForDocument(
      nodeFs,
      docPath,
      '@DNA;DNA-001;alias;desc',
      undefined,
      []
    );

    expect(removed).toEqual([]);
    const samples = readRecords(localFolder, 'DNA');
    expect(samples['DNA-001']).toBeDefined();
    expect(samples['DNA-001'].sources).toEqual(['a.labnote.md']);
  });

  it("drops only this document's basename from sources when other documents still define the token", async () => {
    const docPath = path.join(tmpRoot, 'a.labnote.md');
    const localFolder = path.join(tmpRoot, 'resources', 'labsamples');
    writeRecords(localFolder, 'DNA', {
      'DNA-001': makeRecord({ sources: ['a.labnote.md', 'b.labnote.md'] }),
    });

    // The document no longer mentions DNA-001 — but b.labnote.md is still
    // listed in sources, so the record itself must stay.
    const removed = await removeSourcesForDocument(
      nodeFs,
      docPath,
      'unrelated body without any sample token',
      undefined,
      []
    );

    expect(removed).toEqual([]);
    const samples = readRecords(localFolder, 'DNA');
    expect(samples['DNA-001']).toBeDefined();
    expect(samples['DNA-001'].sources).toEqual(['b.labnote.md']);
  });

  it('deletes the record when the current document was the only source', async () => {
    const docPath = path.join(tmpRoot, 'a.labnote.md');
    const localFolder = path.join(tmpRoot, 'resources', 'labsamples');
    writeRecords(localFolder, 'DNA', {
      'DNA-001': makeRecord({ sources: ['a.labnote.md'] }),
      'DNA-002': makeRecord({ sources: ['a.labnote.md'] }),
    });

    const removed = await removeSourcesForDocument(
      nodeFs,
      docPath,
      // Only DNA-002 remains in the document.
      '@DNA;DNA-002;alias',
      undefined,
      []
    );

    expect(removed).toEqual([
      { scope: 'local', type: 'DNA', id: 'DNA-001' },
    ]);
    const samples = readRecords(localFolder, 'DNA');
    expect(samples['DNA-001']).toBeUndefined();
    expect(samples['DNA-002']).toBeDefined();
  });

  it('protects records whose sources started empty (Add Sample flow)', async () => {
    const docPath = path.join(tmpRoot, 'a.labnote.md');
    const localFolder = path.join(tmpRoot, 'resources', 'labsamples');
    writeRecords(localFolder, 'DNA', {
      // Created via tree's Add Sample — never written into any document yet.
      'DNA-tree': makeRecord({ alias: 'Manual', sources: [] }),
    });

    const removed = await removeSourcesForDocument(
      nodeFs,
      docPath,
      'document with no DNA tokens',
      undefined,
      []
    );

    expect(removed).toEqual([]);
    const samples = readRecords(localFolder, 'DNA');
    expect(samples['DNA-tree']).toBeDefined();
    expect(samples['DNA-tree'].sources).toEqual([]);
  });

  it('processes both local and global folders when they differ', async () => {
    const docPath = path.join(tmpRoot, 'exp', 'a.labnote.md');
    const localFolder = path.join(tmpRoot, 'exp', 'resources', 'labsamples');
    const globalFolder = path.join(tmpRoot, 'resources', 'labsamples');

    writeRecords(localFolder, 'DNA', {
      'DNA-local': makeRecord({ sources: ['a.labnote.md'] }),
    });
    writeRecords(globalFolder, 'RNA', {
      'RNA-global': makeRecord({ type: 'RNA', sources: ['a.labnote.md'] }),
    });

    const removed = await removeSourcesForDocument(
      nodeFs,
      docPath,
      'body without tokens',
      globalFolder,
      []
    );

    // Both scopes drop their respective records — order is local before global
    // (matches the helper's scope iteration).
    expect(removed).toEqual([
      { scope: 'local', type: 'DNA', id: 'DNA-local' },
      { scope: 'global', type: 'RNA', id: 'RNA-global' },
    ]);
    expect(readRecords(localFolder, 'DNA')['DNA-local']).toBeUndefined();
    expect(readRecords(globalFolder, 'RNA')['RNA-global']).toBeUndefined();
  });

  it('does not double-process when local and global folders resolve to the same path', async () => {
    // workspaceRoot is the experiment folder → local labsamples == global
    // labsamples. The helper must visit the folder exactly once.
    const docPath = path.join(tmpRoot, 'note.labnote.md');
    const sharedFolder = path.join(tmpRoot, 'resources', 'labsamples');
    writeRecords(sharedFolder, 'DNA', {
      'DNA-001': makeRecord({ sources: ['note.labnote.md'] }),
    });

    const removed = await removeSourcesForDocument(
      nodeFs,
      docPath,
      'no tokens here',
      sharedFolder,
      []
    );

    // Exactly one entry; never reported twice.
    expect(removed).toEqual([
      { scope: 'local', type: 'DNA', id: 'DNA-001' },
    ]);
  });

  it('includes custom (additional) sample types in the reconciliation', async () => {
    const docPath = path.join(tmpRoot, 'a.labnote.md');
    const localFolder = path.join(tmpRoot, 'resources', 'labsamples');
    writeRecords(localFolder, 'CustomType', {
      'CustomType-001': makeRecord({ type: 'CustomType', sources: ['a.labnote.md'] }),
    });

    const removed = await removeSourcesForDocument(
      nodeFs,
      docPath,
      'body without any tokens',
      undefined,
      ['CustomType']
    );

    expect(removed).toEqual([
      { scope: 'local', type: 'CustomType', id: 'CustomType-001' },
    ]);
    expect(readRecords(localFolder, 'CustomType')['CustomType-001']).toBeUndefined();
  });

  it('is a no-op when neither folder exists', async () => {
    // No fixtures written — exercises the existsSync guard.
    const docPath = path.join(tmpRoot, 'a.labnote.md');
    const removed = await removeSourcesForDocument(
      nodeFs,
      docPath,
      '',
      path.join(tmpRoot, 'nope'),
      []
    );
    expect(removed).toEqual([]);
  });
});
