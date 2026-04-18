import { buildSampleIdPattern } from '../lib/sampleUtils';
import { findSampleDefinitionMatch } from '../lib/sampleStorage';

describe('buildSampleIdPattern', () => {
  it('matches plain {TYPE}-{timestamp} ids', () => {
    const re = buildSampleIdPattern('DNA');
    expect('DNA-1737123456789'.match(re)?.[0]).toBe('DNA-1737123456789');
  });

  it('matches collision-resolved ids like DNA-1737123456789-3', () => {
    const re = buildSampleIdPattern('DNA');
    expect('DNA-1737123456789-3'.match(re)?.[0]).toBe('DNA-1737123456789-3');
  });

  it('matches multi-counter ids like DNA-1-2-3 (segment is (?:-\\d+)*)', () => {
    const re = buildSampleIdPattern('DNA');
    expect('DNA-1-2-3'.match(re)?.[0]).toBe('DNA-1-2-3');
  });

  it('escapes regex metacharacters in the type name', () => {
    const re = buildSampleIdPattern('My.Type');
    // The dot must be literal, so "MyXType-1" should NOT match.
    expect('MyXType-1'.match(re)).toBeNull();
    expect('My.Type-1'.match(re)?.[0]).toBe('My.Type-1');
  });

  it('is anchored to word boundaries so "FooDNA-1" is not swallowed', () => {
    const re = buildSampleIdPattern('DNA');
    expect('FooDNA-1'.match(re)).toBeNull();
    expect('Foo DNA-1'.match(re)?.[0]).toBe('DNA-1');
  });

  it('returns a fresh regex instance each call (safe to use g flag)', () => {
    const a = buildSampleIdPattern('DNA');
    const b = buildSampleIdPattern('DNA');
    expect(a).not.toBe(b);
    expect(a.flags).toContain('g');
  });
});

describe('regex segment unification (storage vs highlight vs infopanel)', () => {
  it('findSampleDefinitionMatch accepts collision-resolved ids', () => {
    const text = '@dna;DNA-1700000000000-3;sampleA;desc';
    const match = findSampleDefinitionMatch(text, 'DNA', 'DNA-1700000000000-3');
    expect(match).not.toBeNull();
    expect(match?.start).toBe(0);
  });
});
