import * as vscode from 'vscode';
import * as path from 'path';
import { SampleType, SAMPLE_TYPES, findSamplePrefixRange, generateSampleId } from '../lib/sampleUtils';
import {
  getSeoulDateString,
  getSeoulDateTimeString,
  updateDateFieldInLine,
  updateAllDatesInLine,
  updateAllDateFields,
} from '../lib/dateUtils';
import { sampleDecorations } from '../lib/sampleDecorations';
import { ImagePreviewPanel } from '../views/ImagePreviewPanel';
import { ImageLinkProvider } from '../lib/imageLinkProvider';
import { saveSamplesFromDocument, getGlobalLabsamplesFolder } from '../lib/sampleStorage';
import { SampleTreeViewProvider } from '../views/SampleTreeViewProvider';
import { findResourcesFolder, ensureResourcesFolder, saveSampleToResources } from '../lib/dataLoader';

export interface UtilityCommandProviders {
  sampleTreeProvider: SampleTreeViewProvider;
}

export function registerUtilityCommands(
  context: vscode.ExtensionContext,
  providers: UtilityCommandProviders
): void {
  const { sampleTreeProvider } = providers;

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

  // Register open image preview command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.openImagePreview', (args: { imagePath: string; altText: string }) => {
      if (args && args.imagePath) {
        const imageUri = vscode.Uri.parse(args.imagePath);
        ImagePreviewPanel.show(context.extensionUri, imageUri, args.altText || '');
      }
    })
  );

  // Register image link provider for markdown files
  context.subscriptions.push(
    vscode.languages.registerDocumentLinkProvider(
      { language: 'markdown', scheme: 'file' },
      new ImageLinkProvider()
    )
  );

  // Register generate sample ID command (for completion provider)
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.generateSampleId', async (sampleType: string, documentUri: vscode.Uri) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const newId = generateSampleId(sampleType as SampleType);

      // Ask for alias
      const alias = await vscode.window.showInputBox({
        prompt: `새 ${sampleType} 샘플의 별칭을 입력하세요`,
        placeHolder: '예: Sample-A',
      });

      // Ask for description
      const description = await vscode.window.showInputBox({
        prompt: '설명을 입력하세요 (선택 사항)',
        placeHolder: '예: 실험 1에서 사용된 샘플',
      });

      // Save to resources
      const resourcesPath = findResourcesFolder(documentUri);
      if (resourcesPath) {
        saveSampleToResources(
          resourcesPath,
          sampleType,
          newId,
          alias || null,
          description || null,
          path.basename(documentUri.fsPath)
        );
      } else {
        // Create resources folder if not exists
        const docDir = path.dirname(documentUri.fsPath);
        const newResourcesPath = path.join(docDir, 'resources', 'labsamples');
        ensureResourcesFolder(newResourcesPath);
        saveSampleToResources(
          newResourcesPath,
          sampleType,
          newId,
          alias || null,
          description || null,
          path.basename(documentUri.fsPath)
        );
      }

      // Insert text with @type: prefix for definition
      let insertText = `@${sampleType.toLowerCase()}:${newId}`;
      if (alias) {
        insertText += `|${alias}`;
      }
      if (description) {
        insertText += `:${description}`;
      }

      // Check if @type: prefix already exists at cursor position
      const prefixRange = findSamplePrefixRange(
        editor.document,
        editor.selection.active,
        sampleType
      );

      await editor.edit(editBuilder => {
        if (prefixRange) {
          // Replace the existing prefix with the full definition
          const replaceRange = new vscode.Range(
            prefixRange.start.line,
            prefixRange.start.character,
            editor.selection.active.line,
            editor.selection.active.character
          );
          editBuilder.replace(replaceRange, insertText);
        } else {
          // No prefix found, insert normally
          editBuilder.insert(editor.selection.active, insertText);
        }
      });

      vscode.window.showInformationMessage(`새 샘플이 생성되었습니다: ${newId}`);
    })
  );

  // Register input sample info command (for completion provider)
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.inputSampleInfo', async (sampleType: string, documentUri: vscode.Uri) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      // Ask for sample ID
      const sampleId = await vscode.window.showInputBox({
        prompt: `${sampleType} 샘플 ID를 입력하세요`,
        placeHolder: `예: ${sampleType}-12345`,
      });

      if (!sampleId) {
        return;
      }

      // Ask for alias
      const alias = await vscode.window.showInputBox({
        prompt: '별칭을 입력하세요 (선택 사항)',
        placeHolder: '예: Sample-A',
      });

      // Ask for description
      const description = await vscode.window.showInputBox({
        prompt: '설명을 입력하세요 (선택 사항)',
        placeHolder: '예: 실험 1에서 사용된 샘플',
      });

      // Save to resources
      const resourcesPath = findResourcesFolder(documentUri);
      if (resourcesPath) {
        saveSampleToResources(
          resourcesPath,
          sampleType,
          sampleId,
          alias || null,
          description || null,
          path.basename(documentUri.fsPath)
        );
      } else {
        const docDir = path.dirname(documentUri.fsPath);
        const newResourcesPath = path.join(docDir, 'resources', 'labsamples');
        ensureResourcesFolder(newResourcesPath);
        saveSampleToResources(
          newResourcesPath,
          sampleType,
          sampleId,
          alias || null,
          description || null,
          path.basename(documentUri.fsPath)
        );
      }

      // Insert text with @type: prefix for definition
      let insertText = `@${sampleType.toLowerCase()}:${sampleId}`;
      if (alias) {
        insertText += `|${alias}`;
      }
      if (description) {
        insertText += `:${description}`;
      }

      // Check if @type: prefix already exists at cursor position
      const prefixRange = findSamplePrefixRange(
        editor.document,
        editor.selection.active,
        sampleType
      );

      await editor.edit(editBuilder => {
        if (prefixRange) {
          // Replace the existing prefix with the full definition
          const replaceRange = new vscode.Range(
            prefixRange.start.line,
            prefixRange.start.character,
            editor.selection.active.line,
            editor.selection.active.character
          );
          editBuilder.replace(replaceRange, insertText);
        } else {
          // No prefix found, insert normally
          editBuilder.insert(editor.selection.active, insertText);
        }
      });

      vscode.window.showInformationMessage(`샘플 정보가 저장되었습니다: ${sampleId}`);
    })
  );

  // Sample ID highlighting
  function applySampleIdHighlights(editor: vscode.TextEditor) {
    const document = editor.document;

    // Only apply to markdown files
    if (document.languageId !== 'markdown') {
      return;
    }

    const decorationsByType: Record<SampleType, vscode.DecorationOptions[]> = {} as Record<SampleType, vscode.DecorationOptions[]>;

    // Initialize decoration arrays for each type
    for (const type of SAMPLE_TYPES) {
      decorationsByType[type] = [];
    }

    // Scan document for sample IDs (always enabled - uses Sample TreeView)
    // Pattern: TYPE-{digits} or TYPE-{digits}-{digits}... (e.g. DNA-123, Equip-123-456)
    for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
      const line = document.lineAt(lineNum);

      for (const type of SAMPLE_TYPES) {
        const pattern = new RegExp(`\\b${type}-\\d+(?:-\\d+)*\\b`, 'g');
        let match;

        while ((match = pattern.exec(line.text)) !== null) {
          const startPos = new vscode.Position(lineNum, match.index);
          const endPos = new vscode.Position(lineNum, match.index + match[0].length);
          const range = new vscode.Range(startPos, endPos);
          decorationsByType[type].push({ range });
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

      try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const globalLabsamplesFolder = workspaceRoot ? getGlobalLabsamplesFolder(workspaceRoot) : undefined;
        saveSamplesFromDocument(document.uri.fsPath, document.getText(), globalLabsamplesFolder);
        sampleTreeProvider.refresh();
      } catch (error) {
        console.error('[LabNote] Failed to save sample info:', error);
      }
    })
  );

  // Apply highlights to current active editor
  if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.languageId === 'markdown') {
    applySampleIdHighlights(vscode.window.activeTextEditor);
  }
}
