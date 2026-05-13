import { insertAttachmentLinkAt } from '../lib/insertAttachmentLink';

describe('insertAttachmentLinkAt', () => {
  const LINK = '[file.pdf](resources/attachments/file.pdf)';

  it('inserts into empty content and returns newPos at link length', () => {
    const result = insertAttachmentLinkAt('', 0, LINK);
    expect(result.text).toBe(LINK);
    expect(result.newPos).toBe(LINK.length);
  });

  it('splits and merges content at pos = 5', () => {
    const content = 'hello world';
    const result = insertAttachmentLinkAt(content, 5, LINK);
    expect(result.text).toBe('hello' + LINK + ' world');
    expect(result.newPos).toBe(5 + LINK.length);
  });

  it('clamps pos > content.length to content.length', () => {
    const content = 'abc';
    const result = insertAttachmentLinkAt(content, 99, LINK);
    expect(result.text).toBe('abc' + LINK);
    expect(result.newPos).toBe(3 + LINK.length);
  });

  it('clamps pos < 0 to 0', () => {
    const content = 'abc';
    const result = insertAttachmentLinkAt(content, -5, LINK);
    expect(result.text).toBe(LINK + 'abc');
    expect(result.newPos).toBe(LINK.length);
  });

  it('inserts inline in the middle of a multiline content', () => {
    const content = 'line1\nline2\nline3';
    // pos points to the middle of line2 (after 'li' of line2)
    const pos = 'line1\n'.length + 2;
    const result = insertAttachmentLinkAt(content, pos, LINK);
    expect(result.text).toBe('line1\nli' + LINK + 'ne2\nline3');
    expect(result.newPos).toBe(pos + LINK.length);
  });
});
