/**
 * Tests for findSampleDefinitionOnlyMatch — a stricter variant of
 * findSampleDefinitionMatch that requires an `@type;` (or `@type:`) prefix.
 *
 * Motivation: the legacy `findSampleDefinitionMatch` would also match a bare
 * ID reference (e.g. `DNA-123`), which caused "Move to Definition" to jump to
 * the first body reference instead of the actual definition. The strict
 * matcher ensures we only land on `@type;ID;...`-style definitions.
 */
import { findSampleDefinitionOnlyMatch } from '../lib/sampleStorage';

describe('findSampleDefinitionOnlyMatch', () => {
  it('matches @type;ID prefix definitions', () => {
    const text = 'some intro\n@dna;DNA-123;MyAlias;Description here\ntrailing';
    const result = findSampleDefinitionOnlyMatch(text, 'DNA', 'DNA-123');
    expect(result).not.toBeNull();
    expect(result!.start).toBe(text.indexOf('@dna;DNA-123'));
    expect(text.slice(result!.start, result!.start + result!.length)).toMatch(/^@dna;DNA-123/);
  });

  it('matches @type:ID prefix definitions (legacy colon delimiter)', () => {
    const text = 'before\n@dna:DNA-123;alias\nafter';
    const result = findSampleDefinitionOnlyMatch(text, 'DNA', 'DNA-123');
    expect(result).not.toBeNull();
    expect(text.slice(result!.start, result!.start + result!.length)).toMatch(/^@dna:DNA-123/);
  });

  it('does NOT match a bare ID reference without @type prefix', () => {
    const text = 'reference only: DNA-123;alias\nsome text';
    const result = findSampleDefinitionOnlyMatch(text, 'DNA', 'DNA-123');
    expect(result).toBeNull();
  });

  it('does NOT match when ID differs', () => {
    const text = '@dna;DNA-999;OtherAlias';
    const result = findSampleDefinitionOnlyMatch(text, 'DNA', 'DNA-123');
    expect(result).toBeNull();
  });

  it('prefers the actual definition even when a bare reference appears earlier', () => {
    const text = 'DNA-123 is mentioned first.\nLater: @dna;DNA-123;MyAlias\nend';
    const result = findSampleDefinitionOnlyMatch(text, 'DNA', 'DNA-123');
    expect(result).not.toBeNull();
    expect(text.slice(result!.start, result!.start + result!.length)).toMatch(/^@dna;DNA-123/);
  });

  it('matches Equip alias-only definition (@equip;;Alias)', () => {
    const text = '@equip;;MyMachine;Description';
    const result = findSampleDefinitionOnlyMatch(text, 'Equip', '', 'MyMachine');
    expect(result).not.toBeNull();
    expect(text.slice(result!.start, result!.start + result!.length)).toMatch(/^@equip;;MyMachine/);
  });

  it('returns null for Equip when alias is missing in text', () => {
    const text = '@equip;;OtherMachine';
    const result = findSampleDefinitionOnlyMatch(text, 'Equip', '', 'MyMachine');
    expect(result).toBeNull();
  });

  it('handles multiple definitions and matches the first by ID', () => {
    const text = '@dna;DNA-001;A\n@dna;DNA-002;B\n@dna;DNA-003;C';
    const result = findSampleDefinitionOnlyMatch(text, 'DNA', 'DNA-002');
    expect(result).not.toBeNull();
    expect(text.slice(result!.start, result!.start + result!.length)).toMatch(/^@dna;DNA-002/);
  });
});
