import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Image link information extracted from text
 */
export interface ImageLink {
  path: string;
  alt: string;
  line: number;
  character: number;
}

/**
 * Extract image links from markdown text
 */
export function extractImageLinksFromText(text: string): ImageLink[] {
  const links: ImageLink[] = [];
  const lines = text.split('\n');
  
  // Pattern: ![alt text](image path)
  const pattern = /!\[([^\]]*)\]\(([^)]+)\)/g;
  
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    let match;
    
    while ((match = pattern.exec(line)) !== null) {
      const imagePath = match[2];
      // Check if it's an image file (common extensions)
      if (/\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/i.test(imagePath)) {
        links.push({
          path: imagePath,
          alt: match[1],
          line: lineNum,
          character: match.index,
        });
      }
    }
    
    // Reset regex lastIndex for next line
    pattern.lastIndex = 0;
  }
  
  return links;
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
 * Generate HTML for image preview panel
 */
function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}

export function generateImagePreviewHtml(
  imageUri: string,
  altText: string,
  cspSource = ''
): string {
  const escapedAlt = escapeHtml(altText || 'Image');
  const nonce = getNonce();
  const csp = [
    `default-src 'none'`,
    `img-src ${cspSource} data:`,
    `style-src 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedAlt}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: var(--vscode-font-family);
      background-color: var(--vscode-editor-background);
      color: var(--vscode-foreground);
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    
    .toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 16px;
      background-color: var(--vscode-titleBar-activeBackground);
      border-bottom: 1px solid var(--vscode-widget-border);
      flex-shrink: 0;
    }
    
    .title {
      font-size: 14px;
      font-weight: 500;
      color: var(--vscode-titleBar-activeForeground);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: calc(100% - 100px);
    }
    
    .close-btn {
      padding: 6px 16px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: background-color 0.2s;
    }
    
    .close-btn:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    
    .image-container {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 16px;
      overflow: auto;
      background: repeating-conic-gradient(
        var(--vscode-editor-background) 0% 25%,
        var(--vscode-editorWidget-background) 0% 50%
      ) 50% / 20px 20px;
    }
    
    .preview-image {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      border-radius: 4px;
    }
    
    .error-message {
      text-align: center;
      color: var(--vscode-errorForeground);
      padding: 32px;
    }
    
    .zoom-controls {
      display: flex;
      gap: 8px;
      align-items: center;
    }
    
    .zoom-btn {
      padding: 4px 8px;
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--vscode-button-border);
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    
    .zoom-btn:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }
    
    .zoom-level {
      font-size: 12px;
      min-width: 50px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <span class="title" title="${escapedAlt}">${escapedAlt}</span>
    <div class="zoom-controls">
      <button class="zoom-btn" id="zoomOutBtn">−</button>
      <span class="zoom-level" id="zoomLevel">100%</span>
      <button class="zoom-btn" id="zoomInBtn">+</button>
      <button class="zoom-btn" id="resetBtn">Reset</button>
      <button class="close-btn" id="closeBtn">Close</button>
    </div>
  </div>
  <div class="image-container" id="imageContainer">
    <img 
      src="${imageUri}" 
      alt="${escapedAlt}" 
      class="preview-image" 
      id="previewImage"
    />
  </div>
  
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const image = document.getElementById('previewImage');
    let currentZoom = 100;
    
    function closePanel() {
      vscode.postMessage({ command: 'close' });
    }
    
    function zoomIn() {
      if (currentZoom < 400) {
        currentZoom += 25;
        updateZoom();
      }
    }
    
    function zoomOut() {
      if (currentZoom > 25) {
        currentZoom -= 25;
        updateZoom();
      }
    }
    
    function resetZoom() {
      currentZoom = 100;
      updateZoom();
    }
    
    function updateZoom() {
      image.style.transform = 'scale(' + (currentZoom / 100) + ')';
      document.getElementById('zoomLevel').textContent = currentZoom + '%';
    }
    
    function handleImageError() {
      document.getElementById('imageContainer').innerHTML = 
        '<div class="error-message"><p>Failed to load the image.</p></div>';
    }

    // Wire up controls without inline handlers (CSP-compatible)
    image.addEventListener('error', handleImageError);
    document.getElementById('zoomOutBtn').addEventListener('click', zoomOut);
    document.getElementById('zoomInBtn').addEventListener('click', zoomIn);
    document.getElementById('resetBtn').addEventListener('click', resetZoom);
    document.getElementById('closeBtn').addEventListener('click', closePanel);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closePanel();
      } else if (e.key === '+' || e.key === '=') {
        zoomIn();
      } else if (e.key === '-') {
        zoomOut();
      } else if (e.key === '0') {
        resetZoom();
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Manages Image Preview webview panels
 * Unlike SampleInfoPanel, this allows multiple panels for different images
 */
export class ImagePreviewPanel {
  public static readonly viewType = 'labnotev.imagePreview';
  public static readonly allowMultiple = true;
  
  private static panelCounter = 0;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel, 
    extensionUri: vscode.Uri,
    imageUri: vscode.Uri,
    altText: string
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Convert image path to webview URI
    const webviewUri = panel.webview.asWebviewUri(imageUri);
    
    // Set HTML content
    this._panel.webview.html = generateImagePreviewHtml(
      webviewUri.toString(),
      altText,
      panel.webview.cspSource
    );

    // Handle panel disposal
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from webview
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        if (message.command === 'close') {
          this._panel.dispose();
        }
      },
      null,
      this._disposables
    );
  }

  /**
   * Show image in a new preview panel
   */
  public static show(
    extensionUri: vscode.Uri, 
    imageUri: vscode.Uri, 
    altText: string
  ): ImagePreviewPanel {
    const column = vscode.ViewColumn.Beside;

    // Create a new panel for each image
    ImagePreviewPanel.panelCounter++;
    const panelTitle = altText || path.basename(imageUri.fsPath);
    
    const panel = vscode.window.createWebviewPanel(
      ImagePreviewPanel.viewType,
      `🖼️ ${panelTitle}`,
      column,
      {
        enableScripts: true,
        localResourceRoots: [
          extensionUri,
          vscode.Uri.file(path.dirname(imageUri.fsPath)),
          // Also allow workspace folders
          ...(vscode.workspace.workspaceFolders?.map(f => f.uri) || [])
        ],
      }
    );

    return new ImagePreviewPanel(panel, extensionUri, imageUri, altText);
  }

  public dispose(): void {
    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
