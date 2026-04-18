import {
  getSeoulDateString,
  getSeoulDateTimeString,
  updateDateFieldInLine,
  updateAllDatesInLine,
  findDateFieldsInDocument,
  updateAllDateFields,
} from '../../lib/dateUtils';

describe('dateUtils', () => {
  describe('getSeoulDateString', () => {
    it('should return date in YYYY-MM-DD format', () => {
      const date = new Date('2025-01-17T10:00:00Z');
      const result = getSeoulDateString(date);
      expect(/^\d{4}-\d{2}-\d{2}$/.test(result)).toBe(true);
    });

    it('should use current date when no argument provided', () => {
      const result = getSeoulDateString();
      expect(/^\d{4}-\d{2}-\d{2}$/.test(result)).toBe(true);
    });
  });

  describe('getSeoulDateTimeString', () => {
    it('should return date and time in YYYY-MM-DD HH:mm format', () => {
      const date = new Date('2025-01-17T10:00:00Z');
      const result = getSeoulDateTimeString(date);
      expect(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(result)).toBe(true);
    });

    it('should return correct format with hours and minutes', () => {
      const date = new Date('2025-01-17T14:30:00Z');
      const result = getSeoulDateTimeString(date);
      const parts = result.split(' ');
      expect(parts.length).toBe(2);
      expect(/^\d{4}-\d{2}-\d{2}$/.test(parts[0])).toBe(true);
      expect(/^\d{2}:\d{2}$/.test(parts[1])).toBe(true);
    });

    it('should use current date when no argument provided', () => {
      const result = getSeoulDateTimeString();
      expect(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(result)).toBe(true);
    });
  });

  describe('updateDateFieldInLine', () => {
    it('should update last_updated_date field', () => {
      const line = "    last_updated_date: '2025-01-15'";
      const newDate = '2025-01-17';
      const result = updateDateFieldInLine(line, 'last_updated_date', newDate);
      expect(result).toContain("last_updated_date: '2025-01-17'");
    });

    it('should update created_date field', () => {
      const line = "created_date: '2025-01-10'";
      const newDate = '2025-01-17';
      const result = updateDateFieldInLine(line, 'created_date', newDate);
      expect(result).toContain("created_date: '2025-01-17'");
    });

    it('should update end_date field', () => {
      const line = "end_date: ''";
      const newDate = '2025-01-17';
      const result = updateDateFieldInLine(line, 'end_date', newDate);
      expect(result).toContain("end_date: '2025-01-17'");
    });

    it('should handle date with double quotes', () => {
      const line = '    last_updated_date: "2025-01-15"';
      const newDate = '2025-01-17';
      const result = updateDateFieldInLine(line, 'last_updated_date', newDate);
      expect(result).toContain("last_updated_date: '2025-01-17'");
    });

    it('should handle date without quotes', () => {
      const line = '    last_updated_date: 2025-01-15';
      const newDate = '2025-01-17';
      const result = updateDateFieldInLine(line, 'last_updated_date', newDate);
      expect(result).toContain("last_updated_date: '2025-01-17'");
    });

    it('should preserve indentation', () => {
      const line = "    last_updated_date: '2025-01-15'";
      const newDate = '2025-01-17';
      const result = updateDateFieldInLine(line, 'last_updated_date', newDate);
      expect(result.substring(0, 4)).toBe('    ');
    });

    it('should not modify line if field not found', () => {
      const line = "    title: 'Some Title'";
      const newDate = '2025-01-17';
      const result = updateDateFieldInLine(line, 'last_updated_date', newDate);
      expect(result).toBe(line);
    });

    it('should update date field with DateTime format (YYYY-MM-DD HH:mm)', () => {
      const line = "    last_updated_date: '2025-01-15'";
      const newDateTime = '2025-01-17 14:30';
      const result = updateDateFieldInLine(line, 'last_updated_date', newDateTime);
      expect(result).toContain("last_updated_date: '2025-01-17 14:30'");
    });

    it('should update existing DateTime field to new DateTime', () => {
      const line = "    last_updated_date: '2025-01-15 10:00'";
      const newDateTime = '2025-01-17 14:30';
      const result = updateDateFieldInLine(line, 'last_updated_date', newDateTime);
      expect(result).toContain("last_updated_date: '2025-01-17 14:30'");
    });

    it('should update date field to DateTime format', () => {
      const line = "    created_date: '2025-01-10'";
      const newDateTime = '2025-01-17 09:15';
      const result = updateDateFieldInLine(line, 'created_date', newDateTime);
      expect(result).toContain("created_date: '2025-01-17 09:15'");
    });
  });

  describe('updateAllDatesInLine', () => {
    it('should update date without field name (single quotes)', () => {
      const line = "    Some text with '2025-01-15' date";
      const newDateTime = '2025-01-17 14:30';
      const result = updateAllDatesInLine(line, newDateTime);
      expect(result).toContain("'2025-01-17 14:30'");
      expect(result).not.toContain("'2025-01-15'");
    });

    it('should update date without field name (double quotes)', () => {
      const line = '    Some text with "2025-01-15" date';
      const newDateTime = '2025-01-17 14:30';
      const result = updateAllDatesInLine(line, newDateTime);
      expect(result).toContain("'2025-01-17 14:30'");
      expect(result).not.toContain('"2025-01-15"');
    });

    it('should update date without quotes', () => {
      const line = '    Some text with 2025-01-15 date';
      const newDateTime = '2025-01-17 14:30';
      const result = updateAllDatesInLine(line, newDateTime);
      expect(result).toContain("'2025-01-17 14:30'");
      expect(result).not.toContain('2025-01-15');
    });

    it('should update datetime format to new datetime', () => {
      const line = "    Some text with '2025-01-15 10:00' datetime";
      const newDateTime = '2025-01-17 14:30';
      const result = updateAllDatesInLine(line, newDateTime);
      expect(result).toContain("'2025-01-17 14:30'");
      expect(result).not.toContain("'2025-01-15 10:00'");
    });

    it('should update multiple dates in one line', () => {
      const line = "    Start: '2025-01-15', End: '2025-01-20'";
      const newDateTime = '2025-01-17 14:30';
      const result = updateAllDatesInLine(line, newDateTime);
      const matches = result.match(/'2025-01-17 14:30'/g);
      expect(matches?.length).toBe(2);
      expect(result).not.toContain("'2025-01-15'");
      expect(result).not.toContain("'2025-01-20'");
    });

    it('should not modify line if no date pattern found', () => {
      const line = '    Some text without any date';
      const newDateTime = '2025-01-17 14:30';
      const result = updateAllDatesInLine(line, newDateTime);
      expect(result).toBe(line);
    });

    it('should preserve indentation', () => {
      const line = "    '2025-01-15'";
      const newDateTime = '2025-01-17 14:30';
      const result = updateAllDatesInLine(line, newDateTime);
      expect(result.substring(0, 4)).toBe('    ');
    });

    it('should update date with dot separator (YYYY.MM.DD)', () => {
      const line = '    -   2024.10.15. 16:00';
      const newDateTime = '2025-01-17 14:30';
      const result = updateAllDatesInLine(line, newDateTime);
      expect(result).toContain("'2025-01-17 14:30'");
      expect(result).not.toContain('2024.10.15');
    });
  });

  describe('findDateFieldsInDocument', () => {
    it('should find all date fields in YAML front matter', () => {
      const content = `---
title: Test
created_date: '2025-01-10'
last_updated_date: '2025-01-15'
end_date: ''
---`;
      const fields = findDateFieldsInDocument(content);
      // end_date matches both 'end_date' and 'End_date' patterns (case-insensitive)
      expect(fields.length).toBeGreaterThanOrEqual(3);
      expect(fields.some(f => f.field.toLowerCase() === 'created_date')).toBe(true);
      expect(fields.some(f => f.field.toLowerCase() === 'last_updated_date')).toBe(true);
      expect(fields.some(f => f.field.toLowerCase() === 'end_date')).toBe(true);
    });

    it('should return line numbers correctly', () => {
      const content = `---
title: Test
created_date: '2025-01-10'
last_updated_date: '2025-01-15'
---`;
      const fields = findDateFieldsInDocument(content);
      const lastUpdated = fields.find(f => f.field === 'last_updated_date');
      expect(lastUpdated).toBeDefined();
      expect(lastUpdated!.line).toBe(3);
    });

    it('should handle empty document', () => {
      const content = '';
      const fields = findDateFieldsInDocument(content);
      expect(fields.length).toBe(0);
    });

    it('should find Start_date and End_date in unit operations', () => {
      const content = `#### Meta
- Experimenter: John
- Start_date: '2025-01-10 10:00'
- End_date: ''`;
      const fields = findDateFieldsInDocument(content);
      expect(fields.some(f => f.field === 'Start_date')).toBe(true);
      expect(fields.some(f => f.field === 'End_date')).toBe(true);
    });
  });

  describe('updateAllDateFields', () => {
    it('should update all last_updated_date fields', () => {
      const content = `---
title: Test
created_date: '2025-01-10'
last_updated_date: '2025-01-15'
end_date: ''
---
Some content
---
title: Another
last_updated_date: '2025-01-12'
---`;
      const newDate = '2025-01-17';
      const result = updateAllDateFields(content, 'last_updated_date', newDate);
      expect((result.match(/last_updated_date: '2025-01-17'/g) || []).length).toBe(2);
      expect(result).not.toContain("last_updated_date: '2025-01-15'");
      expect(result).not.toContain("last_updated_date: '2025-01-12'");
    });

    it('should preserve other fields', () => {
      const content = `---
title: Test
created_date: '2025-01-10'
last_updated_date: '2025-01-15'
---`;
      const newDate = '2025-01-17';
      const result = updateAllDateFields(content, 'last_updated_date', newDate);
      expect(result).toContain('title: Test');
      expect(result).toContain("created_date: '2025-01-10'");
    });

    it('should handle document with no matching fields', () => {
      const content = `---
title: Test
created_date: '2025-01-10'
---`;
      const newDate = '2025-01-17';
      const result = updateAllDateFields(content, 'last_updated_date', newDate);
      expect(result).toBe(content);
    });
  });
});
