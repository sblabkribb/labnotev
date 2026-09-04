import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { isValidReadmePath, isValidWorkflowPath } from '../lib/workflowStructure';
import {
  buildExportCandidates,
  collectExportSources,
  renderMarkdownFallback,
  buildExportHtml,
  type ExportCandidate,
  type RenderedSource,
} from '../lib/exportMarkdown';
import { extractMarkdownTables, tableToCsv } from '../lib/exportTablesCsv';
import { openFileInOsDefaultApp } from '../lib/openInOs';
import type { SectionEditorProvider } from '../sectionEditorProvider';
import { NodeFileSystem } from '@labnotev/core/node';

/** Shared Node file-system adapter for pure-logic helpers that take a LabnoteFs. */
const nodeFs = new NodeFileSystem();

export interface ExportCommandDeps {
  sectionEditorProvider?: SectionEditorProvider;
}

/** Strips characters that are illegal in file names on Windows/macOS/Linux, keeping unicode (e.g. Korean titles) intact. */
function sanitizeFileNameSegment(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/g, '_').trim();
  return cleaned || 'labnote-export';
}

const WORKFLOW_FILE_RE = /^\d{3}_.+\.labnote\.md$/i;

/**
 * Resolves the README.labnote.md to export from, preferring the active
 * editor/Section Editor document, then falling back to a workspace-wide
 * search (prompting when more than one experiment folder exists).
 */
async function resolveReadmePath(sectionEditorProvider?: SectionEditorProvider): Promise<string | undefined> {
  const fromPath = (fsPath: string | undefined): string | undefined => {
    if (!fsPath) return undefined;
    if (isValidReadmePath(fsPath) && fs.existsSync(fsPath)) return fsPath;
    if (isValidWorkflowPath(fsPath)) {
      const candidate = path.join(path.dirname(fsPath), 'README.labnote.md');
      return fs.existsSync(candidate) ? candidate : undefined;
    }
    return undefined;
  };

  const active =
    fromPath(vscode.window.activeTextEditor?.document.uri.fsPath) ??
    fromPath(sectionEditorProvider?.getActiveDocument()?.uri.fsPath);
  if (active) return active;

  const found = await vscode.workspace.findFiles('**/labnote/*/README.labnote.md', '**/node_modules/**');
  if (found.length === 0) return undefined;
  if (found.length === 1) return found[0].fsPath;

  const picked = await vscode.window.showQuickPick(
    found.map((uri) => ({
      label: path.basename(path.dirname(uri.fsPath)),
      description: uri.fsPath,
      uri,
    })),
    { placeHolder: vscode.l10n.t('Select an experiment folder to export') }
  );
  return picked?.uri.fsPath;
}

/**
 * Shared QuickPick used by both export commands: pick an experiment (if
 * needed), then choose which of its lab note files to include.
 */
async function pickExportSources(sectionEditorProvider?: SectionEditorProvider): Promise<string[] | undefined> {
  const readmePath = await resolveReadmePath(sectionEditorProvider);
  if (!readmePath) {
    vscode.window.showWarningMessage(vscode.l10n.t('No lab note experiment folder was found in this workspace.'));
    return undefined;
  }

  const dir = path.dirname(readmePath);
  const readmeContent = fs.readFileSync(readmePath, 'utf8');
  const siblingFileNames = fs
    .readdirSync(dir)
    .filter((f) => WORKFLOW_FILE_RE.test(f) && f.toLowerCase() !== 'readme.labnote.md');
  const candidates = buildExportCandidates(readmePath, readmeContent, siblingFileNames);

  const items = candidates.map((candidate) => ({
    label: candidate.label,
    description: path.basename(candidate.absPath),
    picked: candidate.checked,
    candidate,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    placeHolder: vscode.l10n.t('Select the lab note files to include'),
  });
  if (!selected) return undefined;
  if (selected.length === 0) {
    vscode.window.showWarningMessage(vscode.l10n.t('Select at least one file to export.'));
    return undefined;
  }

  return selected.map((item: { candidate: ExportCandidate }) => item.candidate.absPath);
}

export function registerExportCommands(context: vscode.ExtensionContext, deps?: ExportCommandDeps): void {
  const { sectionEditorProvider } = deps ?? {};

  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.exportPdf', async () => {
      const paths = await pickExportSources(sectionEditorProvider);
      if (!paths) return;

      const collected = await collectExportSources(nodeFs, paths);
      if (collected.length === 0) {
        vscode.window.showWarningMessage(vscode.l10n.t('No exportable lab note files were found.'));
        return;
      }

      const rendered: RenderedSource[] = [];
      for (const source of collected) {
        let bodyHtml: string;
        try {
          const result = await vscode.commands.executeCommand<string>('markdown.api.render', source.body);
          bodyHtml = typeof result === 'string' ? result : renderMarkdownFallback(source.body);
        } catch {
          bodyHtml = renderMarkdownFallback(source.body);
        }
        rendered.push({ ...source, bodyHtml });
      }

      const html = buildExportHtml(rendered, {
        author: vscode.l10n.t('Author'),
        created: vscode.l10n.t('Created'),
        lastUpdated: vscode.l10n.t('Last updated'),
      });

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'labnotev-export-'));
      const htmlPath = path.join(tmpDir, `${sanitizeFileNameSegment(rendered[0].coverTitle)}.html`);
      fs.writeFileSync(htmlPath, html, 'utf8');

      if (await openFileInOsDefaultApp(htmlPath)) {
        vscode.window.showInformationMessage(
          vscode.l10n.t('Report opened in your browser. Use Print (Ctrl/Cmd+P) to save it as a PDF.')
        );
        return;
      }

      try {
        await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(htmlPath));
      } catch {
        // command may be unavailable in some hosts
      }
      vscode.window.showWarningMessage(
        vscode.l10n.t('Could not open the report automatically. Open {0} in a browser and print it as a PDF.', htmlPath)
      );
    }),

    vscode.commands.registerCommand('labnotev.exportTablesCsv', async () => {
      const paths = await pickExportSources(sectionEditorProvider);
      if (!paths) return;

      const collected = await collectExportSources(nodeFs, paths);
      const entries = collected.flatMap((source) =>
        extractMarkdownTables(source.body).map((table) => ({ source, table }))
      );
      if (entries.length === 0) {
        vscode.window.showWarningMessage(vscode.l10n.t('No Markdown tables were found in the selected files.'));
        return;
      }

      const destination = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: vscode.l10n.t('Choose Folder'),
      });
      if (!destination || destination.length === 0) return;
      const outDir = destination[0].fsPath;

      const writtenPaths: string[] = [];
      for (const { source, table } of entries) {
        const baseName = sanitizeFileNameSegment(path.basename(source.fileName, '.labnote.md'));
        const suffix = table.index > 0 ? `_table${table.index + 1}` : '';
        const outPath = path.join(outDir, `${baseName}${suffix}.csv`);
        fs.writeFileSync(outPath, tableToCsv(table.rows), 'utf8');
        writtenPaths.push(outPath);
      }

      vscode.window.showInformationMessage(
        vscode.l10n.t('Exported {0} table(s) as CSV to {1}.', String(writtenPaths.length), outDir)
      );
      try {
        await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(writtenPaths[0]));
      } catch {
        // command may be unavailable in some hosts
      }
    })
  );
}
