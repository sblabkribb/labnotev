import * as vscode from 'vscode';
import { LabNoteEditorProvider } from './labNoteEditorProvider';
import {
  getSeoulDateString,
  getSeoulDateTimeString,
  updateDateFieldInLine,
  updateAllDatesInLine,
  updateAllDateFields,
} from './labnote-lite/logic';

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

  // Register insert date command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.insertDate', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const currentDate = getSeoulDateString(new Date());
      await editor.edit(editBuilder => {
        const position = editor.selection.active;
        editBuilder.insert(position, currentDate);
      });
    })
  );

  // Register insert datetime command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.insertDateTime', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const currentDateTime = getSeoulDateTimeString(new Date());
      await editor.edit(editBuilder => {
        const position = editor.selection.active;
        editBuilder.insert(position, currentDateTime);
      });
    })
  );

  // Register update date field command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.updateDateField', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const lineNumber = editor.selection.active.line;
      const line = editor.document.lineAt(lineNumber);
      const currentDateTime = getSeoulDateTimeString(new Date());

      // Try to detect which date field is on this line (field name based)
      const dateFields = ['last_updated_date', 'created_date', 'end_date', 'Start_date', 'End_date'];
      let updated = false;
      let updatedLine = line.text;

      for (const field of dateFields) {
        const newLine = updateDateFieldInLine(line.text, field, currentDateTime);
        if (newLine !== line.text) {
          updatedLine = newLine;
          updated = true;
          break;
        }
      }

      // If no field name found, try to detect date/datetime patterns
      if (!updated) {
        updatedLine = updateAllDatesInLine(line.text, currentDateTime);
        updated = updatedLine !== line.text;
      }

      if (!updated) {
        vscode.window.showWarningMessage('No date field or date pattern found on current line');
        return;
      }

      await editor.edit(editBuilder => {
        editBuilder.replace(line.range, updatedLine);
      });

      vscode.window.showInformationMessage('Date field updated');
    })
  );

  // Register update all date fields command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.updateAllDateFields', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor');
        return;
      }

      const document = editor.document;
      const content = document.getText();
      const currentDate = getSeoulDateString(new Date());

      // Update all last_updated_date fields
      const updatedContent = updateAllDateFields(content, 'last_updated_date', currentDate);

      if (updatedContent === content) {
        vscode.window.showInformationMessage('No last_updated_date fields found to update');
        return;
      }

      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(content.length)
      );

      await editor.edit(editBuilder => {
        editBuilder.replace(fullRange, updatedContent);
      });

      await document.save();
      vscode.window.showInformationMessage('All last_updated_date fields updated');
    })
  );
}

export function deactivate() {}
