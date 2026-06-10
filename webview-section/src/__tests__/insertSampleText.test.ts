import { insertSampleText } from '../lib/insertSampleText';

describe('insertSampleText', () => {
  it('appends at the end when cursorPos is undefined', () => {
    const r = insertSampleText('Hello', undefined, 'X');
    expect(r.content).toBe('HelloX');
    expect(r.caret).toBe(6);
  });

  it('inserts at the caret and returns the offset right after the text', () => {
    const r = insertSampleText('abcdef', 3, 'XY');
    expect(r.content).toBe('abcXYdef');
    expect(r.caret).toBe(5);
  });

  it('collapses an existing same-type @type; prefix before the caret', () => {
    // User typed "@dna;" then picked a sample from the TreeView which sends a
    // full "@dna;DNA-1;alias" definition. The existing prefix must be removed.
    const r = insertSampleText('@dna;', 5, '@dna;DNA-1;alias');
    expect(r.content).toBe('@dna;DNA-1;alias');
    expect(r.caret).toBe('@dna;DNA-1;alias'.length);
  });

  it('matches the prefix case-insensitively', () => {
    const r = insertSampleText('@DNA;', 5, '@dna;DNA-1;alias');
    expect(r.content).toBe('@dna;DNA-1;alias');
    expect(r.caret).toBe('@dna;DNA-1;alias'.length);
  });

  it('does not collapse a different-type prefix', () => {
    const r = insertSampleText('@rna;', 5, '@dna;DNA-1;alias');
    expect(r.content).toBe('@rna;@dna;DNA-1;alias');
    expect(r.caret).toBe('@rna;@dna;DNA-1;alias'.length);
  });

  it('only collapses the prefix immediately before the caret, preserving the tail', () => {
    const r = insertSampleText('pre @dna; tail', 9, '@dna;DNA-2;x');
    // caret at index 9 sits right after "pre @dna;" -> collapse "@dna;"
    expect(r.content).toBe('pre @dna;DNA-2;x tail');
    expect(r.caret).toBe('pre @dna;DNA-2;x'.length);
  });

  it('clamps a cursorPos beyond the content length', () => {
    const r = insertSampleText('ab', 99, 'Z');
    expect(r.content).toBe('abZ');
    expect(r.caret).toBe(3);
  });
});
