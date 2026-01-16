import * as vscode from 'vscode';
import * as path from 'path';

export class LabNoteEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'labnotevis.editor';

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Setup webview options
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'dist'),
        vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'node_modules'),
        // Allow access to document folder for images
        vscode.Uri.file(path.dirname(document.uri.fsPath)),
      ],
    };

    // Set webview HTML content
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // Send initial document content to webview
    const updateWebview = () => {
      webviewPanel.webview.postMessage({
        type: 'update',
        content: document.getText(),
        documentUri: document.uri.toString(),
      });
    };

    // Listen for changes in the document
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() === document.uri.toString()) {
          updateWebview();
        }
      }
    );

    // Listen for messages from webview
    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'ready':
          updateWebview();
          break;

        case 'save':
          await this.updateTextDocument(document, message.content);
          break;

        case 'saveImage':
          await this.saveImage(document, message.data, message.filename);
          break;

        case 'getAssetUri':
          const assetUri = this.getAssetUri(
            webviewPanel.webview,
            document,
            message.relativePath
          );
          webviewPanel.webview.postMessage({
            type: 'assetUri',
            requestId: message.requestId,
            uri: assetUri,
          });
          break;
      }
    });

    // Cleanup
    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'dist', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'dist', 'index.css')
    );

    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data: blob:; font-src ${webview.cspSource} data:;">
  <link rel="stylesheet" href="${styleUri}">
  <title>Lab Note Editor</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private async updateTextDocument(
    document: vscode.TextDocument,
    content: string
  ): Promise<void> {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      content
    );
    await vscode.workspace.applyEdit(edit);
  }

  private async saveImage(
    document: vscode.TextDocument,
    base64Data: string,
    filename: string
  ): Promise<string> {
    const documentDir = path.dirname(document.uri.fsPath);
    const assetsDir = path.join(documentDir, 'assets');
    
    // Create assets directory if it doesn't exist
    const assetsDirUri = vscode.Uri.file(assetsDir);
    try {
      await vscode.workspace.fs.stat(assetsDirUri);
    } catch {
      await vscode.workspace.fs.createDirectory(assetsDirUri);
    }

    // Write image file
    const imagePath = path.join(assetsDir, filename);
    const imageUri = vscode.Uri.file(imagePath);
    const imageData = Buffer.from(base64Data, 'base64');
    await vscode.workspace.fs.writeFile(imageUri, imageData);

    return `./assets/${filename}`;
  }

  private getAssetUri(
    webview: vscode.Webview,
    document: vscode.TextDocument,
    relativePath: string
  ): string {
    const documentDir = path.dirname(document.uri.fsPath);
    const absolutePath = path.join(documentDir, relativePath);
    return webview.asWebviewUri(vscode.Uri.file(absolutePath)).toString();
  }
}
