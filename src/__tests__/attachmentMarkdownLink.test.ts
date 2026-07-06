import * as path from 'path';
import {
  buildInDocDirAttachmentMarkdownLink,
  encodeAttachmentHref,
  decodeAttachmentHref,
  isImageFile,
  formatAttachmentMarkdown,
} from '../lib/attachmentMarkdownLink';

describe('buildInDocDirAttachmentMarkdownLink', () => {
  const docDir = path.join('/workspace', 'labnote', '001_Exp');

  it('returns image markdown (![]) for an image file under images/ without copy', () => {
    const selected = path.join(docDir, 'images', 'a.png');
    expect(buildInDocDirAttachmentMarkdownLink(docDir, selected)).toBe('![a.png](images/a.png)');
  });

  it('returns plain link for file under resources/labsamples', () => {
    const selected = path.join(docDir, 'resources', 'labsamples', 'dna', 'rec.json');
    const rel = path.relative(docDir, selected).split(path.sep).join('/');
    expect(buildInDocDirAttachmentMarkdownLink(docDir, selected)).toBe(`[rec.json](${rel})`);
  });

  it('returns null when file is outside docDir', () => {
    const outside = path.join('/workspace', 'other', 'x.pdf');
    expect(buildInDocDirAttachmentMarkdownLink(docDir, outside)).toBeNull();
  });

  it('returns plain link for file directly in docDir', () => {
    const selected = path.join(docDir, 'note.txt');
    expect(buildInDocDirAttachmentMarkdownLink(docDir, selected)).toBe('[note.txt](note.txt)');
  });

  it('percent-encodes spaces in the href while keeping the label readable', () => {
    const selected = path.join(docDir, 'my file.pdf');
    expect(buildInDocDirAttachmentMarkdownLink(docDir, selected)).toBe('[my file.pdf](my%20file.pdf)');
  });

  it('percent-encodes spaces and parentheses in an image href', () => {
    const selected = path.join(docDir, 'images', 'fig (1).png');
    expect(buildInDocDirAttachmentMarkdownLink(docDir, selected)).toBe(
      '![fig (1).png](images/fig%20%281%29.png)'
    );
  });
});

describe('encodeAttachmentHref / decodeAttachmentHref', () => {
  it('encodes space, ( and ) only, leaving separators and unicode intact', () => {
    expect(encodeAttachmentHref('resources/attachments/my file (1).pdf')).toBe(
      'resources/attachments/my%20file%20%281%29.pdf'
    );
    expect(encodeAttachmentHref('images/한글 파일.png')).toBe('images/한글%20파일.png');
  });

  it('round-trips back to the original path', () => {
    const original = 'resources/attachments/report (final) v2.pdf';
    expect(decodeAttachmentHref(encodeAttachmentHref(original))).toBe(original);
  });

  it('decode is a no-op on already-raw paths (backward compatible)', () => {
    expect(decodeAttachmentHref('resources/attachments/plain.pdf')).toBe(
      'resources/attachments/plain.pdf'
    );
    expect(decodeAttachmentHref('images/my file.png')).toBe('images/my file.png');
  });
});

describe('isImageFile', () => {
  it('detects common image extensions case-insensitively', () => {
    expect(isImageFile('a.png')).toBe(true);
    expect(isImageFile('a.JPG')).toBe(true);
    expect(isImageFile('images/b.webp')).toBe(true);
    expect(isImageFile('doc.pdf')).toBe(false);
    expect(isImageFile('rec.json')).toBe(false);
  });
});

describe('formatAttachmentMarkdown', () => {
  it('uses ![] for images and [] for other files, encoding the href', () => {
    expect(formatAttachmentMarkdown('a b.png', 'images/a b.png')).toBe('![a b.png](images/a%20b.png)');
    expect(formatAttachmentMarkdown('a b.pdf', 'resources/attachments/a b.pdf')).toBe(
      '[a b.pdf](resources/attachments/a%20b.pdf)'
    );
  });
});
