/**
 * Utility functions for markdown table editing assistance.
 */

/** Measure display width accounting for CJK characters (2 columns each). */
export function displayWidth(str: string): number {
  let w = 0;
  for (const ch of str) {
    const code = ch.codePointAt(0)!;
    // CJK Unified Ideographs, Hangul Syllables, Fullwidth Forms, etc.
    if (
      (code >= 0x1100 && code <= 0x115f) ||  // Hangul Jamo
      (code >= 0x2e80 && code <= 0x303e) ||  // CJK Radicals, Kangxi, CJK Symbols
      (code >= 0x3040 && code <= 0x9fff) ||  // Hiragana, Katakana, CJK Unified
      (code >= 0xac00 && code <= 0xd7af) ||  // Hangul Syllables
      (code >= 0xf900 && code <= 0xfaff) ||  // CJK Compatibility Ideographs
      (code >= 0xfe30 && code <= 0xfe4f) ||  // CJK Compatibility Forms
      (code >= 0xff01 && code <= 0xff60) ||  // Fullwidth Forms
      (code >= 0xffe0 && code <= 0xffe6) ||  // Fullwidth Signs
      (code >= 0x20000 && code <= 0x2fa1f)   // CJK Extension B+
    ) {
      w += 2;
    } else {
      w += 1;
    }
  }
  return w;
}

/** Pad string to target display width with trailing spaces. */
function padEnd(str: string, targetWidth: number): string {
  const diff = targetWidth - displayWidth(str);
  return diff > 0 ? str + ' '.repeat(diff) : str;
}

// ---------------------------------------------------------------------------
// Template generation
// ---------------------------------------------------------------------------

export function generateTableTemplate(rows: number, cols: number): string {
  const header = '| ' + Array.from({ length: cols }, (_, i) => `Column ${i + 1}`).join(' | ') + ' |';
  const separator = '| ' + Array.from({ length: cols }, () => '---').join(' | ') + ' |';
  const emptyRow = '| ' + Array.from({ length: cols }, () => '   ').join(' | ') + ' |';
  const dataRows = Array.from({ length: rows }, () => emptyRow).join('\n');
  return header + '\n' + separator + '\n' + dataRows + '\n';
}

// ---------------------------------------------------------------------------
// TSV → markdown table
// ---------------------------------------------------------------------------

export function tsvToMarkdownTable(tsv: string): string | null {
  const trimmed = tsv.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();
  if (!trimmed) return null;

  const lines = trimmed.split('\n');
  const rows = lines.map(line => line.split('\t'));
  const colCount = Math.max(...rows.map(r => r.length));
  if (colCount < 1) return null;

  // Normalise each row to same column count
  const normalised = rows.map(r => {
    while (r.length < colCount) r.push('');
    return r.map(cell => cell.trim());
  });

  // Compute column widths
  const widths = Array.from({ length: colCount }, (_, ci) =>
    Math.max(3, ...normalised.map(r => displayWidth(r[ci])))
  );

  const formatRow = (cells: string[]) =>
    '| ' + cells.map((c, i) => padEnd(c, widths[i])).join(' | ') + ' |';

  const headerRow = formatRow(normalised[0]);
  const sepRow = '| ' + widths.map(w => '-'.repeat(w)).join(' | ') + ' |';
  const dataRows = normalised.slice(1).map(formatRow);

  return [headerRow, sepRow, ...dataRows].join('\n') + '\n';
}

/** Quick check: does the text look like tab-separated data? */
export function looksLikeTsv(text: string): boolean {
  const lines = text.trimEnd().split(/\r?\n/);
  return lines.length >= 1 && lines.some(l => l.includes('\t'));
}

// ---------------------------------------------------------------------------
// Table detection & boundaries
// ---------------------------------------------------------------------------

const TABLE_ROW_RE = /^\s*\|/;
const SEPARATOR_RE = /^\s*\|[\s:]*-{3,}/;

function getLineStart(text: string, pos: number): number {
  const idx = text.lastIndexOf('\n', pos - 1);
  return idx === -1 ? 0 : idx + 1;
}

function getLineEnd(text: string, pos: number): number {
  const idx = text.indexOf('\n', pos);
  return idx === -1 ? text.length : idx;
}

function getLine(text: string, pos: number): string {
  return text.slice(getLineStart(text, pos), getLineEnd(text, pos));
}

export interface TableBounds {
  start: number; // char offset where the table starts
  end: number;   // char offset where the table ends (exclusive)
  lines: string[];
}

/** Find the full table block surrounding the cursor position. */
export function findTableBounds(text: string, cursorPos: number): TableBounds | null {
  const currentLine = getLine(text, cursorPos);
  if (!TABLE_ROW_RE.test(currentLine)) return null;

  // Walk backward to find start
  let start = getLineStart(text, cursorPos);
  while (start > 0) {
    const prevLineStart = getLineStart(text, start - 1);
    const prevLine = text.slice(prevLineStart, start - 1);
    if (!TABLE_ROW_RE.test(prevLine)) break;
    start = prevLineStart;
  }

  // Walk forward to find end
  let end = getLineEnd(text, cursorPos);
  while (end < text.length) {
    const nextChar = end + 1; // skip \n
    if (nextChar >= text.length) break;
    const nextLineEnd = getLineEnd(text, nextChar);
    const nextLine = text.slice(nextChar, nextLineEnd);
    if (!TABLE_ROW_RE.test(nextLine)) break;
    end = nextLineEnd;
  }

  const tableText = text.slice(start, end);
  return { start, end, lines: tableText.split('\n') };
}

export function isInsideTable(text: string, cursorPos: number): boolean {
  return findTableBounds(text, cursorPos) !== null;
}

// ---------------------------------------------------------------------------
// Column alignment
// ---------------------------------------------------------------------------

function isSeparatorRow(line: string): boolean {
  return SEPARATOR_RE.test(line);
}

function parseCells(line: string): string[] {
  const trimmed = line.trim();
  const inner = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
  const withoutTrailing = inner.endsWith('|') ? inner.slice(0, -1) : inner;
  return withoutTrailing.split('|').map(c => c.trim());
}

export function alignTableColumns(text: string, cursorPos: number): { text: string; newCursorPos: number } | null {
  const bounds = findTableBounds(text, cursorPos);
  if (!bounds) return null;

  const { start, end, lines } = bounds;

  // Parse all rows
  const parsed = lines.map(line => ({
    isSep: isSeparatorRow(line),
    cells: parseCells(line),
  }));

  const colCount = Math.max(...parsed.map(r => r.cells.length));
  if (colCount < 1) return null;

  // Normalise column count
  parsed.forEach(r => {
    while (r.cells.length < colCount) r.cells.push('');
  });

  // Compute max widths (skip separator rows for width computation)
  const widths = Array.from({ length: colCount }, (_, ci) =>
    Math.max(3, ...parsed.filter(r => !r.isSep).map(r => displayWidth(r.cells[ci])))
  );

  // Format
  const formatted = parsed.map(row => {
    if (row.isSep) {
      return '| ' + widths.map(w => '-'.repeat(w)).join(' | ') + ' |';
    }
    return '| ' + row.cells.map((c, i) => padEnd(c, widths[i])).join(' | ') + ' |';
  });

  const newTable = formatted.join('\n');
  const newText = text.slice(0, start) + newTable + text.slice(end);

  // Approximate new cursor: keep relative offset within the table
  const relOffset = Math.min(cursorPos - start, newTable.length);
  return { text: newText, newCursorPos: start + relOffset };
}

// ---------------------------------------------------------------------------
// Cell navigation (Tab / Shift+Tab)
// ---------------------------------------------------------------------------

export function getNextCellPosition(text: string, cursorPos: number): { pos: number; newText?: string } | null {
  const bounds = findTableBounds(text, cursorPos);
  if (!bounds) return null;

  const lineStart = getLineStart(text, cursorPos);
  const lineEnd = getLineEnd(text, cursorPos);
  const line = text.slice(lineStart, lineEnd);

  // Find pipes in the current line (skip leading pipe)
  const pipePositions: number[] = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '|') pipePositions.push(lineStart + i);
  }

  // Current cell: find the pipe just before cursor, then the one after
  const localPos = cursorPos - lineStart;
  let nextPipe = -1;
  for (let i = 0; i < pipePositions.length; i++) {
    if (pipePositions[i] - lineStart > localPos) {
      nextPipe = i;
      break;
    }
  }

  // If there's a next pipe and it's not the last pipe on the line, move after it
  if (nextPipe !== -1 && nextPipe < pipePositions.length - 1) {
    const target = pipePositions[nextPipe] + 2; // after "| "
    return { pos: Math.min(target, lineEnd) };
  }

  // Move to the next non-separator line's first cell
  let searchPos = lineEnd + 1;
  while (searchPos < bounds.end) {
    const nextLineEnd = getLineEnd(text, searchPos);
    const nextLine = text.slice(searchPos, nextLineEnd);
    if (TABLE_ROW_RE.test(nextLine) && !isSeparatorRow(nextLine)) {
      // Find first pipe then move after it
      const firstPipe = nextLine.indexOf('|');
      if (firstPipe !== -1) {
        return { pos: searchPos + firstPipe + 2 };
      }
    }
    searchPos = nextLineEnd + 1;
  }

  // At the last row — add a new row
  const result = addTableRow(text, cursorPos);
  if (result) {
    // Position cursor in first cell of new row
    const newRowStart = result.text.indexOf('\n', bounds.end - 1);
    if (newRowStart !== -1) {
      const newLineContent = result.text.slice(newRowStart + 1);
      const firstPipe = newLineContent.indexOf('|');
      if (firstPipe !== -1) {
        return { pos: newRowStart + 1 + firstPipe + 2, newText: result.text };
      }
    }
    return { pos: bounds.end + 1, newText: result.text };
  }

  return null;
}

export function getPrevCellPosition(text: string, cursorPos: number): number | null {
  const bounds = findTableBounds(text, cursorPos);
  if (!bounds) return null;

  const lineStart = getLineStart(text, cursorPos);
  const line = text.slice(lineStart, getLineEnd(text, cursorPos));

  // Find pipes in current line
  const pipePositions: number[] = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '|') pipePositions.push(lineStart + i);
  }

  const localPos = cursorPos - lineStart;

  // Find the pipe that starts the current cell, then go one cell back.
  // The "current cell" starts at the pipe whose position+2 <= cursorPos.
  let currentCellPipe = -1;
  for (let i = pipePositions.length - 1; i >= 0; i--) {
    const pipeLocal = pipePositions[i] - lineStart;
    if (pipeLocal + 2 <= localPos) {
      currentCellPipe = i;
      break;
    }
  }

  // Go to the cell before the current one
  const prevPipe = currentCellPipe - 1;
  if (prevPipe >= 1) {
    return pipePositions[prevPipe] + 2;
  }
  // If prevPipe is the leading pipe (index 0), it's the first cell — go to prev row
  if (prevPipe === 0) {
    return pipePositions[0] + 2;
  }

  // Move to previous non-separator line's last cell
  if (lineStart <= bounds.start) return null;

  let searchPos = lineStart - 2; // go to previous line
  while (searchPos >= bounds.start) {
    const prevLineStart = getLineStart(text, searchPos);
    const prevLine = text.slice(prevLineStart, getLineEnd(text, searchPos));
    if (TABLE_ROW_RE.test(prevLine) && !isSeparatorRow(prevLine)) {
      // Find last cell: second-to-last pipe
      const pipes: number[] = [];
      for (let i = 0; i < prevLine.length; i++) {
        if (prevLine[i] === '|') pipes.push(prevLineStart + i);
      }
      if (pipes.length >= 3) {
        return pipes[pipes.length - 2] + 2;
      }
    }
    if (prevLineStart <= bounds.start) break;
    searchPos = prevLineStart - 2;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Add a new row to the table
// ---------------------------------------------------------------------------

export function addTableRow(text: string, cursorPos: number): { text: string; newRowStart: number } | null {
  const bounds = findTableBounds(text, cursorPos);
  if (!bounds) return null;

  // Determine column count from the last data row
  const lastLine = bounds.lines[bounds.lines.length - 1];
  const cells = parseCells(lastLine);
  const colCount = cells.length;

  const newRow = '| ' + Array.from({ length: colCount }, () => '   ').join(' | ') + ' |';

  // Insert after the table's end
  const insertPos = bounds.end;
  const newText = text.slice(0, insertPos) + '\n' + newRow + text.slice(insertPos);
  return { text: newText, newRowStart: insertPos + 1 };
}
