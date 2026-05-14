import * as vscode from 'vscode';
import { SampleType, findSamplePrefixRange } from '../lib/sampleUtils';
import { generateSampleId } from '../lib/sampleUtils';
import {
  SampleTreeViewProvider,
  SampleTreeItem,
  SampleTreeItemType,
  getInsertText,
  getDefinitionText,
} from '../views/SampleTreeViewProvider';
import { findSampleDefinitionMatch } from '../lib/sampleStorage';
import { showProductPicker } from '../lib/productPicker';
import type { SectionEditorProvider } from '../sectionEditorProvider';

export interface SampleCommandProviders {
  sampleTreeProvider: SampleTreeViewProvider;
  sectionEditorProvider?: SectionEditorProvider;
}

/**
 * Generate a new sample ID, prompt for alias/description, and save to the sample DB.
 * Returns the created sample info, or null if the user cancelled.
 */
export async function createSampleWithPrompt(
  sampleType: string,
  sampleTreeProvider: SampleTreeViewProvider,
  scope: 'local' | 'global' = 'local'
): Promise<{ id: string; alias: string | null; description: string | null } | null> {
  const newSampleId = generateSampleId(sampleType as SampleType);

  let alias: string | null = null;
  let description: string | null = null;

  if (sampleType === 'Reagent' || sampleType === 'Labware') {
    const documentUri =
      vscode.window.activeTextEditor?.document?.uri ??
      vscode.workspace.workspaceFolders?.[0]?.uri;
    if (documentUri) {
      const picked = await showProductPicker(sampleType, documentUri);
      if (picked) {
        alias = picked.alias;
        description = picked.description;
      }
    }
  }
  if (alias === null && description === null) {
    const aliasInput = await vscode.window.showInputBox({
      prompt: vscode.l10n.t('Enter an alias for the new {0} sample', sampleType),
      placeHolder: vscode.l10n.t('e.g. Sample-A'),
    });
    if (aliasInput === undefined) return null;
    alias = aliasInput || null;

    const descInput = await vscode.window.showInputBox({
      prompt: vscode.l10n.t('Enter a description (optional)'),
      placeHolder: vscode.l10n.t('e.g. Sample used in experiment 1'),
    });
    if (descInput === undefined) return null;
    description = descInput || null;
  }

  await sampleTreeProvider.addSample(scope, sampleType, newSampleId, alias, description);

  return { id: newSampleId, alias, description };
}

export function registerSampleCommands(
  context: vscode.ExtensionContext,
  providers: SampleCommandProviders
): void {
  const { sampleTreeProvider, sectionEditorProvider } = providers;

  // Register refresh sample tree command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.refreshSampleTree', () => {
      sampleTreeProvider.refresh();
    })
  );

  // Register insert sample to editor command (reference - ID|Alias only).
  // Only inserts into the Section Editor webview. If the user is actively
  // editing the markdown file in a plain text editor, the command is a no-op
  // with a helpful nudge — inserting into the text editor would bypass the
  // Section Editor's structured editing model.
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.insertSampleToEditor', async (item: SampleTreeItem) => {
      if (!item || item.itemType !== SampleTreeItemType.Sample) {
        return;
      }
      const insertText = getInsertText(item);

      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor && activeEditor.document.languageId === 'markdown') {
        vscode.window.showInformationMessage(
          vscode.l10n.t('Open the file with the Section Editor to insert samples.')
        );
        return;
      }

      const secDoc = sectionEditorProvider?.getActiveDocument();
      if (secDoc) {
        await sectionEditorProvider!.insertSampleIntoDocument(secDoc, insertText);
        return;
      }

      vscode.window.showInformationMessage(
        vscode.l10n.t('Open a .labnote.md file with the Section Editor first.')
      );
    })
  );

  // Register insert sample definition command (@type:ID|Alias:Description)
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.insertSampleDefinition', async (item: SampleTreeItem) => {
      if (item && item.itemType === SampleTreeItemType.Sample) {
        const insertText = getDefinitionText(item);

        const secDoc = sectionEditorProvider?.getActiveDocument();
        if (secDoc) {
          // Phase C-2: let the webview decide whether to strip a user-typed
          // `@type;` prefix at the caret — it's the only side with access to
          // the textarea caret context.
          await sectionEditorProvider!.insertSampleIntoDocument(secDoc, insertText);
          return;
        }

        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'markdown') {
          // Phase C-2: if the caret is inside an existing `@type;`/`@type:`
          // prefix that matches this sample's type, replace that prefix range
          // instead of inserting after it — otherwise we end up with
          // `@dna;@dna;DNA-123;...`. `findSamplePrefixRange` returns the range
          // of the prefix the cursor is sitting in (or null for no match).
          const sampleType = item.sampleType;
          if (sampleType) {
            const prefixRange = findSamplePrefixRange(
              editor.document,
              editor.selection.active,
              sampleType
            );
            if (prefixRange) {
              // Note: the 4-number constructor form of vscode.Range is used
              // here (rather than Position, Position) to stay compatible with
              // the test mock in src/__tests__/setup.ts, which mocks Range but
              // not Position. Behavior is identical at runtime.
              const range = new vscode.Range(
                prefixRange.start.line,
                prefixRange.start.character,
                prefixRange.end.line,
                prefixRange.end.character
              );
              await editor.edit(editBuilder => {
                editBuilder.replace(range, insertText);
              });
              return;
            }
          }
          await editor.edit(editBuilder => {
            editBuilder.insert(editor.selection.active, insertText);
          });
        } else {
          vscode.window.showWarningMessage(vscode.l10n.t('Please open a Markdown file.'));
        }
      }
    })
  );

  // Register add sample command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.addSample', async (item: SampleTreeItem) => {
      if (!item || item.itemType !== SampleTreeItemType.Type) {
        return;
      }

      const sampleType = item.sampleType as SampleType;
      const scope = item.scope;

      const result = await createSampleWithPrompt(sampleType, sampleTreeProvider, scope);
      if (result) {
        vscode.window.showInformationMessage(vscode.l10n.t('Sample added: {0}', result.id));
      }
    })
  );

  // Register delete sample command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.deleteSample', async (item: SampleTreeItem) => {
      if (!item || item.itemType !== SampleTreeItemType.Sample) {
        return;
      }

      const deleteLabel = vscode.l10n.t('Delete');
      const confirm = await vscode.window.showWarningMessage(
        vscode.l10n.t('Are you sure you want to delete {0}?', item.sampleId ?? ''),
        { modal: true },
        deleteLabel
      );

      if (confirm === deleteLabel) {
        await sampleTreeProvider.deleteSample(
          item.scope,
          item.sampleType!,
          item.sampleId!
        );
        vscode.window.showInformationMessage(vscode.l10n.t('Sample deleted: {0}', item.sampleId ?? ''));
      }
    })
  );

  // Register edit sample command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.editSample', async (item: SampleTreeItem) => {
      if (!item || item.itemType !== SampleTreeItemType.Sample) {
        return;
      }

      // Ask for new alias
      const newAlias = await vscode.window.showInputBox({
        prompt: vscode.l10n.t('Enter a new alias'),
        value: item.alias || '',
        placeHolder: vscode.l10n.t('e.g. Sample-A'),
      });

      if (newAlias === undefined) {
        return; // User cancelled
      }

      // Ask for new description
      const newDescription = await vscode.window.showInputBox({
        prompt: vscode.l10n.t('Enter a new description'),
        value: item.sampleDescription || '',
        placeHolder: vscode.l10n.t('e.g. Sample used in experiment 1'),
      });

      if (newDescription === undefined) {
        return; // User cancelled
      }

      await sampleTreeProvider.editSample(
        item.scope,
        item.sampleType!,
        item.sampleId!,
        newAlias || null,
        newDescription || null
      );

      const newDefinitionText = getDefinitionText({
        sampleType: item.sampleType,
        sampleId: item.sampleId,
        alias: newAlias || null,
        sampleDescription: newDescription || null,
      } as SampleTreeItem);

      // Try section editor first
      const secDoc = sectionEditorProvider?.getActiveDocument();
      if (secDoc) {
        const docText = secDoc.getText();
        const match = findSampleDefinitionMatch(
          docText,
          item.sampleType!,
          item.sampleId!,
          item.alias ?? null
        );
        if (match) {
          const edit = new vscode.WorkspaceEdit();
          const range = new vscode.Range(
            secDoc.positionAt(match.start),
            secDoc.positionAt(match.start + match.length)
          );
          edit.replace(secDoc.uri, range, newDefinitionText);
          await vscode.workspace.applyEdit(edit);
        }
      } else {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'markdown') {
          const docText = editor.document.getText();
          const match = findSampleDefinitionMatch(
            docText,
            item.sampleType!,
            item.sampleId!,
            item.alias ?? null
          );
          if (match) {
            const range = new vscode.Range(
              editor.document.positionAt(match.start),
              editor.document.positionAt(match.start + match.length)
            );
            await editor.edit((editBuilder) => {
              editBuilder.replace(range, newDefinitionText);
            });
          }
        }
      }

      vscode.window.showInformationMessage(vscode.l10n.t('Sample updated: {0}', item.sampleId ?? ''));
    })
  );

  // Register move to global command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.moveSampleToGlobal', async (item: SampleTreeItem) => {
      if (item?.sampleType && item?.sampleId) {
        await sampleTreeProvider.moveSampleToGlobal(item.sampleType, item.sampleId);
        vscode.window.showInformationMessage(vscode.l10n.t('Moved {0} to Global', item.sampleId));
      }
    })
  );

  // Register move to local command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.moveSampleToLocal', async (item: SampleTreeItem) => {
      if (item?.sampleType && item?.sampleId) {
        await sampleTreeProvider.moveSampleToLocal(item.sampleType, item.sampleId);
        vscode.window.showInformationMessage(vscode.l10n.t('Moved {0} to Local', item.sampleId));
      }
    })
  );

  // Register move to definition command.
  //
  // Simplified to keep the user inside the Section Editor: never opens a plain
  // text editor and never searches other files. Two entry points share this
  // command:
  //   1. TreeView right-click — passes a SampleTreeItem
  //   2. Webview `navigateToSample` fallback (legacy) — passes (type, id)
  //
  // Both flows ask the SectionEditorProvider to scroll the active webview to
  // the `@type;ID...` definition. If the user is editing the markdown as plain
  // text (no Section Editor active), we surface a nudge instead of opening a
  // second editor.
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.moveToDefinition', async (itemOrType: SampleTreeItem | string, maybeId?: string) => {
      let sampleType: string;
      let sampleId: string;
      let alias: string | null = null;

      if (typeof itemOrType === 'string') {
        sampleType = itemOrType;
        sampleId = maybeId!;
        if (!sampleType || !sampleId) return;
      } else {
        const item = itemOrType;
        if (!item || item.itemType !== SampleTreeItemType.Sample || !item.sampleType || !item.sampleId) {
          return;
        }
        sampleType = item.sampleType;
        sampleId = item.sampleId;
        alias = item.alias ?? null;
      }

      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor && activeEditor.document.languageId === 'markdown') {
        vscode.window.showInformationMessage(
          vscode.l10n.t('Open the file with the Section Editor to navigate to definitions.')
        );
        return;
      }

      const ok = sectionEditorProvider?.tryScrollActiveWebviewToDefinition(
        sampleType,
        sampleId,
        alias
      ) ?? false;
      if (!ok) {
        vscode.window.showInformationMessage(
          vscode.l10n.t('Definition not found in current document.')
        );
      }
    })
  );

  // Register search sample command (QuickPick)
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.searchSample', async () => {
      const allSamples = sampleTreeProvider.getAllSamplesForSearch();

      if (allSamples.length === 0) {
        vscode.window.showInformationMessage(vscode.l10n.t('No samples to search.'));
        return;
      }

      // Convert to QuickPickItems
      const quickPickItems: (vscode.QuickPickItem & {
        sampleId: string;
        alias: string | null;
        scope: 'local' | 'global';
      })[] = allSamples.map(sample => ({
        label: sample.alias
          ? `${sample.sampleId} | ${sample.alias}`
          : sample.sampleId,
        description: `(${sample.scope === 'local' ? 'Local' : 'Global'}) ${sample.sampleType}`,
        detail: sample.description || undefined,
        sampleId: sample.sampleId,
        alias: sample.alias,
        scope: sample.scope,
      }));

      const selected = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: vscode.l10n.t('Search samples... (by ID, alias, or description)'),
        matchOnDescription: true,
        matchOnDetail: true,
      });

      if (selected) {
        const insertText = selected.alias
          ? `${selected.sampleId};${selected.alias}`
          : selected.sampleId;

        const secDoc = sectionEditorProvider?.getActiveDocument();
        if (secDoc) {
          await sectionEditorProvider!.insertSampleIntoDocument(secDoc, insertText);
          return;
        }

        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'markdown') {
          await editor.edit(editBuilder => {
            editBuilder.insert(editor.selection.active, insertText);
          });
        } else {
          vscode.window.showWarningMessage(vscode.l10n.t('Please open a Markdown file.'));
        }
      }
    })
  );
}
