import * as vscode from 'vscode';
import * as path from 'path';
import { SampleType, SAMPLE_TYPES, findSamplePrefixRange, generateSampleId, buildSampleIdPattern } from '../lib/sampleUtils';
import {
  getSeoulDateString,
  getSeoulDateTimeString,
  updateDateFieldInLine,
  updateAllDatesInLine,
  updateAllDateFields,
} from '../lib/dateUtils';
import { sampleDecorations, getDecoration } from '../lib/sampleDecorations';
import { debounce } from '../lib/debounce';
import { ImagePreviewPanel } from '../views/ImagePreviewPanel';
import { ImageLinkProvider } from '../lib/imageLinkProvider';
import {
  saveSamplesFromDocument,
  getGlobalLabsamplesFolder,
  removeSourcesForDocument,
  RemovedSampleRef,
} from '../lib/sampleStorage';
import { SampleTreeViewProvider } from '../views/SampleTreeViewProvider';
import { findResourcesFolder, ensureResourcesFolder, saveSampleToResources } from '../lib/dataLoader';
import { showProductPicker } from '../lib/productPicker';
import type { SectionEditorProvider } from '../sectionEditorProvider';

export interface UtilityCommandProviders {
  sampleTreeProvider: SampleTreeViewProvider;
  // Optional so existing tests that build a partial providers object keep
  // working. When present, the save handler pushes a sampleDefsUpdated
  // message to every live webview so highlights stay in sync after the user
  // saves a markdown that defines / renames samples.
  sectionEditorProvider?: SectionEditorProvider;
}

export function registerUtilityCommands(
  context: vscode.ExtensionContext,
  providers: UtilityCommandProviders
): void {
  const { sampleTreeProvider, sectionEditorProvider } = providers;

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

      let alias: string | undefined;
      let description: string | undefined;

      if (sampleType === 'Reagent' || sampleType === 'Labware') {
        const picked = await showProductPicker(sampleType, documentUri);
        if (picked) {
          alias = picked.alias ?? undefined;
          description = picked.description ?? undefined;
        }
      }
      if (alias === undefined && description === undefined) {
        // Not Reagent/Labware, or user cancelled picker: use manual input
        alias = await vscode.window.showInputBox({
          prompt: vscode.l10n.t('Enter an alias for the new {0} sample', sampleType),
          placeHolder: vscode.l10n.t('e.g. Sample-A'),
        });
        description = await vscode.window.showInputBox({
          prompt: vscode.l10n.t('Enter a description (optional)'),
          placeHolder: vscode.l10n.t('e.g. Sample used in experiment 1'),
        });
      }

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

      let insertText = `@${sampleType.toLowerCase()};${newId}`;
      if (alias) {
        insertText += `;${alias}`;
      }
      if (description) {
        insertText += `;${description}`;
      }

      // Check if @type; prefix already exists at cursor position
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

      vscode.window.showInformationMessage(vscode.l10n.t('New sample created: {0}', newId));
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
        prompt: vscode.l10n.t('Enter the {0} sample ID', sampleType),
        placeHolder: vscode.l10n.t('e.g. {0}-12345', sampleType),
      });

      if (!sampleId) {
        return;
      }

      // Ask for alias
      const alias = await vscode.window.showInputBox({
        prompt: vscode.l10n.t('Enter an alias (optional)'),
        placeHolder: vscode.l10n.t('e.g. Sample-A'),
      });

      // Ask for description
      const description = await vscode.window.showInputBox({
        prompt: vscode.l10n.t('Enter a description (optional)'),
        placeHolder: vscode.l10n.t('e.g. Sample used in experiment 1'),
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

      let insertText = `@${sampleType.toLowerCase()};${sampleId}`;
      if (alias) {
        insertText += `;${alias}`;
      }
      if (description) {
        insertText += `;${description}`;
      }

      // Check if @type; prefix already exists at cursor position
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

      vscode.window.showInformationMessage(vscode.l10n.t('Sample info saved: {0}', sampleId));
    })
  );

  // Sample ID highlighting
  function applySampleIdHighlights(editor: vscode.TextEditor) {
    const document = editor.document;

    // Only apply to markdown files
    if (document.languageId !== 'markdown') {
      return;
    }

    const customTypes = vscode.workspace.getConfiguration('labnotev').get<string[]>('customSampleTypes', []);
    const allTypes: string[] = [...SAMPLE_TYPES, ...customTypes.filter(t => !(SAMPLE_TYPES as readonly string[]).includes(t))];
    const decorationsByType: Record<string, vscode.DecorationOptions[]> = {};

    // Compile one RegExp per type once, not per (line × type). Each pattern is
    // `/g` and reused across lines: after `exec` returns null its `lastIndex`
    // resets to 0, so per-line scans stay independent.
    const compiled = allTypes.map(type => {
      decorationsByType[type] = [];
      return { type, pattern: buildSampleIdPattern(type) };
    });

    for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
      const line = document.lineAt(lineNum);

      for (const { type, pattern } of compiled) {
        let match;
        while ((match = pattern.exec(line.text)) !== null) {
          const startPos = new vscode.Position(lineNum, match.index);
          const endPos = new vscode.Position(lineNum, match.index + match[0].length);
          const range = new vscode.Range(startPos, endPos);
          decorationsByType[type].push({ range });
        }
      }
    }

    for (const type of allTypes) {
      editor.setDecorations(getDecoration(type), decorationsByType[type]);
    }
  }

  // Debounce highlight recompute on edits so bursty typing triggers at most one
  // full-document scan per quiescent window. Editor switches stay immediate.
  const debouncedHighlightActiveEditor = debounce(() => {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'markdown') {
      applySampleIdHighlights(editor);
    }
  }, 150);

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
        debouncedHighlightActiveEditor();
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
        const customTypes = vscode.workspace.getConfiguration('labnotev').get<string[]>('customSampleTypes', []);
        const text = document.getText();
        saveSamplesFromDocument(document.uri.fsPath, text, globalLabsamplesFolder, customTypes);
        // Reconcile the other direction: any sample whose definition was
        // *removed* from this document since the last save is dropped from
        // the tree (when no other document still references it). Tree-only
        // records (sources === []) are protected, see removeSourcesForDocument.
        const removed = removeSourcesForDocument(
          document.uri.fsPath,
          text,
          globalLabsamplesFolder,
          customTypes
        );
        if (removed.length > 0) {
          showOrphanRemovedNotice(removed);
        }
        sampleTreeProvider.refresh();
        sectionEditorProvider?.broadcastSampleDefsUpdated();
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

/**
 * Surface a one-line toast describing samples that
 * `removeSourcesForDocument` just dropped from the tree.
 *
 * Up to three ids are listed verbatim so the user can recognise what
 * vanished; larger batches collapse into a count to avoid an unreadably
 * long message. The branch is exported via the file scope so unit tests
 * can call it directly; it is not part of the extension's public API.
 */
export function showOrphanRemovedNotice(removed: RemovedSampleRef[]): void {
  if (removed.length === 0) return;
  if (removed.length <= 3) {
    const ids = removed.map(r => r.id).join(', ');
    vscode.window.showInformationMessage(
      vscode.l10n.t('Removed from sample tree: {0}', ids)
    );
  } else {
    vscode.window.showInformationMessage(
      vscode.l10n.t(
        'Removed {0} samples from sample tree (no longer defined in any document)',
        removed.length
      )
    );
  }
}
