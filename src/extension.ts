import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LabNoteEditorProvider } from './labNoteEditorProvider';
import {
  getSeoulDateString,
  getSeoulDateTimeString,
  updateDateFieldInLine,
  updateAllDatesInLine,
  updateAllDateFields,
} from './lib/dateUtils';
import { SAMPLE_TYPES, SampleType } from './lib/sampleUtils';
import { sampleDecorations } from './lib/sampleDecorations';
import { SampleInfoPanel } from './views/SampleInfoPanel';
import { saveSamplesFromDocument, parseSampleTracking } from './lib/sampleStorage';
import { createLabnoteStructure } from './lib/labnoteStructure';

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

  // Sample ID highlighting
  function applySampleIdHighlights(editor: vscode.TextEditor) {
    const document = editor.document;

    // Only apply to markdown files
    if (document.languageId !== 'markdown') {
      return;
    }

    const documentText = document.getText();
    const sampleTrackingEnabled = parseSampleTracking(documentText);

    const decorationsByType: Record<SampleType, vscode.DecorationOptions[]> = {} as Record<SampleType, vscode.DecorationOptions[]>;
    
    // Initialize decoration arrays for each type
    for (const type of SAMPLE_TYPES) {
      decorationsByType[type] = [];
    }

    // Only scan for sample IDs if Sample Tracking is enabled
    if (sampleTrackingEnabled) {
      // Scan document for sample IDs
      for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
        const line = document.lineAt(lineNum);
        
        for (const type of SAMPLE_TYPES) {
          // Pattern: TYPE-{digits} (e.g., DNA-1737123456789)
          const pattern = new RegExp(`\\b${type}-\\d+\\b`, 'g');
          let match;
          
          while ((match = pattern.exec(line.text)) !== null) {
            const startPos = new vscode.Position(lineNum, match.index);
            const endPos = new vscode.Position(lineNum, match.index + match[0].length);
            const range = new vscode.Range(startPos, endPos);
            decorationsByType[type].push({ range });
          }
        }
      }
    }

    // Apply decorations for each type (empty arrays will clear decorations)
    for (const type of SAMPLE_TYPES) {
      editor.setDecorations(sampleDecorations[type], decorationsByType[type]);
    }
  }

  // Register highlight handlers
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor && editor.document.languageId === 'markdown') {
        applySampleIdHighlights(editor);
      }
    }),
    vscode.workspace.onDidChangeTextDocument(event => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document && editor.document.languageId === 'markdown') {
        applySampleIdHighlights(editor);
      }
    })
  );

  // Save sample info to JSON on document save
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(document => {
      // Only process markdown files
      if (document.languageId !== 'markdown') {
        return;
      }

      const documentText = document.getText();
      
      // Only save sample info if Sample Tracking is enabled
      if (!parseSampleTracking(documentText)) {
        return;
      }

      try {
        saveSamplesFromDocument(document.uri.fsPath, documentText);
      } catch (error) {
        console.error('[LabNote] Failed to save sample info:', error);
      }
    })
  );

  // Apply highlights to current active editor
  if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.languageId === 'markdown') {
    applySampleIdHighlights(vscode.window.activeTextEditor);
  }

  // Register show sample info command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.showSampleInfo', () => {
      SampleInfoPanel.createOrShow(context.extensionUri);
    })
  );

  // Register create labnote command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.createLabnote', async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage('먼저 폴더를 열어주세요');
        return;
      }

      const workspaceRoot = workspaceFolders[0].uri.fsPath;

      // Get existing labnote folders
      const labnoteDir = path.join(workspaceRoot, 'labnote');
      let existingFolders: string[] = [];
      if (fs.existsSync(labnoteDir)) {
        existingFolders = fs.readdirSync(labnoteDir, { withFileTypes: true })
          .filter(entry => entry.isDirectory() && /^\d{3}_/.test(entry.name))
          .map(entry => entry.name);
      }

      // Prompt for title
      const title = await vscode.window.showInputBox({
        prompt: '새 실험 노트 제목을 입력하세요',
        placeHolder: 'Protein Folding Experiment',
        validateInput: value => (!!value && value.trim().length > 0 ? undefined : '제목을 입력하세요')
      });

      if (!title) {
        return;
      }

      // Prompt for author (optional)
      const author = await vscode.window.showInputBox({
        prompt: '작성자 이름 (선택 사항)',
        placeHolder: '홍길동'
      });

      // Create structure
      const structure = createLabnoteStructure(workspaceRoot, title.trim(), existingFolders, author?.trim());

      try {
        // Create folders
        fs.mkdirSync(structure.labnoteFolder, { recursive: true });
        fs.mkdirSync(structure.imagesFolder, { recursive: true });
        fs.mkdirSync(structure.resourcesFolder, { recursive: true });

        // Write README.md
        fs.writeFileSync(structure.readmePath, structure.readmeContent, 'utf8');

        // Open the README.md
        const document = await vscode.workspace.openTextDocument(structure.readmePath);
        await vscode.window.showTextDocument(document, { preview: false });

        vscode.window.showInformationMessage(`실험 노트가 생성되었습니다: ${path.basename(structure.labnoteFolder)}`);
      } catch (error) {
        vscode.window.showErrorMessage(`실험 노트 생성 실패: ${error}`);
      }
    })
  );
}

export function deactivate() {}
