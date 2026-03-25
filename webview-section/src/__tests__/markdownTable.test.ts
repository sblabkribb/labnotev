import {
  displayWidth,
  generateTableTemplate,
  tsvToMarkdownTable,
  looksLikeTsv,
  findTableBounds,
  isInsideTable,
  alignTableColumns,
  getNextCellPosition,
  getPrevCellPosition,
  addTableRow,
} from '../utils/markdownTable';

// ---------------------------------------------------------------------------
// displayWidth
// ---------------------------------------------------------------------------

describe('displayWidth', () => {
  it('returns length for ASCII', () => {
    expect(displayWidth('hello')).toBe(5);
  });

  it('counts CJK characters as width 2', () => {
    expect(displayWidth('한글')).toBe(4);
    expect(displayWidth('漢字')).toBe(4);
  });

  it('handles mixed ASCII and CJK', () => {
    expect(displayWidth('hi한')).toBe(4); // 2 + 2
  });
});

// ---------------------------------------------------------------------------
// generateTableTemplate
// ---------------------------------------------------------------------------

describe('generateTableTemplate', () => {
  it('creates a table with correct dimensions', () => {
    const result = generateTableTemplate(2, 3);
    const lines = result.trimEnd().split('\n');
    expect(lines).toHaveLength(4); // header + sep + 2 rows
    expect(lines[0]).toContain('Column 1');
    expect(lines[0]).toContain('Column 3');
    expect(lines[1]).toMatch(/^\|[\s-|]+\|$/);
  });

  it('generates single column table', () => {
    const result = generateTableTemplate(1, 1);
    const lines = result.trimEnd().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('| Column 1 |');
  });
});

// ---------------------------------------------------------------------------
// TSV conversion
// ---------------------------------------------------------------------------

describe('looksLikeTsv', () => {
  it('returns true for tab-separated text', () => {
    expect(looksLikeTsv('a\tb\nc\td')).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(looksLikeTsv('hello world')).toBe(false);
  });

  it('returns true for single row with tabs', () => {
    expect(looksLikeTsv('a\tb')).toBe(true);
  });
});

describe('tsvToMarkdownTable', () => {
  it('converts simple TSV to markdown table', () => {
    const tsv = 'Name\tAge\nAlice\t30\nBob\t25';
    const result = tsvToMarkdownTable(tsv);
    expect(result).not.toBeNull();
    const lines = result!.trimEnd().split('\n');
    expect(lines).toHaveLength(4); // header + sep + 2 data rows
    expect(lines[0]).toContain('Name');
    expect(lines[0]).toContain('Age');
    expect(lines[1]).toMatch(/^[|\s-]+$/);
    expect(lines[2]).toContain('Alice');
  });

  it('handles uneven columns by padding', () => {
    const tsv = 'a\tb\tc\nd\te';
    const result = tsvToMarkdownTable(tsv);
    expect(result).not.toBeNull();
    const lines = result!.trimEnd().split('\n');
    // Header has 3 cols, second row padded to 3
    expect(lines[0].split('|').length).toBe(lines[2].split('|').length);
  });

  it('handles CJK content with proper padding', () => {
    const tsv = '이름\t나이\n홍길동\t30';
    const result = tsvToMarkdownTable(tsv);
    expect(result).not.toBeNull();
    expect(result).toContain('홍길동');
  });

  it('returns null for empty string', () => {
    expect(tsvToMarkdownTable('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Table detection
// ---------------------------------------------------------------------------

describe('findTableBounds', () => {
  const table = [
    'Some text before',
    '| A | B |',
    '|---|---|',
    '| 1 | 2 |',
    '| 3 | 4 |',
    'Some text after',
  ].join('\n');

  it('finds table when cursor is inside', () => {
    const pos = table.indexOf('| 1');
    const bounds = findTableBounds(table, pos);
    expect(bounds).not.toBeNull();
    expect(bounds!.lines).toHaveLength(4);
    expect(bounds!.lines[0]).toBe('| A | B |');
  });

  it('returns null when cursor is outside table', () => {
    expect(findTableBounds(table, 0)).toBeNull();
  });
});

describe('isInsideTable', () => {
  it('returns true inside a table', () => {
    const text = '| a | b |\n|---|---|\n| 1 | 2 |';
    expect(isInsideTable(text, 5)).toBe(true);
  });

  it('returns false outside a table', () => {
    const text = 'hello\n| a | b |';
    expect(isInsideTable(text, 2)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Column alignment
// ---------------------------------------------------------------------------

describe('alignTableColumns', () => {
  it('aligns columns to equal width', () => {
    const text = '| Short | VeryLongColumn |\n|---|---|\n| a | b |';
    const result = alignTableColumns(text, 5);
    expect(result).not.toBeNull();
    const lines = result!.text.trimEnd().split('\n');
    // All lines should have same total pipe count
    const pipeCounts = lines.map(l => (l.match(/\|/g) || []).length);
    expect(new Set(pipeCounts).size).toBe(1);
  });

  it('preserves content while aligning', () => {
    const text = '| Name | Age |\n|---|---|\n| Alice | 30 |';
    const result = alignTableColumns(text, 5);
    expect(result).not.toBeNull();
    expect(result!.text).toContain('Alice');
    expect(result!.text).toContain('30');
  });

  it('returns null when cursor is not in a table', () => {
    expect(alignTableColumns('plain text', 3)).toBeNull();
  });

  it('handles CJK characters in alignment', () => {
    const text = '| 이름 | Age |\n|---|---|\n| 홍길동 | 30 |';
    const result = alignTableColumns(text, 5);
    expect(result).not.toBeNull();
    expect(result!.text).toContain('홍길동');
  });
});

// ---------------------------------------------------------------------------
// Cell navigation
// ---------------------------------------------------------------------------

describe('getNextCellPosition', () => {
  const table = '| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |';

  it('moves to next cell in same row', () => {
    // Cursor after "| A" (position 3 = inside first cell)
    const pos = table.indexOf('A');
    const result = getNextCellPosition(table, pos);
    expect(result).not.toBeNull();
    expect(result!.pos).toBeGreaterThan(pos);
  });

  it('moves to next row when at last cell', () => {
    // Cursor at "C" in the header
    const pos = table.indexOf('C');
    const result = getNextCellPosition(table, pos);
    expect(result).not.toBeNull();
    // Should skip separator and land in data row
    expect(result!.pos).toBeGreaterThan(table.indexOf('|---|'));
  });

  it('adds new row when at last cell of last row', () => {
    const pos = table.indexOf('3');
    const result = getNextCellPosition(table, pos);
    expect(result).not.toBeNull();
    expect(result!.newText).toBeDefined();
    expect(result!.newText!.split('\n').length).toBe(table.split('\n').length + 1);
  });
});

describe('getPrevCellPosition', () => {
  const table = '| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |';

  it('moves to previous cell in same row', () => {
    const pos = table.indexOf('B');
    const result = getPrevCellPosition(table, pos);
    expect(result).not.toBeNull();
    expect(result!).toBeLessThan(pos);
  });

  it('moves to previous row last cell', () => {
    const pos = table.lastIndexOf('1');
    const result = getPrevCellPosition(table, pos);
    expect(result).not.toBeNull();
    // Should go to last cell of header (skip separator)
    expect(result!).toBeLessThan(table.indexOf('\n'));
  });
});

// ---------------------------------------------------------------------------
// Add row
// ---------------------------------------------------------------------------

describe('addTableRow', () => {
  it('adds a new row at the end of table', () => {
    const text = '| A | B |\n|---|---|\n| 1 | 2 |';
    const result = addTableRow(text, 5);
    expect(result).not.toBeNull();
    const lines = result!.text.split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[3]).toMatch(/^\|.*\|$/);
  });

  it('preserves column count in new row', () => {
    const text = '| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |';
    const result = addTableRow(text, 5);
    expect(result).not.toBeNull();
    const newRow = result!.text.split('\n').pop()!;
    const pipes = (newRow.match(/\|/g) || []).length;
    expect(pipes).toBe(4); // 3 columns = 4 pipes
  });

  it('returns null when not in a table', () => {
    expect(addTableRow('plain text', 3)).toBeNull();
  });
});
