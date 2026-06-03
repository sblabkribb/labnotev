import * as path from 'path';
import { resolveContainedPath } from '../../lib/isPathInsideDir';

/**
 * `resolveContainedPath` is the shared guard used by the Section Editor's
 * file-touching message handlers (openWorkflow / openImagePreview /
 * changedWorkflows write). It resolves a webview-supplied relative path against
 * the document folder and returns the absolute path only when it stays inside
 * that folder; otherwise null. This prevents path-traversal writes/opens from
 * crafted message payloads.
 */
describe('resolveContainedPath', () => {
  const baseDir = path.resolve('/workspace/exp01');

  it('resolves a plain relative path inside the base dir', () => {
    expect(resolveContainedPath(baseDir, 'images/img_1.png')).toBe(
      path.resolve(baseDir, 'images/img_1.png')
    );
  });

  it('resolves a sibling file name inside the base dir', () => {
    expect(resolveContainedPath(baseDir, '001_WD010_design.labnote.md')).toBe(
      path.resolve(baseDir, '001_WD010_design.labnote.md')
    );
  });

  it('rejects a parent-traversal path', () => {
    expect(resolveContainedPath(baseDir, '../secret.md')).toBeNull();
    expect(resolveContainedPath(baseDir, '../../etc/passwd')).toBeNull();
  });

  it('rejects an absolute path outside the base dir', () => {
    expect(resolveContainedPath(baseDir, path.resolve('/etc/passwd'))).toBeNull();
  });

  it('rejects empty or non-string input', () => {
    expect(resolveContainedPath(baseDir, '')).toBeNull();
    expect(resolveContainedPath(baseDir, undefined as unknown as string)).toBeNull();
  });
});
