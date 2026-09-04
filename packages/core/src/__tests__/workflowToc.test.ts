import { describe, it, expect } from 'vitest';
import {
  buildUnitOpTocLine,
  appendUnitOpToWorkflowToc,
} from '../sections/workflowSectionParser';
import { createWorkflowContent } from '../lib/workflowStructure';

describe('buildUnitOpTocLine', () => {
  it('matches the serializeWorkflowMd slug/label format', () => {
    expect(buildUnitOpTocLine('UHW010', 'Centrifugation')).toBe(
      '- [UHW010 Centrifugation](#uhw010-centrifugation)'
    );
  });

  it('includes the alias in label and slug', () => {
    expect(buildUnitOpTocLine('USW010', 'Read Mapping', 'BWA')).toBe(
      '- [USW010 Read Mapping | BWA](#usw010-read-mapping-bwa)'
    );
  });

  it('strips punctuation from the slug', () => {
    expect(buildUnitOpTocLine('UHW020', 'PCR (95C)')).toBe(
      '- [UHW020 PCR (95C)](#uhw020-pcr-95c)'
    );
  });
});

describe('appendUnitOpToWorkflowToc', () => {
  const fresh = createWorkflowContent(
    { id: 'WD010', name: 'Design', description: 'desc' },
    'Dr. Kim'
  );

  it('inserts an entry into the fresh template section, preserving hints and other sections', () => {
    const out = appendUnitOpToWorkflowToc(fresh, 'UHW010', 'Centrifugation');
    expect(out).toContain('- [UHW010 Centrifugation](#uhw010-centrifugation)');
    // Hints preserved.
    expect(out).toContain('> Unit operations are appended here automatically.');
    // Other sections untouched.
    expect(out).toContain('## Conclusions and Discussion');
    // Entry sits inside the Related Unit Operations section (before Conclusions).
    expect(out.indexOf('#uhw010-centrifugation')).toBeLessThan(
      out.indexOf('## Conclusions and Discussion')
    );
  });

  it('accumulates multiple entries (grouped, in order)', () => {
    let out = appendUnitOpToWorkflowToc(fresh, 'UHW010', 'Spin');
    out = appendUnitOpToWorkflowToc(out, 'USW020', 'Align', 'BWA');
    const first = out.indexOf('- [UHW010 Spin]');
    const second = out.indexOf('- [USW020 Align | BWA]');
    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);
  });

  it('appends after existing serialize-style entries', () => {
    const md = [
      '## Related Unit Operations',
      '',
      '- [UHW010 A](#uhw010-a)',
      '',
      '---',
      '',
      '### [UHW010 A]',
      '',
    ].join('\n');
    const out = appendUnitOpToWorkflowToc(md, 'USW020', 'B');
    const lines = out.split('\n');
    // New entry directly after the last existing entry, before the blank+---.
    expect(lines[2]).toBe('- [UHW010 A](#uhw010-a)');
    expect(lines[3]).toBe('- [USW020 B](#usw020-b)');
    expect(lines[4]).toBe('');
    expect(lines[5]).toBe('---');
  });

  it('returns the document unchanged when the section is absent', () => {
    const md = '# Just a note\n\nNo TOC here.\n';
    expect(appendUnitOpToWorkflowToc(md, 'UHW010', 'X')).toBe(md);
  });

  it('preserves CRLF line endings', () => {
    const md = '## Related Unit Operations\r\n\r\n## Conclusions and Discussion\r\n';
    const out = appendUnitOpToWorkflowToc(md, 'UHW010', 'X');
    expect(out).toContain('\r\n');
    expect(out).toContain('- [UHW010 X](#uhw010-x)');
  });
});
