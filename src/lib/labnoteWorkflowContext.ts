/**
 * Resolve whether the user is editing a lab note via README.md (text editor) or Section Editor.
 */
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { isValidReadmePath, parseExperimenterFromReadme } from './workflowStructure';
import type { SectionEditorProvider } from '../sectionEditorProvider';

export type ActiveLabnoteEditTarget =
  | { mode: 'readme'; editor: vscode.TextEditor }
  | { mode: 'section'; document: vscode.TextDocument; provider: SectionEditorProvider };

export function getActiveLabnoteEditTarget(
  sectionEditorProvider?: SectionEditorProvider
): ActiveLabnoteEditTarget | undefined {
  const te = vscode.window.activeTextEditor;
  if (te && isValidReadmePath(te.document.uri.fsPath)) {
    return { mode: 'readme', editor: te };
  }
  const secDoc = sectionEditorProvider?.getActiveDocument();
  if (secDoc && sectionEditorProvider?.getEditorMode() === 'labnote') {
    return { mode: 'section', document: secDoc, provider: sectionEditorProvider };
  }
  return undefined;
}

export function labnoteDirFromTarget(target: ActiveLabnoteEditTarget): string {
  if (target.mode === 'readme') {
    return path.dirname(target.editor.document.uri.fsPath);
  }
  return path.dirname(target.document.uri.fsPath);
}

/** Experimenter name for workflow templates: from README YAML front matter */
export function getExperimenterForLabnoteFolder(labnoteDir: string): string {
  const readmePath = path.join(labnoteDir, 'README.labnote.md');
  if (fs.existsSync(readmePath)) {
    const content = fs.readFileSync(readmePath, 'utf8');
    return parseExperimenterFromReadme(content);
  }
  return '';
}
