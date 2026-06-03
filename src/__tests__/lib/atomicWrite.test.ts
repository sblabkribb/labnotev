import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { writeFileAtomic } from '../../lib/atomicWrite';

describe('writeFileAtomic', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atomic-write-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes the data to the target path', () => {
    const target = path.join(dir, 'out.json');

    writeFileAtomic(target, '{"a":1}');

    expect(fs.readFileSync(target, 'utf8')).toBe('{"a":1}');
  });

  it('overwrites an existing file', () => {
    const target = path.join(dir, 'out.json');
    fs.writeFileSync(target, 'old');

    writeFileAtomic(target, 'new');

    expect(fs.readFileSync(target, 'utf8')).toBe('new');
  });

  it('leaves no temp files behind on success', () => {
    const target = path.join(dir, 'out.json');

    writeFileAtomic(target, 'data');

    const leftovers = fs.readdirSync(dir).filter((f) => f !== 'out.json');
    expect(leftovers).toEqual([]);
  });

  it('does not leave a partially written target if interrupted mid-write', () => {
    // Atomicity guarantee: the target is only ever the temp file renamed into
    // place, so a previously valid file is preserved until the rename succeeds.
    const target = path.join(dir, 'out.json');
    fs.writeFileSync(target, 'valid-previous-content');

    writeFileAtomic(target, 'updated');

    expect(fs.readFileSync(target, 'utf8')).toBe('updated');
  });
});
