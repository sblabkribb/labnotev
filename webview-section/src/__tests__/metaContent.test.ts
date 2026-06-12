import { parseMetaContent, serializeMetaContent } from '../components/UnitOpAccordion';

describe('parseMetaContent', () => {
  it('parses the existing known field lines unchanged', () => {
    const content = [
      '- Experimenter: 홍길동',
      "- Start_date: '2026-01-15 10:30'",
      "- End_date: ''",
      '- Software:',
    ].join('\n');
    expect(parseMetaContent(content)).toEqual({
      Experimenter: '홍길동',
      Start_date: '2026-01-15 10:30',
      End_date: '',
      Software: '',
    });
  });

  it('parses a custom field (Duration)', () => {
    expect(parseMetaContent("- Duration: '2h'")).toEqual({ Duration: '2h' });
  });

  it('keeps colons that appear inside the value', () => {
    expect(parseMetaContent("- Start_date: '2026-01-15 10:30'")).toEqual({
      Start_date: '2026-01-15 10:30',
    });
  });

  it('does not drop a line whose value contains a single quote', () => {
    // Old regex captured up to the first quote and dropped the whole line.
    expect(parseMetaContent("- Note: 'it''s here'")).toEqual({ Note: "it''s here" });
  });

  it('supports non-ASCII (Korean) field names', () => {
    expect(parseMetaContent("- 소요시간: '90분'")).toEqual({ 소요시간: '90분' });
  });

  it('ignores lines that are not "- key: value" entries', () => {
    expect(parseMetaContent('not a field\n- Duration: 30m')).toEqual({ Duration: '30m' });
  });
});

describe('serializeMetaContent', () => {
  it('round-trips a value that contains a single quote', () => {
    const fields = { X: "a'b" };
    expect(parseMetaContent(serializeMetaContent(fields))).toEqual(fields);
  });

  it('round-trips custom and known fields together preserving order', () => {
    const fields = {
      Experimenter: '홍길동',
      Start_date: '2026-01-15',
      Duration: '2h',
    };
    const serialized = serializeMetaContent(fields);
    expect(serialized).toBe(
      "- Experimenter: '홍길동'\n- Start_date: '2026-01-15'\n- Duration: '2h'",
    );
    expect(parseMetaContent(serialized)).toEqual(fields);
  });
});
