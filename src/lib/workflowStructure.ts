/**
 * Workflow Structure - Functions for creating workflow files and managing workflow checklist
 */

import * as path from 'path';
import { getSeoulDateString } from './dateUtils';

/**
 * Workflow information for creating workflow files
 */
export interface WorkflowInfo {
  id: string;
  name: string;
  description: string;
}

/**
 * Workflow checklist item parsed from README
 */
export interface WorkflowChecklistItem {
  fileName: string;
  title: string;
  done: boolean;
}

/**
 * Check if a file path is a valid README.md in a labnote subfolder
 * Path should be: {workspace}/labnote/{###_ExperimentName}/README.md
 */
export function isValidReadmePath(filePath: string): boolean {
  // Normalize path separators
  const normalizedPath = filePath.replace(/\\/g, '/');
  const baseName = path.basename(normalizedPath).toLowerCase();
  
  if (baseName !== 'readme.md') {
    return false;
  }
  
  try {
    const dirPath = path.dirname(normalizedPath);
    const experimentDirName = path.basename(dirPath);
    const labnoteDirPath = path.dirname(dirPath);
    const labnoteDirName = path.basename(labnoteDirPath).toLowerCase();
    
    // Check if parent folder is 'labnote' and experiment folder has 3-digit prefix
    const isLabnoteDir = labnoteDirName === 'labnote';
    const hasCorrectPrefix = /^\d{3}_/.test(experimentDirName);
    
    return isLabnoteDir && hasCorrectPrefix;
  } catch {
    return false;
  }
}

/**
 * Check if a file path is a valid workflow file in a labnote subfolder
 * Path should be: {workspace}/labnote/{###_ExperimentName}/{###_WX###_Name}.md
 */
export function isValidWorkflowPath(filePath: string): boolean {
  // Normalize path separators
  const normalizedPath = filePath.replace(/\\/g, '/');
  const baseName = path.basename(normalizedPath).toLowerCase();
  
  // Must be a .md file (not README.md) with 3-digit prefix
  if (!normalizedPath.toLowerCase().endsWith('.md') || baseName === 'readme.md') {
    return false;
  }
  
  // Check if filename starts with 3-digit prefix
  const fileName = path.basename(normalizedPath);
  if (!/^\d{3}_/.test(fileName)) {
    return false;
  }
  
  try {
    const dirPath = path.dirname(normalizedPath);
    const experimentDirName = path.basename(dirPath);
    const labnoteDirPath = path.dirname(dirPath);
    const labnoteDirName = path.basename(labnoteDirPath).toLowerCase();
    
    // Check if parent folder is 'labnote' and experiment folder has 3-digit prefix
    return labnoteDirName === 'labnote' && /^\d{3}_/.test(experimentDirName);
  } catch {
    return false;
  }
}

/**
 * Get the next workflow number based on existing files
 * @param existingFiles Array of existing file names (e.g., ['001_WD010_Design.md'])
 * @returns Next number as 3-digit string (e.g., '002')
 */
export function getNextWorkflowNumber(existingFiles: string[]): string {
  const numbers = existingFiles
    // Only count .md files with 3-digit prefix (excluding readme.md)
    .filter(file => /^\d{3}_.*\.md$/i.test(file) && file.toLowerCase() !== 'readme.md')
    .map(file => {
      const match = file.match(/^(\d{3})_/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => n > 0);

  const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
  return String(maxNumber + 1).padStart(3, '0');
}

/**
 * Sanitize workflow name for use in filename
 * - Replaces spaces with underscores
 * - Removes special characters except alphanumeric and underscores
 */
export function sanitizeWorkflowName(name: string): string {
  return name
    .replace(/\s+/g, '_')
    .replace(/[^\w_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Create workflow file content with YAML front matter
 * @param workflow Workflow information
 * @param userDescription Optional description from user
 * @param experimenter Experimenter name (from README author field)
 */
export function createWorkflowContent(
  workflow: WorkflowInfo,
  userDescription: string,
  experimenter: string
): string {
  const today = getSeoulDateString(new Date());
  const titleParts = [workflow.id, workflow.name];
  if (userDescription) {
    titleParts.push(`- ${userDescription}`);
  }
  const title = titleParts.join(' ');
  
  const headerTitle = userDescription 
    ? `## [${workflow.id} ${workflow.name}] ${userDescription}`
    : `## [${workflow.id} ${workflow.name}]`;
  
  return `---
title: ${title}
experimenter: ${experimenter}
created_date: ${today}
last_updated_date: ${today}
end_date: ''
---

${headerTitle}

> ${workflow.description}

## Related Unit Operations

> 유닛 오퍼레이션 목록이 자동으로 추가됩니다.
> F1 → "Lab Note: Add Unit Operation" 명령으로 유닛 오퍼레이션을 추가하세요.



`;
}

/**
 * Create workflow filename with .md extension
 * @param sequence 3-digit sequence number (e.g., '001')
 * @param workflow Workflow information
 * @param userDescription Optional description from user
 */
export function createWorkflowFileName(
  sequence: string,
  workflow: WorkflowInfo,
  userDescription: string
): string {
  const safeName = sanitizeWorkflowName(workflow.name);
  const safeDescription = userDescription ? `_${sanitizeWorkflowName(userDescription)}` : '';
  
  return `${sequence}_${workflow.id}_${safeName}${safeDescription}.md`;
}

/**
 * Parse workflow checklist from README content
 * Looks for items in the "Related Workflows" section
 */
export function parseWorkflowChecklistFromReadme(readmeContent: string): WorkflowChecklistItem[] {
  const lines = readmeContent.split('\n');
  const headerIndex = lines.findIndex(line => /^##\s.*Related Workflows/i.test(line.trim()));
  
  if (headerIndex === -1) {
    return [];
  }
  
  const items: WorkflowChecklistItem[] = [];
  
  // Start from line after header
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Stop at next section
    if (line.startsWith('## ')) {
      break;
    }
    
    // Parse checkbox items: [ ] [title](./filename.md) or [x] [title](./filename.md)
    const checkboxMatch = line.match(/^\[([ x])\]\s*\[([^\]]+)\]\(\.\/([\w\-_.]+\.md)\)/i);
    if (checkboxMatch) {
      items.push({
        done: checkboxMatch[1].toLowerCase() === 'x',
        title: checkboxMatch[2],
        fileName: checkboxMatch[3],
      });
    }
  }
  
  return items;
}

/**
 * Generate workflow checklist markdown
 * @param items Array of workflow checklist items
 */
export function generateWorkflowChecklist(items: WorkflowChecklistItem[]): string {
  if (items.length === 0) {
    return '';
  }
  
  return items
    .map(item => {
      const checkbox = item.done ? '[x]' : '[ ]';
      return `${checkbox} [${item.title}](./${item.fileName})`;
    })
    .join('\n');
}

/**
 * Update Related Workflows section in README content
 * @param readmeContent Current README content
 * @param newChecklistContent New checklist content to insert
 * @returns Updated README content
 */
export function updateReadmeWorkflowSection(
  readmeContent: string,
  newChecklistContent: string
): string {
  const lines = readmeContent.split('\n');
  const headerIndex = lines.findIndex(line => /^##\s.*Related Workflows/i.test(line.trim()));
  
  if (headerIndex === -1) {
    return readmeContent;
  }
  
  // Find the section boundaries
  let insertStart = headerIndex + 1;
  
  // Skip blockquote lines (instructions)
  while (insertStart < lines.length && lines[insertStart].trim().startsWith('>')) {
    insertStart++;
  }
  
  // Skip empty lines after blockquote
  while (insertStart < lines.length && lines[insertStart].trim() === '') {
    insertStart++;
  }
  
  // Find end of checkbox section
  let blockEnd = insertStart;
  while (blockEnd < lines.length) {
    const trimmed = lines[blockEnd].trim();
    if (trimmed.startsWith('## ')) {
      break;
    }
    if (trimmed.startsWith('[ ]') || trimmed.startsWith('[x]') || trimmed === '') {
      blockEnd++;
      continue;
    }
    break;
  }
  
  // Build new content
  const before = lines.slice(0, insertStart);
  const after = lines.slice(blockEnd);
  
  const newLines = newChecklistContent ? [newChecklistContent, '', ''] : [''];
  
  return [...before, ...newLines, ...after].join('\n');
}

/**
 * Parse experimenter name from README YAML front matter
 */
export function parseExperimenterFromReadme(readmeContent: string): string {
  const match = readmeContent.match(/^---[\s\S]+?---/);
  if (!match) {
    return '';
  }
  
  const authorMatch = match[0].match(/author:\s*(.+)/i);
  return authorMatch ? authorMatch[1].trim() : '';
}
