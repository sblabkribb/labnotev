import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { buildInDocDirAttachmentMarkdownLink } from '../lib/attachmentMarkdownLink';

describe('buildInDocDirAttachmentMarkdownLink', () => {
  const docDir = path.join('/workspace', 'labnote', '001_Exp');

  it('returns relative markdown link for file under images/ without copy', () => {
    const selected = path.join(docDir, 'images', 'a.png');
    expect(buildInDocDirAttachmentMarkdownLink(docDir, selected)).toBe('[a.png](images/a.png)');
  });

  it('returns relative link for file under resources/labsamples', () => {
    const selected = path.join(docDir, 'resources', 'labsamples', 'dna', 'rec.json');
    const rel = path.relative(docDir, selected).split(path.sep).join('/');
    expect(buildInDocDirAttachmentMarkdownLink(docDir, selected)).toBe(`[rec.json](${rel})`);
  });

  it('returns null when file is outside docDir', () => {
    const outside = path.join('/workspace', 'other', 'x.pdf');
    expect(buildInDocDirAttachmentMarkdownLink(docDir, outside)).toBeNull();
  });

  it('returns link for file directly in docDir', () => {
    const selected = path.join(docDir, 'note.txt');
    expect(buildInDocDirAttachmentMarkdownLink(docDir, selected)).toBe('[note.txt](note.txt)');
  });
});
