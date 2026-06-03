import { describe, it, expect } from 'vitest';
import { replaceWholeSampleId } from '../../lib/sampleUtils';

describe('replaceWholeSampleId', () => {
  it('renames an exact id occurrence', () => {
    expect(replaceWholeSampleId('use DNA-170 here', 'DNA-170', 'DNA-999')).toBe(
      'use DNA-999 here'
    );
  });

  it('renames every occurrence', () => {
    expect(
      replaceWholeSampleId('DNA-170 and DNA-170', 'DNA-170', 'DNA-999')
    ).toBe('DNA-999 and DNA-999');
  });

  it('does NOT rename a multipart id that merely extends the base id', () => {
    // Renaming base `DNA-170` must leave the distinct `DNA-170-3` untouched.
    expect(
      replaceWholeSampleId('DNA-170 vs DNA-170-3', 'DNA-170', 'DNA-999')
    ).toBe('DNA-999 vs DNA-170-3');
  });

  it('does NOT rename a longer-digit id that shares the base prefix', () => {
    expect(
      replaceWholeSampleId('DNA-170 vs DNA-1700', 'DNA-170', 'DNA-999')
    ).toBe('DNA-999 vs DNA-1700');
  });

  it('renames a multipart id exactly without touching its base', () => {
    expect(
      replaceWholeSampleId('DNA-170 and DNA-170-3', 'DNA-170-3', 'DNA-170-9')
    ).toBe('DNA-170 and DNA-170-9');
  });

  it('escapes regex metacharacters in the id', () => {
    expect(replaceWholeSampleId('a.b-1 token', 'a.b-1', 'x')).toBe('x token');
    // The dot must be literal, so it should not match `axb-1`.
    expect(replaceWholeSampleId('axb-1 token', 'a.b-1', 'x')).toBe('axb-1 token');
  });
});
