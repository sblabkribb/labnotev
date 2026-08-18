import { extractMarkdownTables, tableToCsv } from '../../lib/exportTablesCsv';

describe('extractMarkdownTables', () => {
  it('extracts a single GFM pipe table with header + data rows', () => {
    const md = `#### Output

| contrast | total | up | down |
|---|---|---|---|
| 1h_vs_0h | 1436 | 530 | 906 |
| 2h_vs_1h | 958 | 534 | 424 |

Some text after.
`;
    const tables = extractMarkdownTables(md);

    expect(tables).toHaveLength(1);
    expect(tables[0].rows).toEqual([
      ['contrast', 'total', 'up', 'down'],
      ['1h_vs_0h', '1436', '530', '906'],
      ['2h_vs_1h', '958', '534', '424'],
    ]);
  });

  it('extracts multiple tables in document order and assigns increasing indices', () => {
    const md = `| a | b |
|---|---|
| 1 | 2 |

Some prose.

| x | y | z |
|---|---|---|
| 3 | 4 | 5 |
`;
    const tables = extractMarkdownTables(md);
    expect(tables).toHaveLength(2);
    expect(tables[0].index).toBe(0);
    expect(tables[1].index).toBe(1);
    expect(tables[1].rows[0]).toEqual(['x', 'y', 'z']);
  });

  it('returns an empty array when there is no table', () => {
    expect(extractMarkdownTables('# Title\n\nJust prose, no pipes.\n')).toEqual([]);
  });

  it('does not misdetect a Related Workflows checklist as a table', () => {
    const md = `## Related Workflows

[ ] [001 WD010 Design](./001_WD010_Design.labnote.md)
[x] [002 WB010 Build](./002_WB010_Build.labnote.md)
`;
    expect(extractMarkdownTables(md)).toEqual([]);
  });

  it('handles a table with an alignment row (:---:)', () => {
    const md = `| Name | Score |
|:---:|---:|
| A | 1 |
`;
    const tables = extractMarkdownTables(md);
    expect(tables).toHaveLength(1);
    expect(tables[0].rows[0]).toEqual(['Name', 'Score']);
  });

  it('respects an escaped pipe inside a cell', () => {
    const md = `| Label | Value |
|---|---|
| a\\|b | 1 |
`;
    const tables = extractMarkdownTables(md);
    expect(tables[0].rows[1]).toEqual(['a|b', '1']);
  });
});

describe('tableToCsv', () => {
  it('joins rows with commas and a trailing newline', () => {
    const csv = tableToCsv([
      ['contrast', 'total'],
      ['1h_vs_0h', '1436'],
    ]);
    expect(csv).toBe('contrast,total\n1h_vs_0h,1436\n');
  });

  it('quotes cells containing commas, quotes, or newlines', () => {
    const csv = tableToCsv([
      ['a,b', 'say "hi"', 'line1\nline2'],
    ]);
    expect(csv).toBe('"a,b","say ""hi""","line1\nline2"\n');
  });
});
