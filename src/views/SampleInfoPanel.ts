import * as vscode from 'vscode';
import { SAMPLE_TYPES, SampleType } from '../labsample/constants/appConstants';
import { sampleTypeColors } from '../labsample/constants/decorations';

/**
 * Extract sample IDs from text
 */
export function extractSampleIdsFromText(text: string): string[] {
  const sampleIds: string[] = [];
  
  for (const type of SAMPLE_TYPES) {
    // Pattern: TYPE-{digits} (e.g., DNA-1737123456789)
    const pattern = new RegExp(`\\b${type}-\\d+\\b`, 'g');
    let match;
    while ((match = pattern.exec(text)) !== null) {
      sampleIds.push(match[0]);
    }
  }
  
  return sampleIds;
}

/**
 * Generate HTML for sample list
 */
export function generateSampleListHtml(sampleIds: string[]): string {
  if (sampleIds.length === 0) {
    return `
      <div class="no-samples">
        <p>No sample IDs found in the current document.</p>
      </div>
    `;
  }

  const sampleListItems = sampleIds.map(id => {
    const type = id.split('-')[0] as SampleType;
    const color = sampleTypeColors[type] || '#888888';
    return `
      <li class="sample-item">
        <span class="sample-badge" style="background-color: ${color}99; border: 1px solid ${color};">
          ${type}
        </span>
        <span class="sample-id">${id}</span>
      </li>
    `;
  }).join('');

  return `
    <div class="sample-list">
      <h3>Sample IDs (${sampleIds.length})</h3>
      <ul>
        ${sampleListItems}
      </ul>
    </div>
  `;
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
      'Sample Info',
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

  private _updateFromActiveEditor(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'markdown') {
      const text = editor.document.getText();
      const sampleIds = extractSampleIdsFromText(text);
      this.updateContent(sampleIds);
    }
  }

  private _getHtmlForWebview(sampleIds: string[]): string {
    const sampleListHtml = generateSampleListHtml(sampleIds);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sample Info</title>
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
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border-bottom: 1px solid var(--vscode-widget-border);
    }
    .sample-item:hover {
      background-color: var(--vscode-list-hoverBackground);
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
    }
    .no-samples {
      text-align: center;
      color: var(--vscode-descriptionForeground);
      padding: 32px;
    }
  </style>
</head>
<body>
  ${sampleListHtml}
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
