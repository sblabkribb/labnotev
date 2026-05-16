import {
  normalizeUnitOpSectionHeading,
  unitOpSectionAllowsSampleButton,
} from '../utils/unitOpSectionHeading';

describe('unitOpSectionHeading', () => {
  describe('normalizeUnitOpSectionHeading', () => {
    it('maps Reagen typo to Reagent', () => {
      expect(normalizeUnitOpSectionHeading('Reagen')).toBe('Reagent');
    });

    it('leaves Reagent and other headings unchanged', () => {
      expect(normalizeUnitOpSectionHeading('Reagent')).toBe('Reagent');
      expect(normalizeUnitOpSectionHeading('Input')).toBe('Input');
      expect(normalizeUnitOpSectionHeading('Method')).toBe('Method');
    });

    it('maps legacy "Consumables" heading to "Labware and Consumables"', () => {
      expect(normalizeUnitOpSectionHeading('Consumables')).toBe('Labware and Consumables');
    });

    it('leaves the new "Labware and Consumables" heading unchanged', () => {
      expect(normalizeUnitOpSectionHeading('Labware and Consumables')).toBe('Labware and Consumables');
    });
  });

  describe('unitOpSectionAllowsSampleButton', () => {
    it('allows Output', () => {
      expect(unitOpSectionAllowsSampleButton('Output')).toBe(true);
    });

    it('allows Reagent after normalizing Reagen', () => {
      expect(unitOpSectionAllowsSampleButton('Reagen')).toBe(true);
      expect(unitOpSectionAllowsSampleButton('Reagent')).toBe(true);
    });

    it('allows both legacy "Consumables" and new "Labware and Consumables"', () => {
      expect(unitOpSectionAllowsSampleButton('Consumables')).toBe(true);
      expect(unitOpSectionAllowsSampleButton('Labware and Consumables')).toBe(true);
    });

    it('does not allow Method', () => {
      expect(unitOpSectionAllowsSampleButton('Method')).toBe(false);
    });
  });
});
