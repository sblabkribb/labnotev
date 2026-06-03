import { buildSampleDefSuffix } from '../../lib/sampleUtils';

describe('buildSampleDefSuffix', () => {
  it('returns empty string when neither alias nor description is present', () => {
    expect(buildSampleDefSuffix('', '')).toBe('');
    expect(buildSampleDefSuffix(null, null)).toBe('');
    expect(buildSampleDefSuffix(undefined, undefined)).toBe('');
  });

  it('returns ;alias when only alias is present', () => {
    expect(buildSampleDefSuffix('샘플A', '')).toBe(';샘플A');
  });

  it('keeps an empty alias slot when only description is present', () => {
    // The bug: a plain `;${description}` would slide the description into the
    // alias field. The alias slot must be preserved as empty.
    expect(buildSampleDefSuffix('', '설명만')).toBe(';;설명만');
    expect(buildSampleDefSuffix(null, '설명만')).toBe(';;설명만');
  });

  it('returns ;alias;description when both are present', () => {
    expect(buildSampleDefSuffix('샘플A', '설명')).toBe(';샘플A;설명');
  });

  it('treats whitespace-only values as absent', () => {
    expect(buildSampleDefSuffix('   ', 'd')).toBe(';;d');
    expect(buildSampleDefSuffix('a', '   ')).toBe(';a');
  });
});
