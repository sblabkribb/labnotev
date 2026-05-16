/**
 * Normalizes unit-operation H4 section titles for UI and sample-button rules.
 * Keep in sync with `normalizeWorkflowUnitSectionHeading` in `src/lib/workflowSectionParser.ts`.
 */
export function normalizeUnitOpSectionHeading(heading: string): string {
  if (heading === 'Reagen') return 'Reagent';
  // Pre-v0.54.8 unit-op templates used the short heading "Consumables".
  // Newer templates rename it to "Labware and Consumables" so the section
  // also covers plates/tips/tubes; the alias keeps existing notebooks
  // rendering with the new label and a single sample-button rule.
  if (heading === 'Consumables') return 'Labware and Consumables';
  return heading;
}

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
