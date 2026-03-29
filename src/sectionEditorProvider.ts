import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parseLabNoteMd, serializeLabNoteMd } from './lib/labnoteSectionParser';
import { parseWorkflowMd, serializeWorkflowMd } from './lib/workflowSectionParser';
import type { UnitOperationBlock, WorkflowReference } from './lib/sectionTypes';
import { getSeoulDateTimeString } from './lib/dateUtils';
import { SAMPLE_TYPES, generateSampleId } from './lib/sampleUtils';
import { findSampleDefinitionMatch } from './lib/sampleStorage';
import { showProductPicker } from './lib/productPicker';
import { parseWorkflowChecklistFromReadme, generateWorkflowChecklist, updateReadmeWorkflowSection } from './lib/workflowStructure';
import type { SampleTreeViewProvider } from './views/SampleTreeViewProvider';

export type MdFileType = 'labnote' | 'workflow' | 'unknown';

export function detectMdFileType(content: string): MdFileType {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return 'unknown';
  const yaml = fmMatch[1];
  if (/experiment_type:\s*labnote/i.test(yaml)) return 'labnote';
  if (/experimenter:/i.test(yaml)) return 'workflow';
  return 'unknown';
}

function getAvailableTypes(): string[] {
  const custom = vscode.workspace.getConfiguration('labnotev').get<string[]>('customSampleTypes', []);
  return [...SAMPLE_TYPES, ...custom.filter(t => !(SAMPLE_TYPES as readonly string[]).includes(t))];
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

  const metaContent = opType === 'sw'
    ? `- Experimenter: ${experimenter}\n- Start_date: '${dateTime}'\n- End_date: ''\n- Software:`
    : `- Experimenter: ${experimenter}\n- Start_date: '${dateTime}'\n- End_date: ''`;

  const sections = opType === 'sw'
    ? [
        { heading: 'Meta', content: metaContent },
        { heading: 'Input', content: '- (이전 단계 산출물, 데이터, 모델)' },
        { heading: 'Output', content: '- (다음 단계로 넘어갈 산출물: 파일, 데이터셋, 모델)' },
        { heading: 'Parameters', content: '- (옵션, 하이퍼파라미터, seed)' },
        { heading: 'QC Metrics', content: '- (성능 지표, QC 지표)' },
        { heading: 'Method', content: '- (소프트웨어/모델 + 자연어 설명)' },
        { heading: 'Environment', content: '- (conda / poetry / container / OS / HW)' },
        { heading: 'Discussion', content: '- (다음 단계에 대한 코멘트)' },
      ]
    : [
        { heading: 'Meta', content: metaContent },
        { heading: 'Input', content: '- (samples from the previous step)' },
        { heading: 'Reagent', content: '- (e.g. enzyme, buffer, etc.)' },
        { heading: 'Consumables', content: '- (e.g. filter, well-plate, etc.)' },
        { heading: 'Equipment', content: '- (e.g. centrifuge, spectrophotometer, etc.)' },
        { heading: 'Method', content: '- (method used in this step)' },
        { heading: 'Output', content: '- (samples to the next step)' },
        { heading: 'Results & Discussions', content: '- (Any results and discussions. Link file path if needed)' },
      ];

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
  private _suppressDocChange = false;
  private _sampleTreeProvider: SampleTreeViewProvider | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public setSampleTreeProvider(provider: SampleTreeViewProvider): void {
    this._sampleTreeProvider = provider;
  }

  public getActiveDocument(): vscode.TextDocument | undefined {
    return this.activeEditor?.document;
  }

  public getEditorMode(): MdFileType | undefined {
    return this.activeEditor?.mode;
  }

  public getDocumentFolder(): string | undefined {
    if (!this.activeEditor) return undefined;
    return path.dirname(this.activeEditor.document.uri.fsPath);
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
    this._suppressDocChange = true;
    try {
      await vscode.workspace.applyEdit(edit);
    } finally {
      this._suppressDocChange = false;
    }

    if (this.activeEditor?.document === document) {
      this.activeEditor.webviewPanel.webview.postMessage({
        type: 'unitOpAdded',
        data: unitOp,
      });
    }
  }

  public async insertSampleIntoDocument(
    document: vscode.TextDocument,
    sampleText: string
  ): Promise<void> {
    if (this.activeEditor?.document === document) {
      this.activeEditor.webviewPanel.webview.postMessage({
        type: 'sampleInserted',
        data: { text: sampleText },
      });
    }
  }

  public async insertTextToActiveEditor(text: string): Promise<void> {
    if (this.activeEditor) {
      this.activeEditor.webviewPanel.webview.postMessage({
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

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'webview-section', 'dist'),
        vscode.Uri.file(path.dirname(document.uri.fsPath)),
      ],
    };

    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'ready':
          await this.sendInitMessage(document, webviewPanel, mode);
          break;

        case 'save':
          await this.handleSave(document, message.data, mode);
          webviewPanel.webview.postMessage({ type: 'saveCompleted' });
          break;

        case 'openAsText':
          await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
          break;

        case 'openImagePreview':
          if (message.data?.imagePath) {
            const dir = path.dirname(document.uri.fsPath);
            const imagePath = path.resolve(dir, message.data.imagePath);
            await vscode.commands.executeCommand(
              'labnotev.openImagePreview',
              vscode.Uri.file(imagePath)
            );
          }
          break;

        case 'navigateToSample': {
          const { sampleId, sampleType } = message.data || {};
          if (!sampleId || !sampleType) break;

          const docText = document.getText();
          const defMatch = findSampleDefinitionMatch(docText, sampleType, sampleId);
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
          await vscode.commands.executeCommand(
            'labnotev.moveToDefinition',
            sampleType,
            sampleId
          );
          break;
        }

        case 'createSampleFromModal': {
          const { sampleType: reqType, alias, description, opIndex, secIndex } = message.data || {};
          if (!reqType || !this._sampleTreeProvider) break;

          const newId = generateSampleId(reqType);
          await this._sampleTreeProvider.addSample('local', reqType, newId, alias || null, description || null);

          const typeLower = reqType.toLowerCase();
          let definitionText = `- @${typeLower};${newId}`;
          if (alias) definitionText += `;${alias}`;
          if (description) definitionText += `;${description}`;

          webviewPanel.webview.postMessage({
            type: 'sampleDefinitionCreated',
            data: { definitionText, opIndex, secIndex },
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
          webviewPanel.webview.postMessage({
            type: 'customTypesUpdated',
            data: { availableTypes: getAvailableTypes() },
          });
          break;
        }

        case 'openWorkflow': {
          const { link } = message.data || {};
          if (!link) break;
          const docDir = path.dirname(document.uri.fsPath);
          const wfPath = path.resolve(docDir, link);
          if (fs.existsSync(wfPath)) {
            await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(wfPath));
          } else {
            vscode.window.showWarningMessage(`워크플로 파일을 찾을 수 없습니다: ${link}`);
          }
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
      }
    });

    webviewPanel.onDidChangeViewState(() => {
      if (webviewPanel.active) {
        this.activeEditor = { document, webviewPanel, mode };
      } else if (this.activeEditor?.document === document) {
        this.activeEditor = undefined;
      }
    });

    webviewPanel.onDidDispose(() => {
      if (this.activeEditor?.document === document) {
        this.activeEditor = undefined;
      }
    });

    const changeSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (this._suppressDocChange) return;
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
          const wfPath = path.resolve(docDir, item.link);
          if (fs.existsSync(wfPath)) {
            const wfContent = fs.readFileSync(wfPath, 'utf8');
            linkedWorkflows.push(parseWorkflowMd(wfContent));
          }
        }
      }

      webviewPanel.webview.postMessage({
        type: 'init',
        data: { mode, labNote, linkedWorkflows, docBaseUri, availableTypes: getAvailableTypes() },
      });
    } else if (mode === 'workflow') {
      const workflow = parseWorkflowMd(content);
      const readmePath = path.join(docDir, 'README.labnote.md');
      const parentLabNotePath = fs.existsSync(readmePath) ? 'README.labnote.md' : undefined;

      webviewPanel.webview.postMessage({
        type: 'init',
        data: { mode, workflow, parentLabNotePath, docBaseUri, availableTypes: getAvailableTypes() },
      });
    }
  }

  private async handleSave(
    document: vscode.TextDocument,
    data: any,
    mode: MdFileType
  ): Promise<void> {
    this._suppressDocChange = true;
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
          const dir = path.dirname(document.uri.fsPath);
          for (const cw of data.changedWorkflows) {
            if (cw.link && cw.workflow) {
              const wfPath = path.resolve(dir, cw.link);
              const wfContent = serializeWorkflowMd(cw.workflow);
              fs.writeFileSync(wfPath, wfContent, 'utf8');
            }
          }
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
      this._suppressDocChange = false;
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

  private findSectionForOffset(
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
