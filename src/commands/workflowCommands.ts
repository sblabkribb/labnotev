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
  updateWorkflow,
  deleteWorkflow,
  addUnitOperation as addUnitOpToJson,
  updateUnitOperation,
  deleteUnitOperation,
  generateNextWorkflowId,
  generateNextUnitOpId,
  WorkflowItem,
  UnitOperationItem,
} from '../lib/workflowDataLoader';
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
        placeHolder: '워크플로/유닛 오퍼레이션 검색...',
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
        vscode.window.showWarningMessage('README.labnote.md를 열어주세요');
        return;
      }

      // Get workflow info from item
      const workflowId = item.workflowId || (item as any).workflowId;
      const workflowName = item.workflowName || (item as any).workflowName;
      const workflowDescription = item.workflowDescription || (item as any).workflowDescription;

      if (!workflowId || !workflowName) {
        vscode.window.showErrorMessage('워크플로 정보가 없습니다');
        return;
      }

      // Optional description
      const userDescription = await vscode.window.showInputBox({
        prompt: '워크플로 설명 (선택 사항)',
        placeHolder: 'e.g., Day 1 prep',
      });

      const labnoteDir = labnoteDirFromTarget(target);
      const experimenter = getExperimenterForLabnoteFolder(labnoteDir);

      const existingFiles = fs.readdirSync(labnoteDir)
        .filter(file => /^\d{3}_.+\.labnote\.md$/i.test(file) && file.toLowerCase() !== 'readme.labnote.md');

      const sequence = getNextWorkflowNumber(existingFiles);
      const workflowFileName = createWorkflowFileName(sequence, {
        id: workflowId,
        name: workflowName,
        description: workflowDescription || '',
      }, userDescription?.trim() || '');

      const workflowContent = createWorkflowContent({
        id: workflowId,
        name: workflowName,
        description: workflowDescription || '',
      }, userDescription?.trim() || '', experimenter);

      const workflowPath = path.join(labnoteDir, workflowFileName);
      const checklistTitle = `${sequence} ${workflowId} ${workflowName}${userDescription ? ` - ${userDescription}` : ''}`;

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

        vscode.window.showInformationMessage(`워크플로가 생성되었습니다: ${workflowFileName}`);
      } catch (error) {
        vscode.window.showErrorMessage(`워크플로 생성 실패: ${error}`);
      }
    })
  );

  // Register edit workflow item command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.editWorkflowItem', async (item: WorkflowTreeItem) => {
      if (!item || item.itemType !== WorkflowTreeItemType.Workflow) {
        return;
      }

      const newName = await vscode.window.showInputBox({
        prompt: '새 이름을 입력하세요',
        value: item.workflowName,
      });

      if (newName === undefined) return;

      const newDescription = await vscode.window.showInputBox({
        prompt: '새 설명을 입력하세요',
        value: item.workflowDescription,
      });

      if (newDescription === undefined) return;

      const data = loadWorkflowsFromJson(workflowTreeProvider.getWorkspaceRoot());
      const updated = updateWorkflow(data, item.workflowId!, {
        name: newName,
        description: newDescription,
      });
      saveWorkflows(workflowTreeProvider.getWorkspaceRoot(), updated);
      workflowTreeProvider.refresh();

      vscode.window.showInformationMessage(`워크플로가 수정되었습니다: ${item.workflowId}`);
    })
  );

  // Register delete workflow item command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.deleteWorkflowItem', async (item: WorkflowTreeItem) => {
      if (!item || item.itemType !== WorkflowTreeItemType.Workflow) {
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `정말로 ${item.workflowId}을(를) 삭제하시겠습니까?`,
        { modal: true },
        '삭제'
      );

      if (confirm === '삭제') {
        const data = loadWorkflowsFromJson(workflowTreeProvider.getWorkspaceRoot());
        const updated = deleteWorkflow(data, item.workflowId!);
        saveWorkflows(workflowTreeProvider.getWorkspaceRoot(), updated);
        workflowTreeProvider.refresh();

        vscode.window.showInformationMessage(`워크플로가 삭제되었습니다: ${item.workflowId}`);
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
        prompt: '새 워크플로 이름을 입력하세요',
        placeHolder: 'e.g., New Workflow Design',
      });

      if (!name) return;

      const description = await vscode.window.showInputBox({
        prompt: '워크플로 설명을 입력하세요',
        placeHolder: 'e.g., A workflow for...',
      });

      if (description === undefined) return;

      const data = loadWorkflowsFromJson(workflowTreeProvider.getWorkspaceRoot());
      const newId = generateNextWorkflowId(data.workflows, category);

      const updated = addWorkflowToJson(data, {
        id: newId,
        name,
        description: description || '',
        category,
      });

      saveWorkflows(workflowTreeProvider.getWorkspaceRoot(), updated);
      workflowTreeProvider.refresh();

      vscode.window.showInformationMessage(`새 워크플로가 추가되었습니다: ${newId}`);
    })
  );

  // Register insert unit operation command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.insertUnitOperation', async (item: WorkflowTreeItem | { opId: string; opName: string; opDescription: string; opType: 'hw' | 'sw'; equipment?: string; software?: string }) => {
      // Check section editor first
      if (sectionEditorProvider?.getEditorMode() === 'workflow') {
        const secDoc = sectionEditorProvider.getActiveDocument();
        if (secDoc) {
          const opId = item.opId || (item as any).opId;
          const opName = item.opName || (item as any).opName;
          const opDescription = item.opDescription || (item as any).opDescription;
          const software = item.software || (item as any).software;
          const opType = (item as { opType?: 'hw' | 'sw' }).opType ?? (software ? 'sw' : 'hw');
          if (!opId || !opName) {
            vscode.window.showErrorMessage('유닛 오퍼레이션 정보가 없습니다');
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
          await sectionEditorProvider.appendUnitOpToDocument(secDoc, block);
          vscode.window.showInformationMessage(`유닛 오퍼레이션이 삽입되었습니다: ${opId} ${opName}`);
          return;
        }
      }

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('워크플로 파일을 열어주세요');
        return;
      }

      const workflowPath = editor.document.uri.fsPath;

      if (!isValidWorkflowPath(workflowPath)) {
        vscode.window.showWarningMessage('labnote 폴더 내의 워크플로 파일에서 실행해주세요');
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
        vscode.window.showErrorMessage('유닛 오퍼레이션 정보가 없습니다');
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

      // Generate template (HW: lab-style sections; SW: Input/Output/Parameters/QC Metrics/Method/Environment/Discussion)
      const dateTime = getDateTime(new Date());
      const template = opType === 'sw'
        ? `

---

### [${opId} ${opName}]

> ${opDescription}

#### Meta
- Experimenter: ${experimenter}
- Start_date: '${dateTime}'
- End_date: ''
${software ? `- Software: ${software}` : ''}

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

### [${opId} ${opName}]

> ${opDescription}

#### Meta
- Experimenter: ${experimenter}
- Start_date: '${dateTime}'
- End_date: ''
${equipment ? `- Equipment: ${equipment}` : ''}

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

      await editor.edit(editBuilder => {
        editBuilder.insert(editor.selection.active, template);
      });
      await editor.document.save();

      vscode.window.showInformationMessage(`유닛 오퍼레이션이 삽입되었습니다: ${opId} ${opName}`);
    })
  );

  // Register edit unit operation command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.editUnitOperation', async (item: WorkflowTreeItem) => {
      if (!item || item.itemType !== WorkflowTreeItemType.UnitOperation) {
        return;
      }

      const newName = await vscode.window.showInputBox({
        prompt: '새 이름을 입력하세요',
        value: item.opName,
      });

      if (newName === undefined) return;

      const newDescription = await vscode.window.showInputBox({
        prompt: '새 설명을 입력하세요',
        value: item.opDescription,
      });

      if (newDescription === undefined) return;

      const opType = item.opType!;
      const data = loadUnitOpsFromJson(workflowTreeProvider.getWorkspaceRoot(), opType);
      const updated = updateUnitOperation(data, item.opId!, {
        name: newName,
        description: newDescription,
      });
      saveUnitOperations(workflowTreeProvider.getWorkspaceRoot(), opType, updated);
      workflowTreeProvider.refresh();

      vscode.window.showInformationMessage(`유닛 오퍼레이션이 수정되었습니다: ${item.opId}`);
    })
  );

  // Register delete unit operation command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.deleteUnitOperation', async (item: WorkflowTreeItem) => {
      if (!item || item.itemType !== WorkflowTreeItemType.UnitOperation) {
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `정말로 ${item.opId}을(를) 삭제하시겠습니까?`,
        { modal: true },
        '삭제'
      );

      if (confirm === '삭제') {
        const opType = item.opType!;
        const data = loadUnitOpsFromJson(workflowTreeProvider.getWorkspaceRoot(), opType);
        const updated = deleteUnitOperation(data, item.opId!);
        saveUnitOperations(workflowTreeProvider.getWorkspaceRoot(), opType, updated);
        workflowTreeProvider.refresh();

        vscode.window.showInformationMessage(`유닛 오퍼레이션이 삭제되었습니다: ${item.opId}`);
      }
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
        prompt: '새 유닛 오퍼레이션 이름을 입력하세요',
        placeHolder: 'e.g., New Unit Operation',
      });

      if (!name) return;

      const description = await vscode.window.showInputBox({
        prompt: '설명을 입력하세요',
        placeHolder: 'e.g., A unit operation for...',
      });

      if (description === undefined) return;

      const equipOrSoft = await vscode.window.showInputBox({
        prompt: opType === 'hw' ? '장비를 입력하세요' : '소프트웨어를 입력하세요',
        placeHolder: opType === 'hw' ? 'e.g., Centrifuge' : 'e.g., Python, R',
      });

      const data = loadUnitOpsFromJson(workflowTreeProvider.getWorkspaceRoot(), opType);
      const newId = generateNextUnitOpId(data.unitOperations, opType);

      const newOp: UnitOperationItem = {
        id: newId,
        name,
        description: description || '',
        ...(opType === 'hw' ? { equipment: equipOrSoft || '' } : { software: equipOrSoft || '' }),
      };

      const updated = addUnitOpToJson(data, newOp);
      saveUnitOperations(workflowTreeProvider.getWorkspaceRoot(), opType, updated);
      workflowTreeProvider.refresh();

      vscode.window.showInformationMessage(`새 유닛 오퍼레이션이 추가되었습니다: ${newId}`);
    })
  );
}
