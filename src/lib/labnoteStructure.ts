/**
 * Labnote Structure - Functions for creating labnote folder structures
 */

import * as path from 'path';
import { getSeoulDateString } from './dateUtils';

/**
 * Structure returned by createLabnoteStructure
 */
export interface LabnoteStructure {
  labnoteFolder: string;
  readmePath: string;
  imagesFolder: string;
  resourcesFolder: string;
  readmeContent: string;
}

/**
 * Get the next labnote number based on existing folders
 * @param existingFolders Array of existing folder names (e.g., ['001_First', '002_Second'])
 * @returns Next number as 3-digit string (e.g., '003')
 */
export function getNextLabnoteNumber(existingFolders: string[]): string {
  const numbers = existingFolders
    .map(folder => {
      const match = folder.match(/^(\d{3})_/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => n > 0);

  const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
  return String(maxNumber + 1).padStart(3, '0');
}

/**
 * Sanitize title for use as folder name
 * - Replaces spaces with underscores
 * - Removes special characters except Korean, alphanumeric, and underscores
 */
export function sanitizeTitle(title: string): string {
  return title
    .replace(/\s+/g, '_')
    .replace(/[^\w\u3131-\uD79D_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Generate README.md content for a new labnote
 * @param title Experiment title
 * @param author Optional author name
 */
export function generateReadmeContent(title: string, author?: string): string {
  const today = getSeoulDateString(new Date());
  
  const authorLine = author ? `author: ${author}\n` : '';
  
  return `---
title: ${title}
${authorLine}created_date: ${today}
last_updated_date: ${today}
---

# ${title}

## 목표

실험의 목표를 기술합니다.

## 실험 조건

- 조건 1
- 조건 2

## 실험 방법

1. 단계 1
2. 단계 2

## 결과

실험 결과를 기술합니다.

## 결론

결론 및 향후 계획을 기술합니다.

## 참고 자료

- 관련 문서나 링크
`;
}

/**
 * Create labnote folder structure paths
 * @param workspaceRoot Workspace root path
 * @param title Experiment title
 * @param existingFolders Existing labnote folder names
 * @param author Optional author name
 */
export function createLabnoteStructure(
  workspaceRoot: string,
  title: string,
  existingFolders: string[],
  author?: string
): LabnoteStructure {
  const number = getNextLabnoteNumber(existingFolders);
  const sanitizedTitle = sanitizeTitle(title);
  const folderName = `${number}_${sanitizedTitle}`;
  
  const labnoteFolder = path.join(workspaceRoot, 'labnote', folderName);
  
  return {
    labnoteFolder,
    readmePath: path.join(labnoteFolder, 'README.md'),
    imagesFolder: path.join(labnoteFolder, 'images'),
    resourcesFolder: path.join(labnoteFolder, 'resources'),
    readmeContent: generateReadmeContent(title, author),
  };
}
