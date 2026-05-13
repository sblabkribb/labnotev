import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { createLabnoteStructure } from '../lib/labnoteStructure';
import {
  getActiveLabnoteEditTarget,
  labnoteDirFromTarget,
  getExperimenterForLabnoteFolder,
} from '../lib/labnoteWorkflowContext';
import {
  isValidReadmePath,
  isValidWorkflowPath,
  getNextWorkflowNumber,
  createWorkflowContent,
  createWorkflowFileName,
  parseWorkflowChecklistFromReadme,
  generateWorkflowChecklist,
  updateReadmeWorkflowSection,
  parseExperimenterFromReadme,
  WorkflowChecklistItem,
} from '../lib/workflowStructure';
import { getSeoulDateTimeString as getDateTime } from '../lib/dateUtils';
import { buildSwUnitOpMarkdown, buildHwUnitOpMarkdown } from '../lib/unitOpTemplate';
import type { SectionEditorProvider } from '../sectionEditorProvider';

export interface CreationCommandDeps {
  sectionEditorProvider?: SectionEditorProvider;
}

// Workflow and Unit Operation types from JSON resources
interface WorkflowJson {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface UnitOperationJson {
  id: string;
  name: string;
  description: string;
  equipment?: string;
  software?: string;
}

// Load workflows from JSON
function loadWorkflows(extensionPath: string): WorkflowJson[] {
  const filePath = path.join(extensionPath, 'resources', 'workflows', 'workflows_en.json');
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      return data.workflows || [];
    }
  } catch (error) {
    console.error('[LabNoteV] Failed to load workflows:', error);
  }
  return [];
}

// Load unit operations from JSON
function loadUnitOperations(extensionPath: string, type: 'hw' | 'sw'): UnitOperationJson[] {
  const fileName = type === 'hw' ? 'unitoperations_hw_en.json' : 'unitoperations_sw_en.json';
  const filePath = path.join(extensionPath, 'resources', 'workflows', fileName);
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      return data.unitOperations || [];
    }
  } catch (error) {
    console.error(`[LabNoteV] Failed to load ${type} unit operations:`, error);
  }
  return [];
}

export function registerCreationCommands(
  context: vscode.ExtensionContext,
  deps?: CreationCommandDeps
): void {
  const { sectionEditorProvider } = deps ?? {};
  // Register create labnote command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.createLabnote', async () => {
      console.log('[LabNoteV] createLabnote command started');

      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        console.log('[LabNoteV] No workspace folder found');
        vscode.window.showErrorMessage(vscode.l10n.t('Please open a folder first.'));
        return;
      }

      const workspaceRoot = workspaceFolders[0].uri.fsPath;
      console.log('[LabNoteV] Workspace root:', workspaceRoot);

      // Get existing labnote folders
      const labnoteDir = path.join(workspaceRoot, 'labnote');
      console.log('[LabNoteV] Labnote dir:', labnoteDir);

      let existingFolders: string[] = [];
      if (fs.existsSync(labnoteDir)) {
        existingFolders = fs.readdirSync(labnoteDir, { withFileTypes: true })
          .filter(entry => entry.isDirectory() && /^\d{3}_/.test(entry.name))
          .map(entry => entry.name);
        console.log('[LabNoteV] Existing folders:', existingFolders);
      } else {
        console.log('[LabNoteV] Labnote dir does not exist yet');
      }

      // Prompt for title
      const title = await vscode.window.showInputBox({
        prompt: vscode.l10n.t('Enter a title for the new lab note'),
        placeHolder: 'Protein Folding Experiment',
        validateInput: value =>
          (!!value && value.trim().length > 0 ? undefined : vscode.l10n.t('Please enter a title.'))
      });

      if (!title) {
        console.log('[LabNoteV] User cancelled title input');
        return;
      }
      console.log('[LabNoteV] Title entered:', title);

      // Prompt for author (optional)
      const author = await vscode.window.showInputBox({
        prompt: vscode.l10n.t('Author name (optional)'),
        placeHolder: 'John Doe'
      });
      console.log('[LabNoteV] Author entered:', author);

      // Create structure
      const structure = createLabnoteStructure(workspaceRoot, title.trim(), existingFolders, author?.trim());
      console.log('[LabNoteV] Structure created:', JSON.stringify(structure, null, 2));

      try {
        // Create folders
        console.log('[LabNoteV] Creating folder:', structure.labnoteFolder);
        fs.mkdirSync(structure.labnoteFolder, { recursive: true });
        console.log('[LabNoteV] Creating images folder:', structure.imagesFolder);
        fs.mkdirSync(structure.imagesFolder, { recursive: true });
        console.log('[LabNoteV] Creating resources folder:', structure.resourcesFolder);
        fs.mkdirSync(structure.resourcesFolder, { recursive: true });

        // Write README.md
        console.log('[LabNoteV] Writing README.md:', structure.readmePath);
        fs.writeFileSync(structure.readmePath, structure.readmeContent, 'utf8');

        const document = await vscode.workspace.openTextDocument(structure.readmePath);
        await vscode.window.showTextDocument(document, { preview: false });

        console.log('[LabNoteV] Labnote created successfully');
        vscode.window.showInformationMessage(
          vscode.l10n.t('Lab note created: {0}', path.basename(structure.labnoteFolder))
        );
      } catch (error) {
        console.error('[LabNoteV] Error creating labnote:', error);
        vscode.window.showErrorMessage(vscode.l10n.t('Failed to create lab note: {0}', String(error)));
      }
    })
  );

  // Register add workflow command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.addWorkflow', async () => {
      const target = getActiveLabnoteEditTarget(sectionEditorProvider);
      if (!target) {
        vscode.window.showWarningMessage(vscode.l10n.t('Please open README.labnote.md.'));
        return;
      }

      const workflows = loadWorkflows(context.extensionPath);
      if (workflows.length === 0) {
        vscode.window.showErrorMessage(vscode.l10n.t('Failed to load workflow catalog.'));
        return;
      }

      const workflowItems = workflows.map((wf) => ({
        label: `${wf.id}: ${wf.name}`,
        description: wf.category,
        detail: wf.description,
        workflow: wf,
      }));

      const selected = await vscode.window.showQuickPick(workflowItems, {
        placeHolder: vscode.l10n.t('Select a workflow template'),
        matchOnDescription: true,
        matchOnDetail: true,
      });

      if (!selected) {
        return;
      }

      const labnoteDir = labnoteDirFromTarget(target);
      const experimenter = getExperimenterForLabnoteFolder(labnoteDir);

      const existingFiles = fs.readdirSync(labnoteDir).filter(
        (file) => /^\d{3}_.+\.labnote\.md$/i.test(file) && file.toLowerCase() !== 'readme.labnote.md'
      );

      const sequence = getNextWorkflowNumber(existingFiles);
      const workflowFileName = createWorkflowFileName(
        sequence,
        {
          id: selected.workflow.id,
          name: selected.workflow.name,
          description: selected.workflow.description,
        }
      );

      const workflowContent = createWorkflowContent(
        {
          id: selected.workflow.id,
          name: selected.workflow.name,
          description: selected.workflow.description,
        },
        experimenter
      );

      const workflowPath = path.join(labnoteDir, workflowFileName);
      const checklistTitle = `${sequence} ${selected.workflow.id} ${selected.workflow.name}`;

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

  // Register add unit operation command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.addUnitOperation', async () => {
      // Select category (Hardware or Software)
      const categoryChoice = await vscode.window.showQuickPick([
        { label: 'Hardware', description: vscode.l10n.t('Lab equipment and automation hardware') },
        { label: 'Software', description: vscode.l10n.t('Data analysis and software tools') },
      ], {
        placeHolder: vscode.l10n.t('Select a unit operation category'),
      });

      if (!categoryChoice) {
        return;
      }

      const category = categoryChoice.label as 'Hardware' | 'Software';
      const opType = category === 'Hardware' ? 'hw' : 'sw';

      // Load unit operations from JSON resources
      const operations = loadUnitOperations(context.extensionPath, opType);

      if (operations.length === 0) {
        vscode.window.showErrorMessage(vscode.l10n.t('Failed to load unit operation catalog.'));
        return;
      }

      // Select unit operation
      const operationItems = operations.map(op => ({
        label: `${op.id}: ${op.name}`,
        detail: op.description,
        operation: op,
      }));

      const selectedOp = await vscode.window.showQuickPick(operationItems, {
        placeHolder: vscode.l10n.t('Select a unit operation'),
        matchOnDetail: true,
      });

      if (!selectedOp) {
        return;
      }

      const op = selectedOp.operation;

      // Section Editor path
      if (sectionEditorProvider?.getEditorMode() === 'workflow') {
        const secDoc = sectionEditorProvider.getActiveDocument();
        if (secDoc) {
          const dir = path.dirname(secDoc.uri.fsPath);
          const readmePath = path.join(dir, 'README.labnote.md');
          let experimenter = '';
          if (fs.existsSync(readmePath)) {
            experimenter = parseExperimenterFromReadme(fs.readFileSync(readmePath, 'utf8'));
          }
          const { buildUnitOperationBlock } = await import('../sectionEditorProvider');
          const block = buildUnitOperationBlock(op.id, op.name, op.description || '', opType as 'hw' | 'sw', experimenter);
          await sectionEditorProvider.appendUnitOpToDocument(secDoc, block);
          vscode.window.showInformationMessage(
            vscode.l10n.t('Unit operation inserted: {0} {1}', op.id, op.name)
          );
          return;
        }
      }

      // Text editor path
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

      // Optional description
      const userDescription = await vscode.window.showInputBox({
        prompt: vscode.l10n.t('Unit operation description (optional)'),
        placeHolder: 'e.g., replicate B',
      });

      const labnoteDir = path.dirname(workflowPath);
      const readmePath = path.join(labnoteDir, 'README.labnote.md');
      let experimenter = '';
      if (fs.existsSync(readmePath)) {
        const readmeContent = fs.readFileSync(readmePath, 'utf8');
        experimenter = parseExperimenterFromReadme(readmeContent);
      }

      const dateTime = getDateTime(new Date());
      const descriptionPart = userDescription ? ` ${userDescription.trim()}` : '';
      const isSw = category === 'Software';

      const info = {
        opId: op.id,
        opName: op.name,
        opDescription: op.description,
        descriptionExtra: descriptionPart,
      };
      const template = isSw
        ? buildSwUnitOpMarkdown(info, { experimenter, dateTime })
        : buildHwUnitOpMarkdown(info, { experimenter, dateTime });

      try {
        await editor.edit(editBuilder => {
          editBuilder.insert(editor.selection.active, template);
        });
        await editor.document.save();
        vscode.window.showInformationMessage(
          vscode.l10n.t('Unit operation inserted: {0} {1}', op.id, op.name)
        );
      } catch (error) {
        vscode.window.showErrorMessage(vscode.l10n.t('Failed to insert unit operation: {0}', String(error)));
      }
    })
  );

  // Register manage templates command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.manageTemplates', async () => {
      const workflowsPath = path.join(context.extensionPath, 'resources', 'workflows');

      const files = [
        { label: 'workflows_en.json', description: vscode.l10n.t('Workflow catalog (68 entries)') },
        { label: 'unitoperations_hw_en.json', description: vscode.l10n.t('HW unit operation catalog (50 entries)') },
        { label: 'unitoperations_sw_en.json', description: vscode.l10n.t('SW unit operation catalog (40 entries)') },
      ];

      const selected = await vscode.window.showQuickPick(files, {
        placeHolder: vscode.l10n.t('Select a template file to edit'),
      });

      if (selected) {
        const filePath = path.join(workflowsPath, selected.label);
        if (fs.existsSync(filePath)) {
          const document = await vscode.workspace.openTextDocument(filePath);
          await vscode.window.showTextDocument(document);
        } else {
          vscode.window.showErrorMessage(vscode.l10n.t('File not found: {0}', selected.label));
        }
      }
    })
  );
}
