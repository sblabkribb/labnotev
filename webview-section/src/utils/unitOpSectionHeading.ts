import { normalizeWorkflowUnitSectionHeading } from '@labnotev/core/headings';

/**
 * Normalizes unit-operation H4 section titles for UI and sample-button rules.
 * Single source of truth is `normalizeWorkflowUnitSectionHeading` in
 * `@labnotev/core`; this is a named alias for the webview call sites/tests.
 */
export const normalizeUnitOpSectionHeading = normalizeWorkflowUnitSectionHeading;

const SECTIONS_WITH_SAMPLE_BUTTON = new Set([
  'Input',
  'Reagent',
  'Labware and Consumables',
  'Equipment',
  'Output',
]);

export function unitOpSectionAllowsSampleButton(heading: string): boolean {
  return SECTIONS_WITH_SAMPLE_BUTTON.has(normalizeUnitOpSectionHeading(heading));
}

/**
 * Maps a normalized unit-op section heading to the built-in sample type
 * that the section-bound +Sample button should lock to. Returns undefined
 * for sections that allow the user to pick any type (Input, Output).
 *
 * Keys are the normalized headings, so the legacy "Consumables" heading is
 * automatically remapped to "Labware and Consumables" → 'Labware' through
 * `normalizeUnitOpSectionHeading`.
 */
const SECTION_TYPE_LOCK: Record<string, string> = {
  Reagent: 'Reagent',
  'Labware and Consumables': 'Labware',
  Equipment: 'Equip',
};

export function getSectionTypeLock(heading: string): string | undefined {
  return SECTION_TYPE_LOCK[normalizeUnitOpSectionHeading(heading)];
}
