import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SampleType } from '../lib/sampleUtils';
import { generateSampleId } from '../lib/sampleUtils';
import {
  SampleTreeViewProvider,
  SampleTreeItem,
  SampleTreeItemType,
  getInsertText,
  getDefinitionText,
} from '../views/SampleTreeViewProvider';
import { findSampleDefinitionMatch, loadSamplesByType } from '../lib/sampleStorage';
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
    alias = await vscode.window.showInputBox({
      prompt: `새 ${sampleType} 샘플의 별칭을 입력하세요`,
      placeHolder: '예: Sample-A',
    }) ?? null;
    if (alias === undefined) return null;
    description = await vscode.window.showInputBox({
      prompt: '설명을 입력하세요 (선택 사항)',
      placeHolder: '예: 실험 1에서 사용된 샘플',
    }) ?? null;
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

  // Register insert sample to editor command (reference - ID|Alias only)
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.insertSampleToEditor', async (item: SampleTreeItem) => {
      if (item && item.itemType === SampleTreeItemType.Sample) {
        const insertText = getInsertText(item);

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
          vscode.window.showWarningMessage('마크다운 파일을 열어주세요');
        }
      }
    })
  );

  // Register insert sample definition command (@type:ID|Alias:Description)
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.insertSampleDefinition', async (item: SampleTreeItem) => {
      if (item && item.itemType === SampleTreeItemType.Sample) {
        const insertText = getDefinitionText(item);

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
          vscode.window.showWarningMessage('마크다운 파일을 열어주세요');
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
        vscode.window.showInformationMessage(`샘플이 추가되었습니다: ${result.id}`);
      }
    })
  );

  // Register delete sample command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.deleteSample', async (item: SampleTreeItem) => {
      if (!item || item.itemType !== SampleTreeItemType.Sample) {
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `정말로 ${item.sampleId}을(를) 삭제하시겠습니까?`,
        { modal: true },
        '삭제'
      );

      if (confirm === '삭제') {
        await sampleTreeProvider.deleteSample(
          item.scope,
          item.sampleType!,
          item.sampleId!
        );
        vscode.window.showInformationMessage(`샘플이 삭제되었습니다: ${item.sampleId}`);
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
        prompt: '새 별칭을 입력하세요',
        value: item.alias || '',
        placeHolder: '예: Sample-A',
      });

      if (newAlias === undefined) {
        return; // User cancelled
      }

      // Ask for new description
      const newDescription = await vscode.window.showInputBox({
        prompt: '새 설명을 입력하세요',
        value: item.sampleDescription || '',
        placeHolder: '예: 실험 1에서 사용된 샘플',
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

      vscode.window.showInformationMessage(`샘플이 수정되었습니다: ${item.sampleId}`);
    })
  );

  // Register move to global command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.moveSampleToGlobal', async (item: SampleTreeItem) => {
      if (item?.sampleType && item?.sampleId) {
        await sampleTreeProvider.moveSampleToGlobal(item.sampleType, item.sampleId);
        vscode.window.showInformationMessage(`${item.sampleId}을(를) Global로 이동했습니다`);
      }
    })
  );

  // Register move to local command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.moveSampleToLocal', async (item: SampleTreeItem) => {
      if (item?.sampleType && item?.sampleId) {
        await sampleTreeProvider.moveSampleToLocal(item.sampleType, item.sampleId);
        vscode.window.showInformationMessage(`${item.sampleId}을(를) Local로 이동했습니다`);
      }
    })
  );

  // Register move to definition command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.moveToDefinition', async (item: SampleTreeItem) => {
      if (!item || item.itemType !== SampleTreeItemType.Sample || !item.sampleType || !item.sampleId) {
        return;
      }

      const revealAndSelect = (editor: vscode.TextEditor, match: { start: number; length: number }) => {
        const range = new vscode.Range(
          editor.document.positionAt(match.start),
          editor.document.positionAt(match.start + match.length)
        );
        editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        editor.selection = new vscode.Selection(range.start, range.end);
      };

      // (1a) Check section editor
      const secDoc = sectionEditorProvider?.getActiveDocument();
      if (secDoc) {
        const docText = secDoc.getText();
        const match = findSampleDefinitionMatch(
          docText,
          item.sampleType,
          item.sampleId,
          item.alias ?? null
        );
        if (match) {
          const editor = await vscode.window.showTextDocument(secDoc, { preview: false });
          revealAndSelect(editor, match);
          return;
        }
      }

      // (1b) Check active text editor (markdown)
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor && activeEditor.document.languageId === 'markdown') {
        const docText = activeEditor.document.getText();
        const match = findSampleDefinitionMatch(
          docText,
          item.sampleType,
          item.sampleId,
          item.alias ?? null
        );
        if (match) {
          revealAndSelect(activeEditor, match);
          return;
        }
      }

      // (2) Search in source files
      const folder = item.scope === 'local' ? sampleTreeProvider.getLocalFolder() : sampleTreeProvider.getGlobalFolder();
      const samples = loadSamplesByType(folder, item.sampleType);
      const record = samples[item.sampleId];
      const sources = record?.sources;
      if (!sources || sources.length === 0) {
        vscode.window.showInformationMessage('정의를 찾을 수 없습니다.');
        return;
      }

      if (item.scope === 'local') {
        const documentFolder = sampleTreeProvider.getDocumentFolder();
        for (const source of sources) {
          const fullPath = path.join(documentFolder, source);
          if (!fs.existsSync(fullPath)) continue;
          try {
            const doc = await vscode.workspace.openTextDocument(fullPath);
            const text = doc.getText();
            const match = findSampleDefinitionMatch(text, item.sampleType, item.sampleId, item.alias ?? null);
            if (match) {
              const editor = await vscode.window.showTextDocument(doc, { preview: false });
              revealAndSelect(editor, match);
              return;
            }
          } catch {
            // skip
          }
        }
      } else {
        for (const source of sources) {
          const uris = await vscode.workspace.findFiles(`**/${source}`);
          for (const uri of uris) {
            try {
              const doc = await vscode.workspace.openTextDocument(uri);
              const text = doc.getText();
              const match = findSampleDefinitionMatch(text, item.sampleType, item.sampleId, item.alias ?? null);
              if (match) {
                const editor = await vscode.window.showTextDocument(doc, { preview: false });
                revealAndSelect(editor, match);
                return;
              }
            } catch {
              // skip
            }
          }
        }
      }

      vscode.window.showInformationMessage('정의를 찾을 수 없습니다.');
    })
  );

  // Register search sample command (QuickPick)
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.searchSample', async () => {
      const allSamples = sampleTreeProvider.getAllSamplesForSearch();

      if (allSamples.length === 0) {
        vscode.window.showInformationMessage('검색할 샘플이 없습니다');
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
        placeHolder: '샘플 검색... (ID, 별칭, 설명으로 검색)',
        matchOnDescription: true,
        matchOnDetail: true,
      });

      if (selected) {
        const insertText = selected.alias
          ? `${selected.sampleId}|${selected.alias}`
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
          vscode.window.showWarningMessage('마크다운 파일을 열어주세요');
        }
      }
    })
  );
}
