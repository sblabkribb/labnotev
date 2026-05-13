import * as path from 'path';
import {
  createWorkflowFileName,
  generateWorkflowChecklist,
  parseWorkflowChecklistFromReadme,
  parseWorkflowFileName,
  sanitizeWorkflowName,
  updateReadmeWorkflowSection,
  WorkflowChecklistItem,
} from './workflowStructure';

export interface RenameWorkflowPlan {
  oldFilePath: string;
  newFilePath: string;
  newFileContent: string;
  readmePath: string | null;
  newReadmeContent: string | null;
  newDisplayName: string;
}

export type RenameWorkflowResult = RenameWorkflowPlan | { error: string };

export interface PlanRenameWorkflowArgs {
  workflowFilePath: string;
  oldWorkflowContent: string;
  readmePath: string | null;
  oldReadmeContent: string | null;
  newName: string;
}

/**
 * Pure planner for the issue #19 Rename Workflow command.
 *
 * Computes the new on-disk filename, the rewritten workflow body (front matter
 * title + first matching H2 heading), and the rewritten README checklist when
 * one is supplied. Does not touch the filesystem — the caller is responsible
 * for sequencing `workspace.fs.rename`, document edits, and saves with proper
 * dirty-document handling.
 *
 * Returns `{ error }` for any validation failure so the caller can surface the
 * message via `showWarningMessage`.
 */
export function planRenameWorkflow(args: PlanRenameWorkflowArgs): RenameWorkflowResult {
  const { workflowFilePath, oldWorkflowContent, readmePath, oldReadmeContent, newName } = args;

  const oldFileName = path.basename(workflowFilePath);
  const parsed = parseWorkflowFileName(oldFileName);
  if (!parsed) {
    return { error: '워크플로 파일명 형식이 아닙니다' };
  }

  const trimmed = newName.trim();
  if (trimmed === '') {
    return { error: '이름을 입력하세요' };
  }
  if (sanitizeWorkflowName(trimmed) === '') {
    return { error: '이름에 영문/숫자/언더스코어가 한 글자 이상 있어야 합니다' };
  }

  const id = parsed.id;
  const newFileName = createWorkflowFileName(parsed.sequence, {
    id,
    name: trimmed,
    description: '',
  });
  if (newFileName === oldFileName) {
    return { error: '변경 사항이 없습니다' };
  }

  const newFilePath = path.join(path.dirname(workflowFilePath), newFileName);
  const newFileContent = rewriteWorkflowBody(oldWorkflowContent, id, trimmed);

  let newReadmeContent: string | null = null;
  if (readmePath && oldReadmeContent !== null) {
    const items = parseWorkflowChecklistFromReadme(oldReadmeContent);
    const matches = items.filter(item => item.fileName === oldFileName);
    if (matches.length > 1) {
      return { error: '같은 파일을 참조하는 체크리스트 항목이 여러 개입니다' };
    }
    if (matches.length === 1) {
      const updated: WorkflowChecklistItem[] = items.map(item => {
        if (item.fileName !== oldFileName) return item;
        return {
          ...item,
          fileName: newFileName,
          title: `${parsed.sequence} ${id} ${trimmed}`,
        };
      });
      newReadmeContent = updateReadmeWorkflowSection(
        oldReadmeContent,
        generateWorkflowChecklist(updated)
      );
    }
  }

  return {
    oldFilePath: workflowFilePath,
    newFilePath,
    newFileContent,
    readmePath: newReadmeContent === null ? null : readmePath,
    newReadmeContent,
    newDisplayName: `${id} ${trimmed}`,
  };
}

/**
 * Rewrites the workflow body so that:
 * 1. Only the `title:` line inside the YAML front matter block is replaced.
 *    Any literal `title:` text in the document body (e.g. inside a fenced code
 *    block) is preserved verbatim.
 * 2. The first H2 heading of the form `## [<id> <something>]` whose id matches
 *    the workflow id is updated. Other H2 headings (including ones with a
 *    different workflow id) are untouched.
 */
function rewriteWorkflowBody(content: string, id: string, newName: string): string {
  const idEsc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  let result = content;
  const fmMatch = result.match(/^---\s*\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const fmBlock = fmMatch[0];
    const newFmBlock = fmBlock.replace(/^title:.*$/m, `title: ${id} ${newName}`);
    if (newFmBlock !== fmBlock) {
      result = newFmBlock + result.slice(fmBlock.length);
    }
  }

  result = result.replace(
    new RegExp(`^## \\[${idEsc}\\s+[^\\]]+\\]\\s*$`, 'm'),
    `## [${id} ${newName}]`
  );

  return result;
}
