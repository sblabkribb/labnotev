import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { createLabnoteStructure } from '../lib/labnoteStructure';
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
  context: vscode.ExtensionContext
): void {
  // Register create labnote command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.createLabnote', async () => {
      console.log('[LabNoteV] createLabnote command started');

      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        console.log('[LabNoteV] No workspace folder found');
        vscode.window.showErrorMessage('먼저 폴더를 열어주세요');
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
        prompt: '새 실험 노트 제목을 입력하세요',
        placeHolder: 'Protein Folding Experiment',
        validateInput: value => (!!value && value.trim().length > 0 ? undefined : '제목을 입력하세요')
      });

      if (!title) {
        console.log('[LabNoteV] User cancelled title input');
        return;
      }
      console.log('[LabNoteV] Title entered:', title);

      // Prompt for author (optional)
      const author = await vscode.window.showInputBox({
        prompt: '작성자 이름 (선택 사항)',
        placeHolder: '홍길동'
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

        // Open the README.md
        console.log('[LabNoteV] Opening README.md');
        const document = await vscode.workspace.openTextDocument(structure.readmePath);
        await vscode.window.showTextDocument(document, { preview: false });

        console.log('[LabNoteV] Labnote created successfully');
        vscode.window.showInformationMessage(`실험 노트가 생성되었습니다: ${path.basename(structure.labnoteFolder)}`);
      } catch (error) {
        console.error('[LabNoteV] Error creating labnote:', error);
        vscode.window.showErrorMessage(`실험 노트 생성 실패: ${error}`);
      }
    })
  );

  // Register add workflow command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.addWorkflow', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('README.md 파일을 열어주세요');
        return;
      }

      const readmePath = editor.document.uri.fsPath;

      // Validate path
      if (!isValidReadmePath(readmePath)) {
        vscode.window.showWarningMessage('labnote 폴더 내의 README.md 파일에서 실행해주세요');
        return;
      }

      // Load workflows from JSON resources
      const workflows = loadWorkflows(context.extensionPath);
      if (workflows.length === 0) {
        vscode.window.showErrorMessage('워크플로 카탈로그를 로드할 수 없습니다');
        return;
      }

      // Select workflow from list
      const workflowItems = workflows.map(wf => ({
        label: `${wf.id}: ${wf.name}`,
        description: wf.category,
        detail: wf.description,
        workflow: wf,
      }));

      const selected = await vscode.window.showQuickPick(workflowItems, {
        placeHolder: '워크플로 템플릿을 선택하세요',
        matchOnDescription: true,
        matchOnDetail: true,
      });

      if (!selected) {
        return;
      }

      // Optional description
      const userDescription = await vscode.window.showInputBox({
        prompt: '워크플로 설명 (선택 사항)',
        placeHolder: 'e.g., Day 1 prep',
      });

      // Get experimenter from README
      const readmeContent = editor.document.getText();
      const experimenter = parseExperimenterFromReadme(readmeContent);

      // Get existing workflow files (.md only, excluding README.md)
      const labnoteDir = path.dirname(readmePath);
      const existingFiles = fs.readdirSync(labnoteDir)
        .filter(file => /^\d{3}_.+\.md$/i.test(file) && file.toLowerCase() !== 'readme.md');

      // Create workflow file
      const sequence = getNextWorkflowNumber(existingFiles);
      const workflowFileName = createWorkflowFileName(sequence, {
        id: selected.workflow.id,
        name: selected.workflow.name,
        description: selected.workflow.description,
      }, userDescription?.trim() || '');

      const workflowContent = createWorkflowContent({
        id: selected.workflow.id,
        name: selected.workflow.name,
        description: selected.workflow.description,
      }, userDescription?.trim() || '', experimenter);

      const workflowPath = path.join(labnoteDir, workflowFileName);

      try {
        // Write workflow file
        fs.writeFileSync(workflowPath, workflowContent, 'utf8');

        // Update README.md with new checklist item
        const existingItems = parseWorkflowChecklistFromReadme(readmeContent);
        const newItem: WorkflowChecklistItem = {
          fileName: workflowFileName,
          title: `${sequence} ${selected.workflow.id} ${selected.workflow.name}${userDescription ? ` - ${userDescription}` : ''}`,
          done: false,
        };

        const allItems = [...existingItems, newItem];
        const newChecklist = generateWorkflowChecklist(allItems);
        const updatedReadme = updateReadmeWorkflowSection(readmeContent, newChecklist);

        // Update README
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
          editor.document.positionAt(0),
          editor.document.positionAt(readmeContent.length)
        );
        edit.replace(editor.document.uri, fullRange, updatedReadme);
        await vscode.workspace.applyEdit(edit);
        await editor.document.save();

        // Stay on README.md (don't open workflow file)
        vscode.window.showInformationMessage(`워크플로가 생성되었습니다: ${workflowFileName}`);
      } catch (error) {
        vscode.window.showErrorMessage(`워크플로 생성 실패: ${error}`);
      }
    })
  );

  // Register add unit operation command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.addUnitOperation', async () => {
      console.log('[LabNoteV] addUnitOperation command started');

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        console.log('[LabNoteV] No active editor');
        vscode.window.showWarningMessage('워크플로 파일을 열어주세요');
        return;
      }

      const workflowPath = editor.document.uri.fsPath;
      console.log('[LabNoteV] Workflow path:', workflowPath);

      // Validate path
      const validPath = isValidWorkflowPath(workflowPath);
      console.log('[LabNoteV] isValidWorkflowPath:', validPath);

      if (!validPath) {
        vscode.window.showWarningMessage('labnote 폴더 내의 워크플로 파일에서 실행해주세요');
        return;
      }

      // Select category (Hardware or Software)
      const categoryChoice = await vscode.window.showQuickPick([
        { label: 'Hardware', description: '실험 장비 및 자동화 하드웨어' },
        { label: 'Software', description: '데이터 분석 및 소프트웨어 도구' },
      ], {
        placeHolder: '유닛 오퍼레이션 카테고리를 선택하세요',
      });

      if (!categoryChoice) {
        return;
      }

      const category = categoryChoice.label as 'Hardware' | 'Software';
      console.log('[LabNoteV] Selected category:', category);

      // Load unit operations from JSON resources
      const operations = loadUnitOperations(context.extensionPath, category === 'Hardware' ? 'hw' : 'sw');
      console.log('[LabNoteV] Operations count:', operations.length);

      if (operations.length === 0) {
        vscode.window.showErrorMessage('유닛 오퍼레이션 카탈로그를 로드할 수 없습니다');
        return;
      }

      // Select unit operation
      const operationItems = operations.map(op => ({
        label: `${op.id}: ${op.name}`,
        detail: op.description,
        operation: op,
      }));

      const selected = await vscode.window.showQuickPick(operationItems, {
        placeHolder: '유닛 오퍼레이션을 선택하세요',
        matchOnDetail: true,
      });

      if (!selected) {
        return;
      }

      // Optional description
      const userDescription = await vscode.window.showInputBox({
        prompt: '유닛 오퍼레이션 설명 (선택 사항)',
        placeHolder: 'e.g., replicate B',
      });

      // Get experimenter from README in parent folder
      const labnoteDir = path.dirname(workflowPath);
      const readmePath = path.join(labnoteDir, 'README.md');
      let experimenter = '';
      if (fs.existsSync(readmePath)) {
        const readmeContent = fs.readFileSync(readmePath, 'utf8');
        experimenter = parseExperimenterFromReadme(readmeContent);
      }

      // Generate unit operation template (HW: lab-style sections; SW: Input/Output/Parameters/QC Metrics/Method/Environment/Discussion)
      const dateTime = getDateTime(new Date());
      const op = selected.operation;
      const descriptionPart = userDescription ? ` ${userDescription.trim()}` : '';
      const isSw = category === 'Software';

      const template = isSw
        ? `

---

### [${op.id} ${op.name}]${descriptionPart}

> ${op.description}

#### Meta
- Experimenter: ${experimenter}
- Start_date: '${dateTime}'
- End_date: ''
- Software:

#### Input
- (이전 단계 산출물, 데이터, 모델)

#### Output
- (다음 단계로 넘어갈 산출물: 파일, 데이터셋, 모델)

#### Parameters
- (옵션, 하이퍼파라미터, seed)

#### QC Metrics
- (성능 지표, QC 지표)

#### Method
- (소프트웨어/모델 + 자연어 설명)

#### Environment
- (conda / poetry / container / OS / HW)

#### Discussion
- (다음 단계에 대한 코멘트)

`
        : `

---

### [${op.id} ${op.name}]${descriptionPart}

> ${op.description}

#### Meta
- Experimenter: ${experimenter}
- Start_date: '${dateTime}'
- End_date: ''

#### Input
- (samples from the previous step)

#### Reagent
- (e.g. enzyme, buffer, etc.)

#### Consumables
- (e.g. filter, well-plate, etc.)

#### Equipment
- (e.g. centrifuge, spectrophotometer, etc.)

#### Method
- (method used in this step)

#### Output
- (samples to the next step)

#### Results & Discussions
- (Any results and discussions. Link file path if needed)

`;

      console.log('[LabNoteV] Template length:', template.length);
      console.log('[LabNoteV] Inserting at position:', editor.selection.active.line, editor.selection.active.character);

      // Insert at cursor position
      try {
        const success = await editor.edit(editBuilder => {
          editBuilder.insert(editor.selection.active, template);
        });
        console.log('[LabNoteV] Edit success:', success);

        await editor.document.save();
        console.log('[LabNoteV] Document saved');

        vscode.window.showInformationMessage(`유닛 오퍼레이션이 삽입되었습니다: ${op.id} ${op.name}`);
      } catch (error) {
        console.error('[LabNoteV] Error inserting template:', error);
        vscode.window.showErrorMessage(`유닛 오퍼레이션 삽입 실패: ${error}`);
      }
    })
  );

  // Register manage templates command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.manageTemplates', async () => {
      const workflowsPath = path.join(context.extensionPath, 'resources', 'workflows');

      const files = [
        { label: 'workflows_en.json', description: '워크플로 카탈로그 (68개)' },
        { label: 'unitoperations_hw_en.json', description: 'HW 유닛 오퍼레이션 카탈로그 (50개)' },
        { label: 'unitoperations_sw_en.json', description: 'SW 유닛 오퍼레이션 카탈로그 (40개)' },
      ];

      const selected = await vscode.window.showQuickPick(files, {
        placeHolder: '편집할 템플릿 파일을 선택하세요',
      });

      if (selected) {
        const filePath = path.join(workflowsPath, selected.label);
        if (fs.existsSync(filePath)) {
          const document = await vscode.workspace.openTextDocument(filePath);
          await vscode.window.showTextDocument(document);
        } else {
          vscode.window.showErrorMessage(`파일을 찾을 수 없습니다: ${selected.label}`);
        }
      }
    })
  );
}
