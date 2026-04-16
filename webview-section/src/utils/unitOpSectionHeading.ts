/**
 * Normalizes unit-operation H4 section titles for UI and sample-button rules.
 * Keep in sync with `normalizeWorkflowUnitSectionHeading` in `src/lib/workflowSectionParser.ts`.
 */
export function normalizeUnitOpSectionHeading(heading: string): string {
  if (heading === 'Reagen') return 'Reagent';
  return heading;
}

const SECTIONS_WITH_SAMPLE_BUTTON = new Set([
  'Input',
  'Reagent',
  'Consumables',
  'Equipment',
  'Output',
]);

export function unitOpSectionAllowsSampleButton(heading: string): boolean {
  return SECTIONS_WITH_SAMPLE_BUTTON.has(normalizeUnitOpSectionHeading(heading));
}
