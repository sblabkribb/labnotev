import * as vscode from 'vscode';
import { SAMPLE_TYPES, SampleType, sampleTypeColors, buildSampleIdPattern } from '../lib/sampleUtils';
import { extractSampleInfoFromText as extractFromStorage, SampleInfo, parseSampleTracking } from '../lib/sampleStorage';
import { escapeRegExp } from '../lib/regexUtils';
import { josa, withJosa } from '../lib/josa';

/**
 * Sample display information with all metadata
 */
export interface SampleDisplayInfo {
  id: string;
  type: string;
  alias: string | null;
  description: string | null;
  sources: string[];
}

/**
 * Extract sample IDs from text (simple extraction)
 */
export function extractSampleIdsFromText(text: string): string[] {
  const sampleIds: string[] = [];

  for (const type of SAMPLE_TYPES) {
    // Phase A-3: use the canonical segment (?:-\d+)* so multi-counter ids
    // (DNA-1737000000000-3) are captured consistently with highlighting/storage.
    const pattern = buildSampleIdPattern(type);
    let match;
    while ((match = pattern.exec(text)) !== null) {
      sampleIds.push(match[0]);
    }
  }

  return sampleIds;
}

/**
 * Extract sample info with alias and description from text
 * Re-exports from sampleStorage for use in panel
 */
export function extractSampleInfoFromText(text: string): SampleInfo[] {
  return extractFromStorage(text);
}

/**
 * Find the location (line, character) of a sample ID in text
 */
export function findSampleLocation(text: string, sampleId: string): { line: number; character: number } | null {
  const lines = text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const charIndex = lines[i].indexOf(sampleId);
    if (charIndex !== -1) {
      return { line: i, character: charIndex };
    }
  }
  
  return null;
}

/**
 * Generate HTML for sample list (simple version)
 */
export function generateSampleListHtml(sampleIds: string[]): string {
  if (sampleIds.length === 0) {
    return `
      <div class="no-samples">
        <p>현재 문서에서 샘플 ID를 찾을 수 없습니다.</p>
      </div>
    `;
  }

  const sampleListItems = sampleIds.map(id => {
    const type = id.split('-')[0] as SampleType;
    const color = sampleTypeColors[type] || '#888888';
    return `
      <li class="sample-item">
        <span class="sample-badge" style="background-color: ${color}99; border: 1px solid ${color};">
          ${escapeHtml(type)}
        </span>
        <span class="sample-id">${escapeHtml(id)}</span>
      </li>
    `;
  }).join('');

  return `
    <div class="sample-list">
      <h3>샘플 ID (${sampleIds.length})</h3>
      <ul>
        ${sampleListItems}
      </ul>
    </div>
  `;
}

/**
 * Generate HTML for sample info with alias, description, and action buttons
 */
export function generateSampleInfoHtml(samples: SampleDisplayInfo[]): string {
  if (samples.length === 0) {
    return `
      <div class="no-samples">
        <p>현재 문서에서 샘플 ID를 찾을 수 없습니다.</p>
      </div>
    `;
  }

  const sampleListItems = samples.map(sample => {
    const color = sampleTypeColors[sample.type as SampleType] || '#888888';
    const aliasHtml = sample.alias ? `<span class="sample-alias">(${escapeHtml(sample.alias)})</span>` : '';
    const descHtml = sample.description ? `<p class="sample-description">${escapeHtml(sample.description)}</p>` : '';
    const sourcesHtml = sample.sources.length > 0
      ? `<p class="sample-sources">출처: ${sample.sources.map(s => escapeHtml(s)).join(', ')}</p>`
      : '';

    return `
      <li class="sample-item" data-id="${escapeHtml(sample.id)}" data-type="${escapeHtml(sample.type)}">
        <div class="sample-header">
          <span class="sample-badge" style="background-color: ${color}99; border: 1px solid ${color};">
            ${escapeHtml(sample.type)}
          </span>
          <span class="sample-id">${escapeHtml(sample.id)}</span>
          ${aliasHtml}
        </div>
        ${descHtml}
        ${sourcesHtml}
        <div class="sample-actions">
          <button class="action-btn goto-btn" data-action="goto" data-id="${escapeHtml(sample.id)}">위치로 이동</button>
          <button class="action-btn rename-btn" data-action="rename" data-id="${escapeHtml(sample.id)}">이름 변경</button>
          <button class="action-btn replace-btn" data-action="replace" data-id="${escapeHtml(sample.id)}" data-type="${escapeHtml(sample.type)}">다른 ID로 교체</button>
        </div>
      </li>
    `;
  }).join('');

  return `
    <div class="sample-list">
      <h3>샘플 ID (${samples.length})</h3>
      <ul>
        ${sampleListItems}
      </ul>
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Manages the Sample Info webview panel
 */
export class SampleInfoPanel {
  public static readonly viewType = 'labnotev.sampleInfo';
  private static currentPanel: SampleInfoPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _currentDocUri: vscode.Uri | undefined;

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Set initial HTML
    this._panel.webview.html = this._getHtmlForWebview([]);

    // Handle panel disposal
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Update content when panel becomes visible
    this._panel.onDidChangeViewState(
      () => {
        if (this._panel.visible) {
          this._updateFromActiveEditor();
        }
      },
      null,
      this._disposables
    );

    // Handle messages from webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        await this._handleMessage(message);
      },
      null,
      this._disposables
    );
  }

  /**
   * Handle messages from webview
   */
  private async _handleMessage(message: { command: string; id?: string; type?: string }): Promise<void> {
    switch (message.command) {
      case 'goto': {
        if (!message.id || !this._currentDocUri) return;
        await this._goToSample(message.id);
        break;
      }
      case 'rename': {
        if (!message.id || !this._currentDocUri) return;
        await this._renameSample(message.id);
        break;
      }
      case 'replace': {
        if (!message.id || !message.type || !this._currentDocUri) return;
        await this._replaceSample(message.id, message.type);
        break;
      }
    }
  }

  /**
   * Navigate to sample location in document
   */
  private async _goToSample(sampleId: string): Promise<void> {
    if (!this._currentDocUri) return;

    const doc = await vscode.workspace.openTextDocument(this._currentDocUri);
    const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
    
    const location = findSampleLocation(doc.getText(), sampleId);
    if (location) {
      const position = new vscode.Position(location.line, location.character);
      const range = new vscode.Range(position, position.translate(0, sampleId.length));
      editor.selection = new vscode.Selection(range.start, range.end);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    }
  }

  /**
   * Rename sample ID
   */
  private async _renameSample(oldId: string): Promise<void> {
    if (!this._currentDocUri) return;

    const newId = await vscode.window.showInputBox({
      prompt: `${withJosa(oldId, '을/를')} 새로운 ID로 변경`,
      value: oldId,
      validateInput: (value) => {
        if (!value || value.trim() === '') return 'ID를 입력하세요';
        if (value === oldId) return '다른 ID를 입력하세요';
        return null;
      }
    });

    if (!newId) return;

    const doc = await vscode.workspace.openTextDocument(this._currentDocUri);
    const text = doc.getText();
    const newText = text.replace(new RegExp(`\\b${escapeRegExp(oldId)}\\b`, 'g'), newId);

    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      this._currentDocUri,
      new vscode.Range(doc.positionAt(0), doc.positionAt(text.length)),
      newText
    );
    await vscode.workspace.applyEdit(edit);
    await doc.save();

    vscode.window.showInformationMessage(`${oldId} → ${newId}${josa(newId, '으로/로')} 변경되었습니다.`);
    this._updateFromActiveEditor();
  }

  /**
   * Replace sample ID with existing ID
   */
  private async _replaceSample(oldId: string, type: string): Promise<void> {
    if (!this._currentDocUri) return;

    const doc = await vscode.workspace.openTextDocument(this._currentDocUri);
    const text = doc.getText();

    // Extract all IDs of the same type. Phase A-3 unifies the segment to (?:-\d+)*
    // so collision-resolved IDs like DNA-1700000000000-3 are surfaced for replacement.
    const pattern = new RegExp(`\\b${escapeRegExp(type)}-\\d+(?:-\\d+)*\\b`, 'g');
    const existingIds = [...new Set(text.match(pattern) || [])].filter(id => id !== oldId);

    if (existingIds.length === 0) {
      vscode.window.showWarningMessage(`교체할 다른 ${type} ID가 없습니다.`);
      return;
    }

    const selectedId = await vscode.window.showQuickPick(existingIds, {
      placeHolder: `${withJosa(oldId, '을/를')} 대체할 ID 선택`
    });

    if (!selectedId) return;

    const newText = text.replace(new RegExp(`\\b${escapeRegExp(oldId)}\\b`, 'g'), selectedId);

    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      this._currentDocUri,
      new vscode.Range(doc.positionAt(0), doc.positionAt(text.length)),
      newText
    );
    await vscode.workspace.applyEdit(edit);
    await doc.save();

    vscode.window.showInformationMessage(`${oldId} → ${selectedId}${josa(selectedId, '으로/로')} 교체되었습니다.`);
    this._updateFromActiveEditor();
  }

  /**
   * Create or show the Sample Info panel
   */
  public static createOrShow(extensionUri: vscode.Uri): SampleInfoPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : vscode.ViewColumn.One;

    // If we already have a panel, show it
    if (SampleInfoPanel.currentPanel) {
      SampleInfoPanel.currentPanel._panel.reveal(column);
      SampleInfoPanel.currentPanel._updateFromActiveEditor();
      return SampleInfoPanel.currentPanel;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      SampleInfoPanel.viewType,
      '샘플 정보',
      column,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
      }
    );

    SampleInfoPanel.currentPanel = new SampleInfoPanel(panel, extensionUri);
    return SampleInfoPanel.currentPanel;
  }

  /**
   * Update the panel content
   */
  public updateContent(sampleIds: string[]): void {
    this._panel.webview.html = this._getHtmlForWebview(sampleIds);
  }

  /**
   * Update the panel content with full sample info
   */
  public updateContentWithInfo(samples: SampleDisplayInfo[]): void {
    this._panel.webview.html = this._getHtmlForWebviewWithInfo(samples);
  }

  private _updateFromActiveEditor(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'markdown') {
      this._currentDocUri = editor.document.uri;
      const text = editor.document.getText();
      
      // Check if Sample Tracking is enabled
      if (!parseSampleTracking(text)) {
        this._panel.webview.html = this._wrapHtml(`
          <div class="no-samples">
            <p>Sample Tracking이 비활성화되어 있습니다.</p>
            <p style="font-size: 0.9em; margin-top: 16px;">
              YAML front matter에 다음을 추가하세요:<br>
              <code style="background: var(--vscode-textCodeBlock-background); padding: 2px 6px; border-radius: 4px;">Sample Tracking: Yes</code>
            </p>
          </div>
        `);
        return;
      }
      
      const samples = extractSampleInfoFromText(text);
      
      // Convert SampleInfo to SampleDisplayInfo
      const displaySamples: SampleDisplayInfo[] = samples.map(s => ({
        id: s.id,
        type: s.type,
        alias: s.alias,
        description: s.description,
        sources: []
      }));
      
      this.updateContentWithInfo(displaySamples);
    }
  }

  private _getHtmlForWebview(sampleIds: string[]): string {
    const sampleListHtml = generateSampleListHtml(sampleIds);
    return this._wrapHtml(sampleListHtml);
  }

  private _getHtmlForWebviewWithInfo(samples: SampleDisplayInfo[]): string {
    const sampleListHtml = generateSampleInfoHtml(samples);
    return this._wrapHtml(sampleListHtml);
  }

  private _wrapHtml(content: string): string {
    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>샘플 정보</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 16px;
      margin: 0;
    }
    h3 {
      margin-top: 0;
      color: var(--vscode-foreground);
      border-bottom: 1px solid var(--vscode-widget-border);
      padding-bottom: 8px;
    }
    .sample-list ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .sample-item {
      padding: 12px;
      border-bottom: 1px solid var(--vscode-widget-border);
    }
    .sample-item:hover {
      background-color: var(--vscode-list-hoverBackground);
    }
    .sample-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .sample-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.8em;
      font-weight: bold;
      color: #000;
    }
    .sample-id {
      font-family: var(--vscode-editor-font-family);
      font-weight: bold;
    }
    .sample-alias {
      color: var(--vscode-descriptionForeground);
      margin-left: 8px;
    }
    .sample-description, .sample-sources {
      font-size: 0.9em;
      color: var(--vscode-descriptionForeground);
      margin: 4px 0 4px 0;
      padding-left: 4px;
    }
    .sample-actions {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }
    .action-btn {
      padding: 4px 12px;
      border: 1px solid var(--vscode-button-border);
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85em;
    }
    .action-btn:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }
    .goto-btn {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .goto-btn:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    .no-samples {
      text-align: center;
      color: var(--vscode-descriptionForeground);
      padding: 32px;
    }
  </style>
</head>
<body>
  ${content}
  <script>
    const vscode = acquireVsCodeApi();
    
    document.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        const type = btn.dataset.type;
        vscode.postMessage({ command: action, id, type });
      });
    });
  </script>
</body>
</html>`;
  }

  public dispose(): void {
    SampleInfoPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
