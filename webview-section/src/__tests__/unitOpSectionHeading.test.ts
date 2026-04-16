import { describe, it, expect } from 'vitest';
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
  });

  describe('unitOpSectionAllowsSampleButton', () => {
    it('allows Output', () => {
      expect(unitOpSectionAllowsSampleButton('Output')).toBe(true);
    });

    it('allows Reagent after normalizing Reagen', () => {
      expect(unitOpSectionAllowsSampleButton('Reagen')).toBe(true);
      expect(unitOpSectionAllowsSampleButton('Reagent')).toBe(true);
    });

    it('does not allow Method', () => {
      expect(unitOpSectionAllowsSampleButton('Method')).toBe(false);
    });
  });
});
