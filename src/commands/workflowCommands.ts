import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  WorkflowTreeViewProvider,
  WorkflowTreeItem,
  WorkflowTreeItemType,
} from '../views/WorkflowTreeViewProvider';
import {
  loadWorkflows as loadWorkflowsFromJson,
  loadUnitOperations as loadUnitOpsFromJson,
  saveWorkflows,
  saveUnitOperations,
  addWorkflow as addWorkflowToJson,
  addUnitOperation as addUnitOpToJson,
  generateNextWorkflowId,
  generateNextUnitOpId,
  WorkflowItem,
  UnitOperationItem,
} from '../lib/workflowDataLoader';
import { NodeFileSystem } from '@labnotev/core/node';

/** Shared Node file-system adapter for the workflow catalog loaders. */
const nodeFs = new NodeFileSystem();
import {
  isValidWorkflowPath,
  isValidReadmePath,
  getNextWorkflowNumber,
  createWorkflowContent,
  createWorkflowFileName,
  parseWorkflowChecklistFromReadme,
  generateWorkflowChecklist,
  updateReadmeWorkflowSection,
  parseExperimenterFromReadme,
  parseWorkflowFileName,
  extractWorkflowName,
  sanitizeWorkflowName,
  WorkflowChecklistItem,
} from '../lib/workflowStructure';
import { planRenameWorkflow, type RenameWorkflowErrorCode } from '../lib/workflowRename';
import { planRenumberWorkflows, type RenumberError } from '../lib/workflowRenumber';
import { removeWorkflowFromReadme } from '../lib/workflowDelete';
import { removeSourcesForDocument, getGlobalLabsamplesFolder } from '../lib/sampleStorage';
import { showOrphanRemovedNotice } from './utilityCommands';
import { buildSwUnitOpMarkdown, buildHwUnitOpMarkdown } from '../lib/unitOpTemplate';
import { getSeoulDateTimeString as getDateTime } from '../lib/dateUtils';
import {
  getActiveLabnoteEditTarget,
  labnoteDirFromTarget,
  getExperimenterForLabnoteFolder,
} from '../lib/labnoteWorkflowContext';
import type { SectionEditorProvider } from '../sectionEditorProvider';

export interface WorkflowCommandProviders {
  workflowTreeProvider: WorkflowTreeViewProvider;
  sectionEditorProvider?: SectionEditorProvider;
}

export function registerWorkflowCommands(
  context: vscode.ExtensionContext,
  providers: WorkflowCommandProviders
): void {
  const { workflowTreeProvider, sectionEditorProvider } = providers;

  // Register refresh workflow tree command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.refreshWorkflowTree', () => {
      workflowTreeProvider.refresh();
    })
  );

  // Register search workflow command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.searchWorkflow', async () => {
      const workflows = workflowTreeProvider.getWorkflows();
      const hwOps = workflowTreeProvider.getUnitOperations('hw');
      const swOps = workflowTreeProvider.getUnitOperations('sw');

      // Custom interface to avoid conflict with QuickPickItem.kind (which is QuickPickItemKind enum)
      interface WorkflowQuickPickItem extends vscode.QuickPickItem {
        itemType: 'workflow' | 'hw' | 'sw';
        data: WorkflowItem | UnitOperationItem;
      }

      // Combine all items for search
      const allItems: WorkflowQuickPickItem[] = [
        ...workflows.map(w => ({
          label: `$(symbol-class) ${w.id}: ${w.name}`,
          description: w.category,
          detail: w.description,
          itemType: 'workflow' as const,
          data: w,
        })),
        ...hwOps.map(op => ({
          label: `$(symbol-function) ${op.id}: ${op.name}`,
          description: 'HW Unit Operation',
          detail: op.description,
          itemType: 'hw' as const,
          data: op,
        })),
        ...swOps.map(op => ({
          label: `$(symbol-function) ${op.id}: ${op.name}`,
          description: 'SW Unit Operation',
          detail: op.description,
          itemType: 'sw' as const,
          data: op,
        })),
      ];

      const selected = await vscode.window.showQuickPick(allItems, {
        placeHolder: vscode.l10n.t('Search workflows / unit operations...'),
        matchOnDescription: true,
        matchOnDetail: true,
      });

      if (selected) {
        if (selected.itemType === 'workflow') {
          // Create workflow
          await vscode.commands.executeCommand('labnotev.createWorkflowFromTree', {
            workflowId: (selected.data as WorkflowItem).id,
            workflowName: (selected.data as WorkflowItem).name,
            workflowDescription: (selected.data as WorkflowItem).description,
            category: (selected.data as WorkflowItem).category,
          });
        } else {
          // Insert unit operation
          await vscode.commands.executeCommand('labnotev.insertUnitOperation', {
            opId: (selected.data as UnitOperationItem).id,
            opName: (selected.data as UnitOperationItem).name,
            opDescription: (selected.data as UnitOperationItem).description,
            opType: selected.itemType as 'hw' | 'sw',
            equipment: (selected.data as UnitOperationItem).equipment,
            software: (selected.data as UnitOperationItem).software,
          });
        }
      }
    })
  );

  // Register create workflow from tree command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.createWorkflowFromTree', async (item: WorkflowTreeItem | { workflowId: string; workflowName: string; workflowDescription: string; category: string }) => {
      const target = getActiveLabnoteEditTarget(sectionEditorProvider);
      if (!target) {
        vscode.window.showWarningMessage(vscode.l10n.t('Please open README.labnote.md.'));
        return;
      }

      // Get workflow info from item
      const workflowId = item.workflowId || (item as any).workflowId;
      const workflowName = item.workflowName || (item as any).workflowName;
      const workflowDescription = item.workflowDescription || (item as any).workflowDescription;

      if (!workflowId || !workflowName) {
        vscode.window.showErrorMessage(vscode.l10n.t('Missing workflow info.'));
        return;
      }

      const labnoteDir = labnoteDirFromTarget(target);
      const experimenter = getExperimenterForLabnoteFolder(labnoteDir);

      const existingFiles = fs.readdirSync(labnoteDir)
        .filter(file => /^\d{3}_.+\.labnote\.md$/i.test(file) && file.toLowerCase() !== 'readme.labnote.md');

      const sequence = getNextWorkflowNumber(existingFiles);
      const workflowFileName = createWorkflowFileName(sequence, {
        id: workflowId,
        name: workflowName,
        description: workflowDescription || '',
      });

      const workflowContent = createWorkflowContent({
        id: workflowId,
        name: workflowName,
        description: workflowDescription || '',
      }, experimenter);

      const workflowPath = path.join(labnoteDir, workflowFileName);
      const checklistTitle = `${sequence} ${workflowId} ${workflowName}`;

      try {
        fs.writeFileSync(workflowPath, workflowContent, 'utf8');

        if (target.mode === 'readme') {
          const editor = target.editor;
          const readmeContent = editor.document.getText();
          const existingItems = parseWorkflowChecklistFromReadme(readmeContent);
          const newItem: WorkflowChecklistItem = {
            fileName: workflowFileName,
            title: checklistTitle,
            done: false,
          };
          const allItems = [...existingItems, newItem];
          const newChecklist = generateWorkflowChecklist(allItems);
          const updatedReadme = updateReadmeWorkflowSection(readmeContent, newChecklist);
          const edit = new vscode.WorkspaceEdit();
          const fullRange = new vscode.Range(
            editor.document.positionAt(0),
            editor.document.positionAt(readmeContent.length)
          );
          edit.replace(editor.document.uri, fullRange, updatedReadme);
          await vscode.workspace.applyEdit(edit);
          await editor.document.save();
        } else if (target.mode === 'section') {
          await target.provider.mergeWorkflowIntoDocument(target.document, {
            title: checklistTitle,
            link: `./${workflowFileName}`,
            checked: false,
          });
        }

        vscode.window.showInformationMessage(vscode.l10n.t('Workflow created: {0}', workflowFileName));
      } catch (error) {
        vscode.window.showErrorMessage(vscode.l10n.t('Failed to create workflow: {0}', String(error)));
      }
    })
  );

  // Register add workflow item command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.addWorkflowItem', async (item: WorkflowTreeItem) => {
      if (!item || item.itemType !== WorkflowTreeItemType.Category) {
        return;
      }

      const category = item.category;
      if (!category) return;

      const name = await vscode.window.showInputBox({
        prompt: vscode.l10n.t('Enter a new workflow name'),
        placeHolder: 'e.g., New Workflow Design',
      });

      if (!name) return;

      const description = await vscode.window.showInputBox({
        prompt: vscode.l10n.t('Enter the workflow description'),
        placeHolder: 'e.g., A workflow for...',
      });

      if (description === undefined) return;

      const data = await loadWorkflowsFromJson(nodeFs, workflowTreeProvider.getWorkspaceRoot());
      const newId = generateNextWorkflowId(data.workflows, category);

      const updated = addWorkflowToJson(data, {
        id: newId,
        name,
        description: description || '',
        category,
      });

      await saveWorkflows(nodeFs, workflowTreeProvider.getWorkspaceRoot(), updated);
      workflowTreeProvider.refresh();

      vscode.window.showInformationMessage(vscode.l10n.t('New workflow added: {0}', newId));
    })
  );

  // Register insert unit operation command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.insertUnitOperation', async (item: WorkflowTreeItem | { opId: string; opName: string; opDescription: string; opType: 'hw' | 'sw'; equipment?: string; software?: string }) => {
      // Check section editor first. Resolve the open workflow document robustly
      // (Issue #37) so a tree-view insert works even when the active/last slot
      // is empty (focus on sidebar / a previously-closed editor cleared it).
      {
        const secDoc = sectionEditorProvider?.getActiveWorkflowDocument();
        if (secDoc) {
          const opId = item.opId || (item as any).opId;
          const opName = item.opName || (item as any).opName;
          const opDescription = item.opDescription || (item as any).opDescription;
          const software = item.software || (item as any).software;
          const opType = (item as { opType?: 'hw' | 'sw' }).opType ?? (software ? 'sw' : 'hw');
          if (!opId || !opName) {
            vscode.window.showErrorMessage(vscode.l10n.t('Missing unit operation info.'));
            return;
          }
          const dir = path.dirname(secDoc.uri.fsPath);
          const readmePath = path.join(dir, 'README.labnote.md');
          let experimenter = '';
          if (fs.existsSync(readmePath)) {
            experimenter = parseExperimenterFromReadme(fs.readFileSync(readmePath, 'utf8'));
          }
          const { buildUnitOperationBlock } = await import('../sectionEditorProvider');
          const block = buildUnitOperationBlock(opId, opName, opDescription || '', opType, experimenter);
          await sectionEditorProvider?.appendUnitOpToDocument(secDoc, block);
          vscode.window.showInformationMessage(
            vscode.l10n.t('Unit operation inserted: {0} {1}', opId, opName)
          );
          return;
        }
      }

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage(vscode.l10n.t('Please open a workflow file.'));
        return;
      }

      const workflowPath = editor.document.uri.fsPath;

      if (!isValidWorkflowPath(workflowPath)) {
        vscode.window.showWarningMessage(
          vscode.l10n.t('Please run this command on a workflow file inside the labnote folder.')
        );
        return;
      }

      // Get unit operation info
      const opId = item.opId || (item as any).opId;
      const opName = item.opName || (item as any).opName;
      const opDescription = item.opDescription || (item as any).opDescription;
      const equipment = item.equipment || (item as any).equipment;
      const software = item.software || (item as any).software;
      const opType = (item as { opType?: 'hw' | 'sw' }).opType ?? (software ? 'sw' : 'hw');

      if (!opId || !opName) {
        vscode.window.showErrorMessage(vscode.l10n.t('Missing unit operation info.'));
        return;
      }

      // Get experimenter from README
      const labnoteDir = path.dirname(workflowPath);
      const readmePath = path.join(labnoteDir, 'README.labnote.md');
      let experimenter = '';
      if (fs.existsSync(readmePath)) {
        const readmeContent = fs.readFileSync(readmePath, 'utf8');
        experimenter = parseExperimenterFromReadme(readmeContent);
      }

      const dateTime = getDateTime(new Date());
      const info = { opId, opName, opDescription };
      const template = opType === 'sw'
        ? buildSwUnitOpMarkdown(info, { experimenter, dateTime, software })
        : buildHwUnitOpMarkdown(info, { experimenter, dateTime, equipment });

      await editor.edit(editBuilder => {
        editBuilder.insert(editor.selection.active, template);
      });
      await editor.document.save();

      vscode.window.showInformationMessage(
        vscode.l10n.t('Unit operation inserted: {0} {1}', opId, opName)
      );
    })
  );

  // Register add unit operation item command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.addUnitOperationItem', async (item: WorkflowTreeItem) => {
      if (!item || item.itemType !== WorkflowTreeItemType.UnitOpRoot) {
        return;
      }

      const opType = item.opType;
      if (!opType) return;

      const name = await vscode.window.showInputBox({
        prompt: vscode.l10n.t('Enter a new unit operation name'),
        placeHolder: 'e.g., New Unit Operation',
      });

      if (!name) return;

      const description = await vscode.window.showInputBox({
        prompt: vscode.l10n.t('Enter a description'),
        placeHolder: 'e.g., A unit operation for...',
      });

      if (description === undefined) return;

      const equipOrSoft = await vscode.window.showInputBox({
        prompt: opType === 'hw' ? vscode.l10n.t('Enter the equipment') : vscode.l10n.t('Enter the software'),
        placeHolder: opType === 'hw' ? 'e.g., Centrifuge' : 'e.g., Python, R',
      });

      const data = await loadUnitOpsFromJson(nodeFs, workflowTreeProvider.getWorkspaceRoot(), opType);
      const newId = generateNextUnitOpId(data.unitOperations, opType);

      const newOp: UnitOperationItem = {
        id: newId,
        name,
        description: description || '',
        ...(opType === 'hw' ? { equipment: equipOrSoft || '' } : { software: equipOrSoft || '' }),
      };

      const updated = addUnitOpToJson(data, newOp);
      await saveUnitOperations(nodeFs, workflowTreeProvider.getWorkspaceRoot(), opType, updated);
      workflowTreeProvider.refresh();

      vscode.window.showInformationMessage(vscode.l10n.t('New unit operation added: {0}', newId));
    })
  );

  // Issue #19: rename a workflow file in one command. Keeps id/sequence
  // immutable, rewrites the workflow body (front matter title + matching H2
  // heading), renames the file on disk, and updates the sibling README's
  // checklist entry if one exists. Available from the Explorer right-click
  // menu on `{seq}_{id}_{name}.labnote.md` and from the Command Palette while
  // such a file is the active editor.
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.renameWorkflow', async (uri?: vscode.Uri) => {
      const targetUri = uri ?? resolveActiveWorkflowUri(sectionEditorProvider);
      if (!targetUri) {
        vscode.window.showWarningMessage(
          vscode.l10n.t('Cannot find a workflow file to rename. Open one and try again.')
        );
        return;
      }
      if (!isValidWorkflowPath(targetUri.fsPath)) {
        vscode.window.showWarningMessage(vscode.l10n.t('This file is not a workflow file.'));
        return;
      }

      const oldFileName = path.basename(targetUri.fsPath);
      const parsed = parseWorkflowFileName(oldFileName);
      if (!parsed) {
        vscode.window.showWarningMessage(vscode.l10n.t('Not a workflow file name.'));
        return;
      }

      const dirPath = path.dirname(targetUri.fsPath);
      const readmePath = path.join(dirPath, 'README.labnote.md');
      const hasReadme = fs.existsSync(readmePath);

      // Load the workflow document. If it is open and dirty save first so the
      // rename does not collide with in-memory user edits.
      const doc = await vscode.workspace.openTextDocument(targetUri);
      if (doc.isDirty) {
        await doc.save();
      }

      const oldContent = doc.getText();
      const oldDisplayName = extractWorkflowName(oldContent, parsed.id) ?? parsed.safeName;

      const newName = await vscode.window.showInputBox({
        prompt: vscode.l10n.t('Rename workflow ({0})', parsed.id),
        value: oldDisplayName,
        validateInput: (value) => {
          if (!value || value.trim() === '') return vscode.l10n.t('Please enter a name.');
          if (sanitizeWorkflowName(value) === '') {
            return vscode.l10n.t('Name must contain at least one letter, digit, or underscore.');
          }
          if (value === oldDisplayName) return vscode.l10n.t('Please enter a different name.');
          const wouldBeFile = createWorkflowFileName(parsed.sequence, {
            id: parsed.id,
            name: value,
            description: '',
          });
          if (wouldBeFile === oldFileName) return null;
          if (fs.existsSync(path.join(dirPath, wouldBeFile))) {
            return vscode.l10n.t('A workflow with this name already exists: {0}', wouldBeFile);
          }
          return null;
        },
      });

      if (!newName) return;

      const oldReadmeContent = hasReadme ? fs.readFileSync(readmePath, 'utf8') : null;
      const planResult = planRenameWorkflow({
        workflowFilePath: targetUri.fsPath,
        oldWorkflowContent: oldContent,
        readmePath: hasReadme ? readmePath : null,
        oldReadmeContent,
        newName,
      });

      if ('error' in planResult) {
        vscode.window.showWarningMessage(renameWorkflowErrorMessage(planResult.error.code));
        return;
      }

      try {
        // 1) Update the workflow body first so the rename only carries valid
        //    content over to the new path.
        const bodyEdit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
          doc.positionAt(0),
          doc.positionAt(oldContent.length)
        );
        bodyEdit.replace(targetUri, fullRange, planResult.newFileContent);
        await vscode.workspace.applyEdit(bodyEdit);
        await doc.save();

        // 2) Rename the file. VS Code keeps the open document's URI in sync
        //    so the Section Editor / text editor follow automatically.
        const newUri = vscode.Uri.file(planResult.newFilePath);
        await vscode.workspace.fs.rename(targetUri, newUri, { overwrite: false });

        // 3) Update the sibling README checklist last so a mid-flight failure
        //    here leaves only the README link stale (recoverable manually).
        if (planResult.readmePath && planResult.newReadmeContent !== null) {
          const readmeUri = vscode.Uri.file(planResult.readmePath);
          const readmeDoc = await vscode.workspace.openTextDocument(readmeUri);
          const readmeOldText = readmeDoc.getText();
          const readmeEdit = new vscode.WorkspaceEdit();
          readmeEdit.replace(
            readmeUri,
            new vscode.Range(
              readmeDoc.positionAt(0),
              readmeDoc.positionAt(readmeOldText.length)
            ),
            planResult.newReadmeContent
          );
          await vscode.workspace.applyEdit(readmeEdit);
          await readmeDoc.save();
        }

        vscode.window.showInformationMessage(
          vscode.l10n.t('Workflow renamed: {0}', planResult.newDisplayName)
        );
      } catch (error) {
        vscode.window.showErrorMessage(vscode.l10n.t('Failed to rename workflow: {0}', String(error)));
      }
    })
  );

  // Issue #38 follow-up (C option): renumber workflow files so their `NNN`
  // sequence prefixes match the current README checklist order. Reordering
  // stays a pure webview action; this command aligns the on-disk numbers on
  // demand. Available from the Command Palette, the README Explorer context
  // menu, and the webview's Related Workflows section.
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.renumberWorkflows', async (uri?: vscode.Uri) => {
      const readmeUri = resolveReadmeUri(uri, sectionEditorProvider);
      if (!readmeUri) {
        vscode.window.showWarningMessage(vscode.l10n.t('Please open README.labnote.md.'));
        return;
      }
      const dirPath = path.dirname(readmeUri.fsPath);

      // Save the README first: a pending webview reorder may not be flushed
      // yet, and reading the live (saved) text guarantees we renumber the
      // order the user actually sees.
      const readmeDoc = await vscode.workspace.openTextDocument(readmeUri);
      if (readmeDoc.isDirty) {
        await readmeDoc.save();
      }
      const readmeContent = readmeDoc.getText();
      const items = parseWorkflowChecklistFromReadme(readmeContent);

      let diskWorkflowFiles: string[];
      try {
        diskWorkflowFiles = fs
          .readdirSync(dirPath)
          .filter(f => f.toLowerCase() !== 'readme.labnote.md' && parseWorkflowFileName(f) !== null);
      } catch {
        diskWorkflowFiles = [];
      }

      const plan = planRenumberWorkflows({ items, diskWorkflowFiles });
      if ('error' in plan) {
        vscode.window.showWarningMessage(renumberWorkflowErrorMessage(plan.error));
        return;
      }
      if (!plan.changed) {
        vscode.window.showInformationMessage(
          vscode.l10n.t('Workflow numbers already match the list order.')
        );
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        vscode.l10n.t('Renumber {0} workflow file(s) to match the README order?', plan.renames.length),
        { modal: true },
        vscode.l10n.t('Renumber')
      );
      if (!confirm) return;

      try {
        // Save any dirty open editors for the files we are about to move so
        // the rename does not collide with in-memory edits.
        for (const r of plan.renames) {
          const oldPath = path.join(dirPath, r.oldFileName);
          const openDoc = vscode.workspace.textDocuments.find(d => d.uri.fsPath === oldPath);
          if (openDoc && openDoc.isDirty) {
            await openDoc.save();
          }
        }

        // Two-phase rename via unique temp names avoids collisions when the
        // new numbering forms a cycle/swap (e.g. 001<->002). `fs.rename` keeps
        // open editors' URIs in sync so the Section Editor follows along.
        const staged: { tempUri: vscode.Uri; finalUri: vscode.Uri }[] = [];
        for (let i = 0; i < plan.renames.length; i++) {
          const r = plan.renames[i];
          const oldUri = vscode.Uri.file(path.join(dirPath, r.oldFileName));
          const tempUri = vscode.Uri.file(path.join(dirPath, `${r.oldFileName}.renumber-tmp-${i}`));
          await vscode.workspace.fs.rename(oldUri, tempUri, { overwrite: false });
          staged.push({ tempUri, finalUri: vscode.Uri.file(path.join(dirPath, r.newFileName)) });
        }
        try {
          for (const s of staged) {
            await vscode.workspace.fs.rename(s.tempUri, s.finalUri, { overwrite: false });
          }
        } catch (renameError) {
          // Best-effort cleanup: restore any temp file that has not reached its
          // final name so we do not leave dangling `*.renumber-tmp-*` files.
          for (const s of staged) {
            try {
              await vscode.workspace.fs.stat(s.tempUri);
              await vscode.workspace.fs.rename(s.tempUri, s.finalUri, { overwrite: false });
            } catch {
              // ignore; the file was already moved or cannot be recovered here
            }
          }
          throw renameError;
        }

        // README update last so a mid-flight failure leaves only stale README
        // links (recoverable by re-running the command).
        const currentText = readmeDoc.getText();
        const newReadme = updateReadmeWorkflowSection(
          currentText,
          generateWorkflowChecklist(plan.newItems)
        );
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
          readmeUri,
          new vscode.Range(readmeDoc.positionAt(0), readmeDoc.positionAt(currentText.length)),
          newReadme
        );
        await vscode.workspace.applyEdit(edit);
        await readmeDoc.save();

        vscode.window.showInformationMessage(
          vscode.l10n.t('Renumbered {0} workflow(s).', plan.renames.length)
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          vscode.l10n.t('Failed to renumber workflows: {0}', String(error))
        );
      }
    })
  );

  // Issue #38 follow-up: delete a workflow file. Moves the file to the trash,
  // removes its README checklist entry, and cleans up samples defined only in
  // this document. Attachments/images live in folder-shared `resources/` and
  // `images/` dirs so they are intentionally left untouched. Offers to
  // renumber the remaining workflows afterwards.
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.deleteWorkflow', async (uri?: vscode.Uri) => {
      const targetUri = uri ?? resolveActiveWorkflowUri(sectionEditorProvider);
      if (!targetUri) {
        vscode.window.showWarningMessage(
          vscode.l10n.t('Cannot find a workflow file to delete. Open one and try again.')
        );
        return;
      }
      if (!isValidWorkflowPath(targetUri.fsPath)) {
        vscode.window.showWarningMessage(vscode.l10n.t('This file is not a workflow file.'));
        return;
      }

      const fileName = path.basename(targetUri.fsPath);
      const deleteLabel = vscode.l10n.t('Delete');
      const confirm = await vscode.window.showWarningMessage(
        vscode.l10n.t('Delete workflow "{0}"? The file will be moved to the trash.', fileName),
        { modal: true },
        deleteLabel
      );
      if (confirm !== deleteLabel) return;

      // Close any open tabs for the file so a custom editor (Section Editor)
      // does not linger in a broken state once the file is gone.
      try {
        for (const group of vscode.window.tabGroups.all) {
          for (const tab of group.tabs) {
            const input = tab.input as { uri?: vscode.Uri } | undefined;
            if (input?.uri && input.uri.fsPath === targetUri.fsPath) {
              await vscode.window.tabGroups.close(tab);
            }
          }
        }
      } catch {
        // best-effort; ignore tab-close failures
      }

      try {
        await vscode.workspace.fs.delete(targetUri, { useTrash: true });
      } catch (error) {
        vscode.window.showErrorMessage(
          vscode.l10n.t('Failed to delete workflow: {0}', String(error))
        );
        return;
      }

      // Clean up samples defined only in this document, AFTER the file deletion
      // succeeds. Running this first risked stripping sample definitions while
      // the workflow file was still present if the deletion then failed. This
      // remains best-effort: a cleanup failure must not surface as a delete
      // failure now that the file is already gone.
      try {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        const globalLabsamplesFolder = workspaceRoot
          ? getGlobalLabsamplesFolder(workspaceRoot)
          : undefined;
        const customTypes = vscode.workspace
          .getConfiguration('labnotev')
          .get<string[]>('customSampleTypes', []);
        const removed = await removeSourcesForDocument(nodeFs, targetUri.fsPath, '', globalLabsamplesFolder, customTypes);
        if (removed.length > 0) {
          showOrphanRemovedNotice(removed);
          await vscode.commands.executeCommand('labnotev.refreshSampleTree');
          sectionEditorProvider?.broadcastSampleDefsUpdated();
        }
      } catch (error) {
        console.warn('[labnotev] Sample cleanup during workflow delete failed:', error);
      }

      // Remove the sibling README checklist entry last (a mid-flight failure
      // here only leaves a stale link, recoverable manually).
      const readmePath = path.join(path.dirname(targetUri.fsPath), 'README.labnote.md');
      const readmeUri = vscode.Uri.file(readmePath);
      if (fs.existsSync(readmePath)) {
        try {
          const readmeDoc = await vscode.workspace.openTextDocument(readmeUri);
          if (readmeDoc.isDirty) {
            await readmeDoc.save();
          }
          const oldText = readmeDoc.getText();
          const { changed, content } = removeWorkflowFromReadme(oldText, fileName);
          if (changed) {
            const edit = new vscode.WorkspaceEdit();
            edit.replace(
              readmeUri,
              new vscode.Range(readmeDoc.positionAt(0), readmeDoc.positionAt(oldText.length)),
              content
            );
            await vscode.workspace.applyEdit(edit);
            await readmeDoc.save();
          }
        } catch (error) {
          console.warn('[labnotev] README update during workflow delete failed:', error);
        }
      }

      const renumberLabel = vscode.l10n.t('Renumber');
      const choice = await vscode.window.showInformationMessage(
        vscode.l10n.t('Workflow deleted: {0}', fileName),
        renumberLabel
      );
      if (choice === renumberLabel && fs.existsSync(readmePath)) {
        await vscode.commands.executeCommand('labnotev.renumberWorkflows', readmeUri);
      }
    })
  );
}

/**
 * Resolve the README.labnote.md URI for the renumber command. Accepts an
 * Explorer/webview argument (README itself or a sibling labnote file) and
 * falls back to the active labnote edit target (README text editor or Section
 * Editor document).
 */
function resolveReadmeUri(
  uri: vscode.Uri | undefined,
  sectionEditorProvider: SectionEditorProvider | undefined
): vscode.Uri | undefined {
  if (uri && isValidReadmePath(uri.fsPath)) {
    return uri;
  }
  const target = getActiveLabnoteEditTarget(sectionEditorProvider);
  if (target) {
    const readmePath = path.join(labnoteDirFromTarget(target), 'README.labnote.md');
    if (fs.existsSync(readmePath)) return vscode.Uri.file(readmePath);
  }
  if (uri) {
    const sibling = path.join(path.dirname(uri.fsPath), 'README.labnote.md');
    if (fs.existsSync(sibling)) return vscode.Uri.file(sibling);
  }
  return undefined;
}

/**
 * Map a {@link RenumberError} to a localised, user-facing message. The English
 * source strings double as keys for the VS Code l10n bundle.
 */
function renumberWorkflowErrorMessage(error: RenumberError): string {
  const list = (error.details ?? []).join(', ');
  switch (error.code) {
    case 'no_items':
      return vscode.l10n.t('No workflows to renumber.');
    case 'invalid_filename':
      return vscode.l10n.t('Cannot renumber: these entries are not workflow files: {0}', list);
    case 'missing_files':
      return vscode.l10n.t('Cannot renumber: these listed files are missing on disk: {0}', list);
    case 'orphan_files':
      return vscode.l10n.t(
        'Cannot renumber: these workflow files are not in the README list: {0}. Add them to the list or remove them, then try again.',
        list
      );
  }
}

/**
 * Resolves the active workflow URI when the user invokes the rename command
 * without an Explorer-context argument. Falls back through the standard text
 * editor and the Section Editor's last active document.
 */
function resolveActiveWorkflowUri(
  sectionEditorProvider: SectionEditorProvider | undefined
): vscode.Uri | undefined {
  const active = vscode.window.activeTextEditor?.document.uri;
  if (active && isValidWorkflowPath(active.fsPath)) return active;
  const fromSection = sectionEditorProvider?.getActiveDocument()?.uri;
  if (fromSection && isValidWorkflowPath(fromSection.fsPath)) return fromSection;
  return undefined;
}

/**
 * Map a {@link RenameWorkflowErrorCode} to a localised, user-facing message.
 * The English source strings double as keys for the VS Code l10n bundle.
 */
function renameWorkflowErrorMessage(code: RenameWorkflowErrorCode): string {
  switch (code) {
    case 'invalid_filename':
      return vscode.l10n.t('Not a workflow file name.');
    case 'empty_name':
      return vscode.l10n.t('Please enter a name.');
    case 'sanitized_empty':
      return vscode.l10n.t('Name must contain at least one letter, digit, or underscore.');
    case 'no_change':
      return vscode.l10n.t('No changes detected.');
    case 'ambiguous_readme':
      return vscode.l10n.t('Multiple checklist items reference this file.');
  }
}
