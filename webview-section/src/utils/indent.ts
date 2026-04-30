/**
 * Tab indent / Shift+Tab outdent helper for the Section editor textarea.
 *
 * Issue #18-2: when the cursor is *outside* a markdown table the textarea
 * used to fall back to the browser default for Tab — moving focus to the
 * next focusable element. This helper computes the new content + selection
 * range for the indent / outdent action so the keydown handler can apply
 * it via React state.
 *
 * Indent unit is 2 spaces (markdown list standard).
 */
export const INDENT_UNIT = '  ';

export type IndentMode = 'indent' | 'outdent';

export interface IndentResult {
  text: string;
  selStart: number;
  selEnd: number;
}

function lineStart(text: string, pos: number): number {
  const before = text.lastIndexOf('\n', pos - 1);
  return before === -1 ? 0 : before + 1;
}

function lineEnd(text: string, pos: number): number {
  const next = text.indexOf('\n', pos);
  return next === -1 ? text.length : next;
}

function isMultiLineSelection(text: string, selStart: number, selEnd: number): boolean {
  if (selStart === selEnd) return false;
  return text.slice(selStart, selEnd).includes('\n');
}

function indentLines(text: string, selStart: number, selEnd: number): IndentResult {
  const blockStart = lineStart(text, selStart);
  // For the *end* of a multi-line selection we use the line containing
  // selEnd-1 so a selection ending exactly at a newline does not pull in
  // the following empty line. When selStart === selEnd this branch is not
  // used.
  const effectiveEnd = selEnd > selStart ? selEnd - 1 : selEnd;
  const blockEnd = lineEnd(text, effectiveEnd);

  const before = text.slice(0, blockStart);
  const block = text.slice(blockStart, blockEnd);
  const after = text.slice(blockEnd);

  const lines = block.split('\n');
  const indented = lines.map(line => INDENT_UNIT + line).join('\n');
  const added = lines.length * INDENT_UNIT.length;

  return {
    text: before + indented + after,
    selStart: blockStart,
    selEnd: selEnd + added,
  };
}

function outdentLines(text: string, selStart: number, selEnd: number): IndentResult {
  const blockStart = lineStart(text, selStart);
  const effectiveEnd = selEnd > selStart ? selEnd - 1 : selEnd;
  const blockEnd = lineEnd(text, effectiveEnd);

  const before = text.slice(0, blockStart);
  const block = text.slice(blockStart, blockEnd);
  const after = text.slice(blockEnd);

  let removedTotal = 0;
  let removedFromFirstLine = 0;
  const lines = block.split('\n');
  const outdented = lines.map((line, idx) => {
    let removed = 0;
    if (line.startsWith(INDENT_UNIT)) {
      removed = INDENT_UNIT.length;
    } else if (line.startsWith(' ')) {
      removed = 1;
    }
    removedTotal += removed;
    if (idx === 0) removedFromFirstLine = removed;
    return line.slice(removed);
  });

  const newSelStart = Math.max(blockStart, selStart - removedFromFirstLine);
  const newSelEnd = Math.max(newSelStart, selEnd - removedTotal);

  return {
    text: before + outdented.join('\n') + after,
    selStart: newSelStart,
    selEnd: newSelEnd,
  };
}

/**
 * Compute the indent / outdent transform for a textarea selection.
 *
 * Behaviour:
 * - Indent + caret only (selStart === selEnd): insert 2 spaces at the caret.
 * - Indent + single-line range selection: replace selection with 2 spaces
 *   (mirrors the browser textarea Tab default for non-block selections).
 * - Indent + multi-line range selection: prepend 2 spaces to every line that
 *   intersects the selection.
 * - Outdent: remove up to 2 leading spaces from every line that intersects
 *   the selection (or the caret line when there is no selection). When fewer
 *   than 2 leading spaces exist, only the available spaces are removed.
 */
export function applyIndent(
  text: string,
  selStart: number,
  selEnd: number,
  mode: IndentMode
): IndentResult {
  if (mode === 'indent') {
    if (selStart === selEnd) {
      const before = text.slice(0, selStart);
      const after = text.slice(selStart);
      const newPos = selStart + INDENT_UNIT.length;
      return {
        text: before + INDENT_UNIT + after,
        selStart: newPos,
        selEnd: newPos,
      };
    }

    if (!isMultiLineSelection(text, selStart, selEnd)) {
      const before = text.slice(0, selStart);
      const after = text.slice(selEnd);
      const newPos = selStart + INDENT_UNIT.length;
      return {
        text: before + INDENT_UNIT + after,
        selStart: newPos,
        selEnd: newPos,
      };
    }

    return indentLines(text, selStart, selEnd);
  }

  return outdentLines(text, selStart, selEnd);
}
