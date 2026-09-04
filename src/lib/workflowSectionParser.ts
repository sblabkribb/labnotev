// Moved to @labnotev/core. Kept as a thin re-export so existing import sites
// (`./lib/workflowSectionParser`) and their test mocks continue to resolve.
export {
  parseWorkflowMd,
  serializeWorkflowMd,
  validateWorkflowDocument,
  normalizeWorkflowUnitSectionHeading,
} from '@labnotev/core';
