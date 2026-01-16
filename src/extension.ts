import * as vscode from 'vscode';
import { LabNoteEditorProvider } from './labNoteEditorProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('Lab Note Editor is now active');

  // Register the custom editor provider
  const provider = new LabNoteEditorProvider(context);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      LabNoteEditorProvider.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
      }
    )
  );

  // Register new note command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.newNote', async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage('Please open a folder first');
        return;
      }

      const fileName = await vscode.window.showInputBox({
        prompt: 'Enter note name',
        placeHolder: 'my-note',
      });

      if (fileName) {
        const uri = vscode.Uri.joinPath(
          workspaceFolders[0].uri,
          `${fileName}.labnote.md`
        );
        await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(''));
        await vscode.commands.executeCommand('vscode.openWith', uri, LabNoteEditorProvider.viewType);
      }
    })
  );
}

export function deactivate() {}
