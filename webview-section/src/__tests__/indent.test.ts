import { applyIndent } from '../utils/indent';

// Issue #18-2: Tab and Shift+Tab in the Section editor should indent/outdent
// the current line(s) by 2 spaces, instead of the textarea's default behaviour
// (moving focus to the next focusable element).

describe('applyIndent (issue #18-2)', () => {
  describe('mode: indent', () => {
    it('inserts 2 spaces at the cursor when there is no selection', () => {
      const text = 'hello';
      const result = applyIndent(text, 2, 2, 'indent');
      expect(result.text).toBe('he  llo');
      expect(result.selStart).toBe(4);
      expect(result.selEnd).toBe(4);
    });

    it('indents every line covered by a multi-line selection', () => {
      const text = 'one\ntwo\nthree';
      // Select from start of "one" through middle of "three".
      const result = applyIndent(text, 0, text.length, 'indent');
      expect(result.text).toBe('  one\n  two\n  three');
      // Selection should expand to include the inserted spaces on the first
      // line and stretch through the new end of the last touched line.
      expect(result.selStart).toBe(0);
      expect(result.selEnd).toBe(text.length + 6);
    });

    it('treats a partial single-line selection as insert-at-cursor (no line indent)', () => {
      const text = 'abcdef';
      const result = applyIndent(text, 1, 3, 'indent');
      // Replaces selection with 2 spaces (consistent with browser Tab default
      // when text is selected on a single line).
      expect(result.text).toBe('a  def');
      expect(result.selStart).toBe(3);
      expect(result.selEnd).toBe(3);
    });
  });

  describe('mode: outdent', () => {
    it('removes up to 2 leading spaces from the current line', () => {
      const text = '    hello';
      const result = applyIndent(text, 6, 6, 'outdent');
      expect(result.text).toBe('  hello');
      expect(result.selStart).toBe(4);
      expect(result.selEnd).toBe(4);
    });

    it('is a no-op when the current line has no leading spaces', () => {
      const text = 'hello';
      const result = applyIndent(text, 2, 2, 'outdent');
      expect(result.text).toBe('hello');
      expect(result.selStart).toBe(2);
      expect(result.selEnd).toBe(2);
    });

    it('outdents every line covered by a multi-line selection', () => {
      const text = '  one\n    two\nthree';
      const result = applyIndent(text, 0, text.length, 'outdent');
      // line1: 2 spaces removed, line2: 2 of 4 spaces removed, line3: no change
      expect(result.text).toBe('one\n  two\nthree');
      expect(result.selStart).toBe(0);
      expect(result.selEnd).toBe(text.length - 4);
    });

    it('removes a single leading space when only one is present', () => {
      const text = ' hello';
      const result = applyIndent(text, 3, 3, 'outdent');
      expect(result.text).toBe('hello');
      expect(result.selStart).toBe(2);
      expect(result.selEnd).toBe(2);
    });
  });
});
