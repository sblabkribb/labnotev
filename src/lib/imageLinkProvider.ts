import * as vscode from 'vscode';
import * as path from 'path';

/**
 * DocumentLinkProvider for markdown image links
 * Makes image links clickable to open in ImagePreviewPanel
 */
export class ImageLinkProvider implements vscode.DocumentLinkProvider {
  
  provideDocumentLinks(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.DocumentLink[] {
    const links: vscode.DocumentLink[] = [];
    
    // Only process markdown files
    if (document.languageId !== 'markdown') {
      return links;
    }

    const text = document.getText();
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
          // Calculate range for the entire image markdown: ![alt](path)
          const startPos = new vscode.Position(lineNum, match.index);
          const endPos = new vscode.Position(lineNum, match.index + match[0].length);
          const range = new vscode.Range(startPos, endPos);
          
          // Resolve the image path relative to document
          const documentDir = path.dirname(document.uri.fsPath);
          const absoluteImagePath = path.isAbsolute(imagePath) 
            ? imagePath 
            : path.resolve(documentDir, imagePath);
          
          const imageUri = vscode.Uri.file(absoluteImagePath);
          const altText = match[1] || path.basename(imagePath);
          
          // Create link with command URI
          const commandUri = vscode.Uri.parse(
            `command:labnotev.openImagePreview?${encodeURIComponent(JSON.stringify({
              imagePath: imageUri.toString(),
              altText: altText
            }))}`
          );
          
          const link = new vscode.DocumentLink(range, commandUri);
          link.tooltip = `클릭하여 이미지 미리보기: ${altText}`;
          links.push(link);
        }
      }
      
      // Reset regex lastIndex for next line
      pattern.lastIndex = 0;
    }
    
    return links;
  }
}
