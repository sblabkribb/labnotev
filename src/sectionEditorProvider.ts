import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parseLabNoteMd, serializeLabNoteMd } from './lib/labnoteSectionParser';
import { parseWorkflowMd, serializeWorkflowMd } from './lib/workflowSectionParser';
import type { UnitOperationBlock, WorkflowReference } from './lib/sectionTypes';
import { getSeoulDateTimeString } from './lib/dateUtils';
import { isValidSectionEditorMessage } from './lib/webviewMessage';
import { generateSampleId, getSampleDisplayMeta, buildSampleDefSuffix, type SampleDisplayMeta } from './lib/sampleUtils';
import { findSampleDefinitionOnlyMatch } from './lib/sampleStorage';
import { showProductPicker } from './lib/productPicker';
import { parseWorkflowChecklistFromReadme, generateWorkflowChecklist, updateReadmeWorkflowSection } from './lib/workflowStructure';
import type { SampleTreeViewProvider } from './views/SampleTreeViewProvider';
import { isPathInsideDir, resolveContainedPath } from './lib/isPathInsideDir';
import { buildInDocDirAttachmentMarkdownLink, formatAttachmentMarkdown } from './lib/attachmentMarkdownLink';
import { buildSampleDefMap } from './lib/dataLoader';
import { openFileInOsDefaultApp } from './lib/openInOs';
import { buildSwUnitOpSections, buildHwUnitOpSections } from './lib/unitOpTemplate';

export type MdFileType = 'labnote' | 'workflow' | 'unknown';

function getUniqueAttachmentDestPath(attachDir: string, baseName: string): string {
  const dest = path.join(attachDir, baseName);
  if (!fs.existsSync(dest)) return dest;
  const ext = path.extname(baseName);
  const stem = ext ? path.basename(baseName, ext) : baseName;
  return path.join(attachDir, `${stem}_${Date.now()}${ext}`);
}

/** Office-style attachments open reliably in the OS default app (e.g. Excel) instead of the VS Code editor. */
const OFFICE_ATTACHMENT_EXTENSIONS = new Set([
  '.xlsx', '.xls', '.xlsm',
  '.doc', '.docx', '.docm',
  '.ppt', '.pptx', '.pptm',
]);

export function shouldOpenAttachmentWithExternalApp(filePath: string): boolean {
  return OFFICE_ATTACHMENT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/**
 * Validate a clipboard text payload against our labnotev unit-operation
 * envelope. Returns the inner `UnitOperationBlock` on success, or `null` if
 * the text isn't valid JSON or doesn't match the expected shape.
 *
 * Shared by `requestPasteUnitOp` (insert path) and `queryClipboardState`
 * (UI enablement) so both code paths use the same source of truth.
 */
function parseClipboardUnitOp(text: string): UnitOperationBlock | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const env = parsed as { kind?: unknown; version?: unknown; data?: unknown } | null;
  if (
    !env || typeof env !== 'object'
    || env.kind !== 'labnotev/unit-operation'
    || env.version !== 1
    || !env.data || typeof env.data !== 'object'
  ) {
    return null;
  }
  const d = env.data as Partial<UnitOperationBlock> & { sections?: unknown };
  if (
    typeof d.opId !== 'string'
    || typeof d.opName !== 'string'
    || (d.opType !== 'hw' && d.opType !== 'sw')
    || !Array.isArray(d.sections)
  ) {
    return null;
  }
  return d as UnitOperationBlock;
}

/**
 * Open a linked attachment: Office files use OS default app via shell (cmd/start, open, xdg-open);
 * others prefer VS Code default editor. Falls back through openWith → OS shell → vscode.open → error + reveal in OS explorer.
 */
export async function openAttachmentFile(uri: vscode.Uri): Promise<void> {
  const wantExternal = shouldOpenAttachmentWithExternalApp(uri.fsPath);
  const fsPath = uri.fsPath;

  const tryRevealInOs = async () => {
    try {
      await vscode.commands.executeCommand('revealFileInOS', uri);
    } catch {
      // command may be unavailable in some hosts
    }
  };

  const showOpenFailed = async () => {
    await vscode.window.showErrorMessage(
      vscode.l10n.t('Cannot open file: {0}', path.basename(uri.fsPath))
    );
    await tryRevealInOs();
  };

  const tryOpenWithDefault = async () => {
    await vscode.commands.executeCommand('vscode.openWith', uri, 'default');
  };

  const tryOpen = async () => {
    await vscode.commands.executeCommand('vscode.open', uri);
  };

  if (wantExternal) {
    if (await openFileInOsDefaultApp(fsPath)) return;
    try {
      await tryOpenWithDefault();
      return;
    } catch {
      try {
        await tryOpen();
        return;
      } catch {
        await showOpenFailed();
      }
    }
    return;
  }

  try {
    await tryOpenWithDefault();
    return;
  } catch {
    try {
      if (await openFileInOsDefaultApp(fsPath)) return;
    } catch {
      // continue to vscode.open
    }
    try {
      await tryOpen();
      return;
    } catch {
      await showOpenFailed();
    }
  }
}

export function detectMdFileType(content: string): MdFileType {
  // Normalize CRLF so Windows-saved files match the same front-matter shape.
  const fmMatch = content.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return 'unknown';
  const yaml = fmMatch[1];
  // Issue #36: match keys line-anchored so a value that happens to contain the
  // substring (e.g. a polluted `experimenter: experiment_type: labnote`) cannot
  // trigger a false labnote classification.
  if (/^experiment_type:\s*labnote/im.test(yaml)) return 'labnote';
  if (/^experimenter:/im.test(yaml)) return 'workflow';
  return 'unknown';
}

type WfEditorLike = { document: vscode.TextDocument; mode: MdFileType };

/**
 * Issue #37: resolve the workflow document a TreeView insert command should
 * target. The tracked single slot (activeEditor / _lastActiveEditor) can be
 * empty even while a workflow editor is open (e.g. focus moved to the sidebar
 * and a previously-closed editor cleared `_lastActiveEditor`). Scanning the
 * authoritative live set `_allEditors` recovers the open workflow editor.
 *
 * Workflow-ness is determined by the cached mode OR a fresh content detection,
 * so the result is independent of folder naming and robust to a stale/mis-cached
 * mode (e.g. an editor left open from before the #36 detection fix).
 */
export function pickWorkflowDocument(
  tracked: WfEditorLike | undefined,
  all: WfEditorLike[],
  detect: (text: string) => MdFileType,
): vscode.TextDocument | undefined {
  const isWf = (e: WfEditorLike) =>
    e.mode === 'workflow' || detect(e.document.getText()) === 'workflow';
  if (tracked && isWf(tracked)) return tracked.document;
  for (let i = all.length - 1; i >= 0; i--) {
    if (isWf(all[i])) return all[i].document;
  }
  return undefined;
}

/**
 * Read the user's `labnotev.customSampleTypes` config and funnel it through
 * the single `getSampleDisplayMeta` entry point. All call sites that need
 * "available types" and/or "type -> color" derive from this one result so the
 * init payload, customTypesUpdated messages, and sampleDefs builders stay in
 * lock-step.
 */
function readSampleDisplayMeta(): SampleDisplayMeta {
  const custom = vscode.workspace.getConfiguration('labnotev').get<string[]>('customSampleTypes', []);
  return getSampleDisplayMeta(custom);
}

function getAvailableTypes(): string[] {
  return readSampleDisplayMeta().types;
}

export function buildUnitOperationBlock(
  opId: string,
  opName: string,
  opDescription: string,
  opType: 'hw' | 'sw',
  experimenter: string
): UnitOperationBlock {
  const dateTime = getSeoulDateTimeString(new Date());
  const id = `unitop-${Date.now()}`;

  const sections = opType === 'sw'
    ? buildSwUnitOpSections({ experimenter, dateTime })
    : buildHwUnitOpSections({ experimenter, dateTime });

  return { id, opId, opName, opDescription, opType, sections };
}

interface ActiveEditor {
  document: vscode.TextDocument;
  webviewPanel: vscode.WebviewPanel;
  mode: MdFileType;
}

export class SectionEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'labnotev.sectionEditor';

  private activeEditor: ActiveEditor | undefined;
  // Kept in sync with `activeEditor` but NOT cleared when the webview becomes
  // inactive (e.g. when focusing the TreeView). Used as a fallback so that
  // sample inserts from the TreeView still post messages to the last webview
  // the user was editing. Cleared only on dispose.
  private _lastActiveEditor: ActiveEditor | undefined;
  // Every live webview, used by broadcastSampleDefsUpdated() so a TreeView
  // command / save / JSON watcher can refresh sampleDefs in all open Section
  // Editors at once (not just the active one). Entries are removed in
  // `webviewPanel.onDidDispose`.
  private _allEditors: Set<ActiveEditor> = new Set();
  // Documents whose change events should be ignored because the extension is
  // mid-write on them. Tracked per-URI so one document's save does not silence
  // another open document's sync (a shared boolean used to leak across panels).
  private _suppressedDocs = new Set<string>();
  private _sampleTreeProvider: SampleTreeViewProvider | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public setSampleTreeProvider(provider: SampleTreeViewProvider): void {
    this._sampleTreeProvider = provider;
  }

  public getActiveDocument(): vscode.TextDocument | undefined {
    return (this.activeEditor ?? this._lastActiveEditor)?.document;
  }

  public getEditorMode(): MdFileType | undefined {
    return (this.activeEditor ?? this._lastActiveEditor)?.mode;
  }

  /**
   * Issue #37: the open workflow document for TreeView insert commands, resolved
   * robustly across the live editor set (not just the single tracked slot).
   */
  public getActiveWorkflowDocument(): vscode.TextDocument | undefined {
    const tracked = this.activeEditor ?? this._lastActiveEditor;
    return pickWorkflowDocument(tracked, [...this._allEditors], detectMdFileType);
  }

  public getDocumentFolder(): string | undefined {
    const editor = this.activeEditor ?? this._lastActiveEditor;
    if (!editor) return undefined;
    return path.dirname(editor.document.uri.fsPath);
  }

  /**
   * Push a freshly built `sampleDefs` map to every live Section Editor
   * webview. Each webview gets a map resolved against its own document URI
   * so local/global sample lookups stay accurate per panel.
   *
   * Called after TreeView commands (edit/add/delete/move), document save,
   * and the labsamples JSON file watcher.
   */
  public broadcastSampleDefsUpdated(): void {
    if (this._allEditors.size === 0) return;
    const types = getAvailableTypes();
    for (const editor of this._allEditors) {
      editor.webviewPanel.webview.postMessage({
        type: 'sampleDefsUpdated',
        data: { sampleDefs: buildSampleDefMap(editor.document.uri, types) },
      });
    }
  }

  /**
   * Push the current available types + colors to every live Section Editor
   * webview after the `labnotev.customSampleTypes` setting changes from a
   * TreeView command (e.g. delete custom type). Mirrors the single-panel
   * `customTypesUpdated` message sent by the `addCustomType` handler.
   */
  public broadcastCustomTypesUpdated(): void {
    if (this._allEditors.size === 0) return;
    const meta = readSampleDisplayMeta();
    for (const editor of this._allEditors) {
      editor.webviewPanel.webview.postMessage({
        type: 'customTypesUpdated',
        data: {
          availableTypes: meta.types,
          sampleTypeColors: meta.colors,
        },
      });
    }
  }

  /**
   * Build a Chat prompt that quotes the user's selection and attaches the
   * full source document via the `#file:` reference variable, then open the
   * Chat panel with the prompt prefilled. `isPartialQuery: true` keeps the
   * Send button under user control so they can append a question (e.g.
   * "summarize" / "rewrite as bullet points") before submitting.
   */
  public async handleSendSelectionToChat(
    document: vscode.TextDocument,
    data: {
      selectedText?: string;
      chatContextOpId?: string;
      chatContextSectionHeading?: string;
    } | undefined
  ): Promise<void> {
    const selectedText = (data?.selectedText ?? '').trim();
    if (!selectedText) return;

    const relativePath = vscode.workspace.asRelativePath(document.uri, false);
    const fileBaseName = path.basename(document.uri.fsPath);

    const opId = data?.chatContextOpId;
    const sectionHeading = data?.chatContextSectionHeading;
    const metaParts = [`Selected from ${fileBaseName}`];
    if (opId) metaParts.push(`UnitOp ${opId}`);
    if (sectionHeading) metaParts.push(`Section "${sectionHeading}"`);
    const metaLine = metaParts.join(' / ') + ':';

    const query = [
      `#file:${relativePath}`,
      '',
      metaLine,
      '',
      '```',
      data?.selectedText ?? '',
      '```',
    ].join('\n');

    try {
      await vscode.commands.executeCommand('workbench.action.chat.open', {
        query,
        isPartialQuery: true,
      });
    } catch {
      vscode.window.showErrorMessage(
        vscode.l10n.t('Failed to open Chat. Ensure VS Code Chat is enabled.'),
      );
    }
  }

  public async appendUnitOpToDocument(
    document: vscode.TextDocument,
    unitOp: UnitOperationBlock
  ): Promise<void> {
    const content = document.getText();
    const doc = parseWorkflowMd(content);
    doc.unitOperations.push(unitOp);
    const newContent = serializeWorkflowMd(doc);
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(content.length)
    );
    edit.replace(document.uri, fullRange, newContent);
    const docKey = document.uri.toString();
    this._suppressedDocs.add(docKey);
    try {
      await vscode.workspace.applyEdit(edit);
    } finally {
      this._suppressedDocs.delete(docKey);
    }

    // Issue #37: refresh the panel owning this document even if it is not the
    // active slot (tree-view insert leaves focus on the sidebar). The self-edit
    // suppresses the generic `documentChanged` sync, so `unitOpAdded` is the
    // only refresh signal — it must reach the right webview.
    const target = this.getEditorForDocument(document);
    if (target) {
      target.webviewPanel.webview.postMessage({
        type: 'unitOpAdded',
        data: unitOp,
      });
    }
  }

  private getEditorForDocument(
    document: vscode.TextDocument
  ): ActiveEditor | undefined {
    if (this.activeEditor?.document === document) return this.activeEditor;
    if (this._lastActiveEditor?.document === document) return this._lastActiveEditor;
    for (const editor of this._allEditors) {
      if (editor.document === document) return editor;
    }
    return undefined;
  }

  public async insertSampleIntoDocument(
    document: vscode.TextDocument,
    sampleText: string
  ): Promise<void> {
    const editor = this.activeEditor?.document === document
      ? this.activeEditor
      : (this._lastActiveEditor?.document === document ? this._lastActiveEditor : undefined);
    if (editor) {
      editor.webviewPanel.webview.postMessage({
        type: 'sampleInserted',
        data: { text: sampleText },
      });
    }
  }

  public async insertTextToActiveEditor(text: string): Promise<void> {
    const editor = this.activeEditor ?? this._lastActiveEditor;
    if (editor) {
      editor.webviewPanel.webview.postMessage({
        type: 'textInserted',
        data: { text },
      });
    }
  }

  public async mergeWorkflowIntoDocument(
    document: vscode.TextDocument,
    wfRef: WorkflowReference
  ): Promise<void> {
    if (this.activeEditor?.document === document) {
      this.activeEditor.webviewPanel.webview.postMessage({
        type: 'workflowAdded',
        data: wfRef,
      });
    }
  }

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const content = document.getText();
    const mode = detectMdFileType(content);

    this.activeEditor = { document, webviewPanel, mode };
    this._lastActiveEditor = this.activeEditor;
    this._allEditors.add(this.activeEditor);
    if (document.uri.fsPath.endsWith('.labnote.md') && this._sampleTreeProvider) {
      const experimentFolder = path.dirname(document.uri.fsPath);
      this._sampleTreeProvider.updateDocumentFolder(experimentFolder);
    }

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'webview-section', 'dist'),
        vscode.Uri.file(path.dirname(document.uri.fsPath)),
      ],
    };

    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      // Reject malformed envelopes up front: only act on a plain object with a
      // non-empty string `type` and an object (or absent) `data` payload.
      if (!isValidSectionEditorMessage(message)) {
        return;
      }
      try {
      switch (message.type) {
        case 'ready':
          await this.sendInitMessage(document, webviewPanel, mode);
          break;

        case 'save':
          try {
            await this.handleSave(document, message.data, mode);
            webviewPanel.webview.postMessage({ type: 'saveCompleted' });
          } catch (err) {
            // Without this the webview never leaves the "saving" state.
            webviewPanel.webview.postMessage({ type: 'saveFailed' });
            vscode.window.showErrorMessage(
              vscode.l10n.t('Failed to save the lab note: {0}', String(err))
            );
          }
          break;

        case 'openAsText':
          await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
          break;

        case 'openImagePreview':
          if (message.data?.imagePath) {
            const dir = path.dirname(document.uri.fsPath);
            const imagePath = resolveContainedPath(dir, message.data.imagePath);
            if (imagePath) {
              await vscode.commands.executeCommand('labnotev.openImagePreview', {
                imagePath: vscode.Uri.file(imagePath).toString(),
                altText: '',
              });
            }
          }
          break;

        case 'navigateToSample': {
          const { sampleId, sampleType } = message.data || {};
          if (!sampleId || !sampleType) break;

          const docText = document.getText();
          // Use the strict definition matcher so we don't jump to the first
          // body reference (e.g. plain `DNA-123`) when the actual `@type;ID...`
          // definition lives elsewhere in the document.
          const defMatch = findSampleDefinitionOnlyMatch(docText, sampleType, sampleId);
          if (defMatch) {
            const loc = this.findSectionForOffset(docText, defMatch.start, mode);
            if (loc) {
              webviewPanel.webview.postMessage({
                type: 'scrollToSample',
                data: loc,
              });
              break;
            }
          }
          vscode.window.showInformationMessage(
            vscode.l10n.t('Definition not found in current document.')
          );
          break;
        }

        case 'createSampleFromModal': {
          // Phase C-1: forward the stable identifiers (opId + secHeading) the
          // webview resolved at submit time, so the webview can re-locate the
          // target section even if unit operations have been reordered,
          // inserted, or removed in the meantime.
          const { sampleType: reqType, alias, description, opIndex, secIndex, opId, uoId, secHeading } = message.data || {};
          if (!reqType || !this._sampleTreeProvider) break;

          const newId = generateSampleId(reqType);
          await this._sampleTreeProvider.addSample('local', reqType, newId, alias || null, description || null);

          const typeLower = reqType.toLowerCase();
          const definitionText = `- @${typeLower};${newId}${buildSampleDefSuffix(alias, description)}`;

          webviewPanel.webview.postMessage({
            type: 'sampleDefinitionCreated',
            data: { definitionText, opIndex, secIndex, opId, uoId, secHeading },
          });
          webviewPanel.webview.postMessage({
            type: 'sampleDefsUpdated',
            data: { sampleDefs: buildSampleDefMap(document.uri, getAvailableTypes()) },
          });
          break;
        }

        case 'searchProducts': {
          const { sampleType } = message.data || {};
          if (!sampleType) break;
          const docUri = document.uri;
          const picked = await showProductPicker(sampleType, docUri);
          if (picked) {
            webviewPanel.webview.postMessage({
              type: 'productSearchResult',
              data: { alias: picked.alias || '', description: picked.description || '' },
            });
          }
          break;
        }

        case 'addCustomType': {
          const { typeName } = message.data || {};
          if (!typeName) break;
          const config = vscode.workspace.getConfiguration('labnotev');
          const existing = config.get<string[]>('customSampleTypes', []);
          if (!existing.includes(typeName)) {
            const updated = [...existing, typeName];
            await config.update('customSampleTypes', updated, vscode.ConfigurationTarget.Workspace);
          }
          const updatedMeta = readSampleDisplayMeta();
          webviewPanel.webview.postMessage({
            type: 'customTypesUpdated',
            data: {
              availableTypes: updatedMeta.types,
              sampleTypeColors: updatedMeta.colors,
            },
          });
          break;
        }

        case 'openWorkflow': {
          const { link } = message.data || {};
          if (!link) break;
          const docDir = path.dirname(document.uri.fsPath);
          const wfPath = resolveContainedPath(docDir, link);
          if (wfPath && fs.existsSync(wfPath)) {
            await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(wfPath));
          } else {
            vscode.window.showWarningMessage(
              vscode.l10n.t('Workflow file not found: {0}', link)
            );
          }
          break;
        }

        case 'renumberWorkflows': {
          await vscode.commands.executeCommand('labnotev.renumberWorkflows', document.uri);
          break;
        }

        case 'pasteImage': {
          const { imageBase64, mimeType } = message.data || {};
          if (!imageBase64) break;
          const docDir = path.dirname(document.uri.fsPath);
          const imagesDir = path.join(docDir, 'images');
          if (!fs.existsSync(imagesDir)) {
            fs.mkdirSync(imagesDir, { recursive: true });
          }
          const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/gif' ? 'gif' : mimeType === 'image/webp' ? 'webp' : 'png';
          const timestamp = Date.now();
          const rand = Math.random().toString(36).substring(2, 6);
          const fileName = `img_${timestamp}_${rand}.${ext}`;
          const filePath = path.join(imagesDir, fileName);
          const buffer = Buffer.from(imageBase64, 'base64');
          fs.writeFileSync(filePath, buffer);
          const markdownText = `![](images/${fileName})`;
          webviewPanel.webview.postMessage({
            type: 'imagePasted',
            data: { markdownText },
          });
          break;
        }

        case 'attachFile': {
          const { area, opIndex, secIndex, sectionIndex, linkedWfIndex } = message.data || {};
          // Issue #20: webview sends the textarea caret position so we can
          // echo it back verbatim on `fileAttached`. Guard the value strictly
          // since postMessage round-trips through JSON serialisation.
          const rawCursor = (message.data as { cursorPos?: unknown } | undefined)?.cursorPos;
          const cursorPos = typeof rawCursor === 'number' && Number.isFinite(rawCursor) ? rawCursor : undefined;
          if (!area) break;
          const uris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            openLabel: vscode.l10n.t('Attach'),
          });
          if (!uris?.[0]) break;

          const docDir = path.dirname(document.uri.fsPath);
          const selectedPath = uris[0].fsPath;
          const baseName = path.basename(selectedPath);
          const resourcesDir = path.join(docDir, 'resources');

          let markdownLink: string;
          const inDocLink = buildInDocDirAttachmentMarkdownLink(docDir, selectedPath);
          if (inDocLink !== null) {
            markdownLink = inDocLink;
          } else {
            const attachDir = path.join(resourcesDir, 'attachments');
            fs.mkdirSync(attachDir, { recursive: true });
            const destPath = getUniqueAttachmentDestPath(attachDir, baseName);
            fs.copyFileSync(selectedPath, destPath);
            const destName = path.basename(destPath);
            markdownLink = formatAttachmentMarkdown(destName, `resources/attachments/${destName}`);
          }

          webviewPanel.webview.postMessage({
            type: 'fileAttached',
            data: {
              markdownLink,
              area,
              opIndex,
              secIndex,
              sectionIndex,
              linkedWfIndex,
              cursorPos,
            },
          });
          break;
        }

        case 'openAttachment': {
          const rel = message.data?.path;
          if (!rel || typeof rel !== 'string') break;
          const normalized = rel.replace(/\\/g, '/');
          if (normalized.includes('..')) {
            vscode.window.showWarningMessage(vscode.l10n.t('Invalid path.'));
            break;
          }
          const docDir = path.dirname(document.uri.fsPath);
          const absPath = path.resolve(docDir, rel);
          if (!isPathInsideDir(docDir, absPath)) {
            vscode.window.showWarningMessage(vscode.l10n.t('Cannot open files outside the document folder.'));
            break;
          }
          if (!fs.existsSync(absPath)) {
            vscode.window.showWarningMessage(vscode.l10n.t('File not found: {0}', rel));
            break;
          }
          await openAttachmentFile(vscode.Uri.file(absPath));
          break;
        }

        case 'copyUnitOp': {
          const payload = message.data?.payload;
          if (typeof payload !== 'string' || payload.length === 0) break;
          await vscode.env.clipboard.writeText(payload);
          vscode.window.setStatusBarMessage(
            vscode.l10n.t('Unit operation copied to clipboard'),
            2000,
          );
          break;
        }

        case 'requestPasteUnitOp': {
          const rawAfterIndex = (message.data as { afterOpIndex?: unknown } | undefined)?.afterOpIndex;
          const afterOpIndex = typeof rawAfterIndex === 'number' && Number.isFinite(rawAfterIndex)
            ? rawAfterIndex
            : -1;
          let text = '';
          try {
            text = await vscode.env.clipboard.readText();
          } catch {
            // fall through to validation, which will fail on empty string.
          }
          const unitOp = parseClipboardUnitOp(text);
          if (!unitOp) {
            vscode.window.showInformationMessage(
              vscode.l10n.t('Clipboard does not contain a Unit Operation.'),
            );
            break;
          }
          webviewPanel.webview.postMessage({
            type: 'unitOpPasted',
            data: { afterOpIndex, unitOp },
          });
          break;
        }

        case 'queryClipboardState': {
          let text = '';
          try {
            text = await vscode.env.clipboard.readText();
          } catch {
            // treat read failures as "no unit op on clipboard".
          }
          webviewPanel.webview.postMessage({
            type: 'clipboardStateUpdated',
            data: { hasUnitOp: parseClipboardUnitOp(text) !== null },
          });
          break;
        }

        case 'sendSelectionToChat': {
          await this.handleSendSelectionToChat(document, message.data);
          break;
        }
      }
      } catch (err) {
        // Surface unexpected failures instead of leaving an unhandled
        // promise rejection (file writes, clipboard, command dispatch, ...).
        vscode.window.showErrorMessage(
          vscode.l10n.t('Section Editor action failed: {0}', String(err))
        );
      }
    });

    webviewPanel.onDidChangeViewState(() => {
      if (webviewPanel.active) {
        this.activeEditor = { document, webviewPanel, mode };
        this._lastActiveEditor = this.activeEditor;
        if (document.uri.fsPath.endsWith('.labnote.md') && this._sampleTreeProvider) {
          const experimentFolder = path.dirname(document.uri.fsPath);
          this._sampleTreeProvider.updateDocumentFolder(experimentFolder);
        }
        // Re-sync the Paste below enablement whenever the user returns to
        // this webview (e.g. after copying a UnitOp in another app or
        // workflow). vscode.env.clipboard has no change event, so this is
        // the most natural moment to refresh without polling.
        void (async () => {
          let text = '';
          try { text = await vscode.env.clipboard.readText(); } catch {}
          webviewPanel.webview.postMessage({
            type: 'clipboardStateUpdated',
            data: { hasUnitOp: parseClipboardUnitOp(text) !== null },
          });
        })();
      } else if (this.activeEditor?.document === document) {
        // Only clear `activeEditor`; keep `_lastActiveEditor` so TreeView
        // inserts still target the last webview the user was editing.
        this.activeEditor = undefined;
      }
    });

    webviewPanel.onDidDispose(() => {
      if (this.activeEditor?.document === document) {
        this.activeEditor = undefined;
      }
      if (this._lastActiveEditor?.document === document) {
        this._lastActiveEditor = undefined;
      }
      for (const editor of this._allEditors) {
        if (editor.webviewPanel === webviewPanel) {
          this._allEditors.delete(editor);
          break;
        }
      }
    });

    const changeSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (this._suppressedDocs.has(e.document.uri.toString())) return;
      if (e.document.uri.toString() === document.uri.toString() && e.contentChanges.length > 0) {
        const newContent = e.document.getText();
        if (mode === 'labnote') {
          const labNote = parseLabNoteMd(newContent);
          webviewPanel.webview.postMessage({
            type: 'documentChanged',
            data: { labNote },
          });
        } else if (mode === 'workflow') {
          const workflow = parseWorkflowMd(newContent);
          webviewPanel.webview.postMessage({
            type: 'documentChanged',
            data: { workflow },
          });
        }
      }
    });

    webviewPanel.onDidDispose(() => {
      changeSubscription.dispose();
    });
  }

  private async sendInitMessage(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    mode: MdFileType
  ): Promise<void> {
    const content = document.getText();

    const docDir = path.dirname(document.uri.fsPath);
    const docBaseUri = webviewPanel.webview.asWebviewUri(vscode.Uri.file(docDir)).toString();

    if (mode === 'labnote') {
      const labNote = parseLabNoteMd(content);

      const linkedWorkflows: any[] = [];
      const wfSection = labNote.sections.find(s => s.type === 'workflows');
      if (wfSection?.type === 'workflows') {
        for (const item of wfSection.items) {
          // Constrain the webview-supplied link to the document folder so a
          // crafted `.labnote.md` cannot read arbitrary files (mirrors the
          // openWorkflow / openImagePreview / writeChangedWorkflows guards).
          const wfPath = resolveContainedPath(docDir, item.link);
          if (wfPath && fs.existsSync(wfPath)) {
            const wfContent = fs.readFileSync(wfPath, 'utf8');
            linkedWorkflows.push(parseWorkflowMd(wfContent));
          }
        }
      }

      const meta = readSampleDisplayMeta();
      webviewPanel.webview.postMessage({
        type: 'init',
        data: {
          mode,
          labNote,
          linkedWorkflows,
          docBaseUri,
          availableTypes: meta.types,
          sampleTypeColors: meta.colors,
          sampleDefs: buildSampleDefMap(document.uri, meta.types),
        },
      });
    } else if (mode === 'workflow') {
      const workflow = parseWorkflowMd(content);
      const readmePath = path.join(docDir, 'README.labnote.md');
      const parentLabNotePath = fs.existsSync(readmePath) ? 'README.labnote.md' : undefined;

      const meta = readSampleDisplayMeta();
      webviewPanel.webview.postMessage({
        type: 'init',
        data: {
          mode,
          workflow,
          parentLabNotePath,
          docBaseUri,
          availableTypes: meta.types,
          sampleTypeColors: meta.colors,
          sampleDefs: buildSampleDefMap(document.uri, meta.types),
        },
      });
    }
  }

  private async handleSave(
    document: vscode.TextDocument,
    data: any,
    mode: MdFileType
  ): Promise<void> {
    const docKey = document.uri.toString();
    this._suppressedDocs.add(docKey);
    try {
      if (mode === 'labnote' && data.labNote) {
        data.labNote.frontMatter.last_updated_date = new Date().toISOString().split('T')[0];
        const newContent = serializeLabNoteMd(data.labNote);
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(document.getText().length)
        );
        edit.replace(document.uri, fullRange, newContent);
        await vscode.workspace.applyEdit(edit);
        await document.save();

        if (data.changedWorkflows) {
          this.writeChangedWorkflows(document, data.changedWorkflows);
        }
      } else if (mode === 'workflow' && data.workflow) {
        data.workflow.frontMatter.last_updated_date = new Date().toISOString().split('T')[0];
        const newContent = serializeWorkflowMd(data.workflow);
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(document.getText().length)
        );
        edit.replace(document.uri, fullRange, newContent);
        await vscode.workspace.applyEdit(edit);
        await document.save();

        this.syncWorkflowTitleToReadme(document, data.workflow.workflowHeader);
      }
    } finally {
      this._suppressedDocs.delete(docKey);
    }
  }

  /**
   * Persist edited linked-workflow files referenced from a README save. Each
   * `link` is a webview-supplied relative path, so it is constrained to the
   * document folder via `resolveContainedPath` before writing — a crafted
   * `link` (`../`, absolute path) is skipped rather than written.
   */
  writeChangedWorkflows(
    document: vscode.TextDocument,
    changedWorkflows: Array<{ link?: string; workflow?: unknown }>
  ): void {
    const dir = path.dirname(document.uri.fsPath);
    for (const cw of changedWorkflows) {
      if (!cw.link || !cw.workflow) continue;
      const wfPath = resolveContainedPath(dir, cw.link);
      if (!wfPath) {
        console.warn(`[labnotev] Skipped workflow write outside document folder: ${cw.link}`);
        continue;
      }
      const wfContent = serializeWorkflowMd(cw.workflow as Parameters<typeof serializeWorkflowMd>[0]);
      fs.writeFileSync(wfPath, wfContent, 'utf8');
    }
  }

  private syncWorkflowTitleToReadme(document: vscode.TextDocument, workflowHeader: string): void {
    try {
      const docDir = path.dirname(document.uri.fsPath);
      const readmePath = path.join(docDir, 'README.labnote.md');
      if (!fs.existsSync(readmePath)) return;

      const readmeContent = fs.readFileSync(readmePath, 'utf8');
      const workflowFileName = path.basename(document.uri.fsPath);
      const items = parseWorkflowChecklistFromReadme(readmeContent);
      const itemIndex = items.findIndex(item => item.fileName === workflowFileName);
      if (itemIndex < 0) return;

      const bracketMatch = workflowHeader.match(/^\[(.+?)\]\s*(.*)/);
      if (!bracketMatch) return;

      const idName = bracketMatch[1];
      const desc = bracketMatch[2]?.trim();
      const seq = workflowFileName.match(/^(\d{3})_/)?.[1] || '';
      const newTitle = desc ? `${seq} ${idName} - ${desc}` : `${seq} ${idName}`;

      if (items[itemIndex].title === newTitle) return;

      items[itemIndex].title = newTitle;
      const newChecklist = generateWorkflowChecklist(items);
      const updatedReadme = updateReadmeWorkflowSection(readmeContent, newChecklist);
      fs.writeFileSync(readmePath, updatedReadme, 'utf8');
    } catch {
      // non-critical: silently ignore sync failures
    }
  }

  /**
   * Try to scroll the active (or last-active) Section Editor webview to the
   * `@type;ID...` definition of the given sample. Returns true if a definition
   * was located AND a `scrollToSample` message was posted to the webview.
   *
   * Intentionally does NOT open a text editor — this is meant for the
   * "stay inside the Section Editor" navigation flow used by both the
   * TreeView's Move to Definition command and the webview's sample-click
   * fallback in `navigateToSample`.
   */
  public tryScrollActiveWebviewToDefinition(
    sampleType: string,
    sampleId: string,
    alias?: string | null
  ): boolean {
    const editor = this.activeEditor ?? this._lastActiveEditor;
    if (!editor) return false;
    const docText = editor.document.getText();
    const defMatch = findSampleDefinitionOnlyMatch(docText, sampleType, sampleId, alias);
    if (!defMatch) return false;
    const loc = this.findSectionForOffset(docText, defMatch.start, editor.mode);
    if (!loc) return false;
    editor.webviewPanel.webview.postMessage({ type: 'scrollToSample', data: loc });
    return true;
  }

  public findSectionForOffset(
    docText: string,
    offset: number,
    mode: MdFileType
  ): { area: string; sectionIndex?: number; opIndex?: number; secIndex?: number; localOffset: number } | null {
    if (mode === 'labnote') {
      const labNote = parseLabNoteMd(docText);
      for (let i = 0; i < labNote.sections.length; i++) {
        const sec = labNote.sections[i];
        if (sec.type === 'objective' || sec.type === 'results' || sec.type === 'freeform') {
          const idx = docText.indexOf(sec.content);
          if (idx >= 0 && offset >= idx && offset < idx + sec.content.length) {
            return { area: 'section', sectionIndex: i, localOffset: offset - idx };
          }
        }
      }
    } else if (mode === 'workflow') {
      const workflow = parseWorkflowMd(docText);
      for (let opI = 0; opI < workflow.unitOperations.length; opI++) {
        const op = workflow.unitOperations[opI];
        for (let secI = 0; secI < op.sections.length; secI++) {
          const sec = op.sections[secI];
          const idx = docText.indexOf(sec.content);
          if (idx >= 0 && offset >= idx && offset < idx + sec.content.length) {
            return { area: 'unitOp', opIndex: opI, secIndex: secI, localOffset: offset - idx };
          }
        }
      }
      if (workflow.tailContent) {
        const idx = docText.indexOf(workflow.tailContent);
        if (idx >= 0 && offset >= idx && offset < idx + workflow.tailContent.length) {
          return { area: 'tail', localOffset: offset - idx };
        }
      }
    }
    return null;
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const distUri = vscode.Uri.joinPath(this.context.extensionUri, 'webview-section', 'dist');
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'index.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'index.css'));
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource};">
  <link rel="stylesheet" href="${styleUri}">
  <title>Section Editor</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
