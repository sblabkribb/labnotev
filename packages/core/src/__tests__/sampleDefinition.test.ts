// Globals convention (no `import ... from 'vitest'`): the repo's local runner
// (Node 24 + vitest 4) fails to attach when a core test imports vitest directly,
// so we rely on `globals: true` + tsconfig `types: ["vitest/globals"]`.
import {
  buildSampleDefinitionText,
  sampleSuggestActionFlags,
} from '../lib/sampleUtils';
import { parseSampleTrigger } from '../sample/sampleSuggest';

const TYPES = ['DNA', 'RNA', 'Plasmid', 'Reagent', 'Primer', 'Protein', 'Equip', 'Labware'];

describe('buildSampleDefinitionText', () => {
  it('lowercases the type prefix and keeps the id verbatim', () => {
    expect(buildSampleDefinitionText('DNA', 'DNA-123')).toBe('@dna;DNA-123');
  });

  it('appends alias only when a description is absent', () => {
    expect(buildSampleDefinitionText('DNA', 'DNA-123', '별칭')).toBe('@dna;DNA-123;별칭');
  });

  it('emits an empty alias slot when only a description is given', () => {
    expect(buildSampleDefinitionText('RNA', 'RNA-9', '', '설명')).toBe('@rna;RNA-9;;설명');
  });

  it('emits alias and description together', () => {
    expect(buildSampleDefinitionText('Plasmid', 'Plasmid-1', 'pX', 'vector')).toBe(
      '@plasmid;Plasmid-1;pX;vector'
    );
  });
});

describe('sampleSuggestActionFlags', () => {
  it('offers generate + manual for a concrete non-Equip type', () => {
    const t = parseSampleTrigger('@dna:', TYPES)!;
    expect(sampleSuggestActionFlags(t)).toEqual({ generate: true, manual: true });
  });

  it('offers only manual for Equip (reference-DB type)', () => {
    const t = parseSampleTrigger('@equip:', TYPES)!;
    expect(sampleSuggestActionFlags(t)).toEqual({ generate: false, manual: true });
  });

  it('offers no actions for @sample (multi-type)', () => {
    const t = parseSampleTrigger('@sample:', TYPES)!;
    expect(sampleSuggestActionFlags(t)).toEqual({ generate: false, manual: false });
  });

  it('treats @item as Labware (concrete → generate + manual)', () => {
    const t = parseSampleTrigger('@item:', TYPES)!;
    expect(sampleSuggestActionFlags(t)).toEqual({ generate: true, manual: true });
  });
});
