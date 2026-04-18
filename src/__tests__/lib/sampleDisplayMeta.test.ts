import {
  SAMPLE_TYPES,
  sampleTypeColors,
  CUSTOM_SAMPLE_TYPE_FALLBACK_COLOR,
  getSampleDisplayMeta,
} from '../../lib/sampleUtils';

describe('getSampleDisplayMeta (Phase D-4)', () => {
  it('returns built-in types and colors with no custom input', () => {
    const meta = getSampleDisplayMeta();
    expect(meta.types).toEqual([...SAMPLE_TYPES]);
    for (const t of SAMPLE_TYPES) {
      expect(meta.colors[t]).toBe(sampleTypeColors[t]);
    }
  });

  it('appends custom types after built-ins without duplication', () => {
    const meta = getSampleDisplayMeta(['DNA', 'Buffer', 'Cell']);
    expect(meta.types.filter(t => t === 'DNA').length).toBe(1);
    expect(meta.types).toContain('Buffer');
    expect(meta.types).toContain('Cell');
    expect(meta.types.indexOf('Buffer')).toBeGreaterThan(meta.types.indexOf('DNA'));
  });

  it('assigns fallback color to custom types that have no predefined color', () => {
    const meta = getSampleDisplayMeta(['Buffer']);
    expect(meta.colors['Buffer']).toBe(CUSTOM_SAMPLE_TYPE_FALLBACK_COLOR);
  });

  it('keeps built-in colors intact when they collide with custom names', () => {
    const meta = getSampleDisplayMeta(['DNA']);
    expect(meta.colors['DNA']).toBe(sampleTypeColors.DNA);
  });

  it('ignores empty-string custom entries', () => {
    const meta = getSampleDisplayMeta(['', 'Buffer', '']);
    expect(meta.types.filter(t => t === '').length).toBe(0);
    expect(meta.types).toContain('Buffer');
  });

  it('guarantees every returned type has a color key', () => {
    const meta = getSampleDisplayMeta(['Buffer', 'Cell', 'Media']);
    for (const t of meta.types) {
      expect(typeof meta.colors[t]).toBe('string');
      expect(meta.colors[t].length).toBeGreaterThan(0);
    }
  });
});
