/**
 * Pure helper for the "Delete Workflow" command (issue #38 follow-up).
 *
 * Removes a single workflow entry from the README "Related Workflows" checklist
 * while preserving section order, the instruction blockquote, and every other
 * section. The filesystem side (moving the file to trash, sample cleanup) is
 * handled by the command; this module stays pure and unit-testable.
 */
import {
  parseWorkflowChecklistFromReadme,
  generateWorkflowChecklist,
  updateReadmeWorkflowSection,
} from './workflowStructure';

export interface RemoveWorkflowFromReadmeResult {
  changed: boolean;
  content: string;
}

/**
 * Return README content with the checklist entry for `fileName` removed.
 *
 * When no entry references `fileName` the original content is returned with
 * `changed: false`, so the caller can still delete an unlisted file without
 * rewriting the README.
 */
export function removeWorkflowFromReadme(
  readmeContent: string,
  fileName: string
): RemoveWorkflowFromReadmeResult {
  const items = parseWorkflowChecklistFromReadme(readmeContent);
  const remaining = items.filter(item => item.fileName !== fileName);

  if (remaining.length === items.length) {
    return { changed: false, content: readmeContent };
  }

  const content = updateReadmeWorkflowSection(
    readmeContent,
    generateWorkflowChecklist(remaining)
  );
  return { changed: true, content };
}
