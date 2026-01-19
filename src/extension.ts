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
import { SampleTreeViewProvider, SampleTreeItem, SampleTreeItemType, getInsertText } from './views/SampleTreeViewProvider';
import { saveSamplesFromDocument, parseSampleTracking } from './lib/sampleStorage';
import { generateSampleId } from './lib/sampleUtils';
import { createLabnoteStructure } from './lib/labnoteStructure';
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
} from './lib/workflowStructure';
import { WORKFLOWS } from './lib/workflows';
import { UNIT_OPERATIONS, getOperationsByCategory } from './lib/unitOperations';
import { getSeoulDateTimeString as getDateTime } from './lib/dateUtils';

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

  // Sample TreeView setup
  const workspaceFoldersForTree = vscode.workspace.workspaceFolders;
  const workspaceRoot = workspaceFoldersForTree?.[0]?.uri.fsPath || '';
  
  // Get initial document folder from active editor
  let documentFolder = workspaceRoot;
  if (vscode.window.activeTextEditor?.document?.uri?.fsPath) {
    documentFolder = path.dirname(vscode.window.activeTextEditor.document.uri.fsPath);
  }

  // Create Sample TreeView Provider
  const sampleTreeProvider = new SampleTreeViewProvider(context, workspaceRoot, documentFolder);

  // Check if sampleTracking is enabled in settings
  const config = vscode.workspace.getConfiguration('labnotev');
  const sampleTrackingEnabled = config.get<boolean>('sampleTracking', true);
  
  // Set context for "when" clause in package.json
  vscode.commands.executeCommand('setContext', 'labnotev.sampleTrackingEnabled', sampleTrackingEnabled);

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('labnotev.sampleTracking')) {
        const newValue = vscode.workspace.getConfiguration('labnotev').get<boolean>('sampleTracking', true);
        vscode.commands.executeCommand('setContext', 'labnotev.sampleTrackingEnabled', newValue);
      }
    })
  );

  // Register tree view
  const treeView = vscode.window.createTreeView('labnotev.sampleTreeView', {
    treeDataProvider: sampleTreeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // Update document folder when active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        const newFolder = path.dirname(editor.document.uri.fsPath);
        sampleTreeProvider.updateDocumentFolder(newFolder);
      }
    })
  );

  // Register refresh sample tree command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.refreshSampleTree', () => {
      sampleTreeProvider.refresh();
    })
  );

  // Register insert sample to editor command
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.insertSampleToEditor', (item: SampleTreeItem) => {
      if (item && item.itemType === SampleTreeItemType.Sample) {
        const insertText = getInsertText(item);
        // Send message to active webview (BlockNote editor)
        provider.insertTextToActiveEditor(insertText);
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

      // Generate new sample ID
      const newSampleId = generateSampleId(sampleType);

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

      await sampleTreeProvider.addSample(
        scope,
        sampleType,
        newSampleId,
        alias || null,
        description || null
      );

      vscode.window.showInformationMessage(`샘플이 추가되었습니다: ${newSampleId}`);
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
        value: item.description || '',
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

      vscode.window.showInformationMessage(`샘플이 수정되었습니다: ${item.sampleId}`);
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
        // Insert selected sample to editor
        const insertText = selected.alias 
          ? `${selected.sampleId}|${selected.alias}`
          : selected.sampleId;
        provider.insertTextToActiveEditor(insertText);
      }
    })
  );

  // Register open in text mode command (called from BlockNote webview)
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.openInTextMode', async (uri: vscode.Uri) => {
      if (uri) {
        // Close current editor and open in text mode
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        await vscode.commands.executeCommand('vscode.openWith', uri, 'default');
      }
    })
  );

  // Register open in BlockNote mode command (called from text editor context menu)
  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.openInBlocknoteMode', async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        const uri = editor.document.uri;
        // Save document before switching
        await editor.document.save();
        // Close current editor
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        // Open in BlockNote mode
        await vscode.commands.executeCommand('vscode.openWith', uri, 'labnotev.editor');
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

      // Select workflow from list
      const workflowItems = WORKFLOWS.map(wf => ({
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

      // Get existing workflow files (.labnote.md only)
      const labnoteDir = path.dirname(readmePath);
      const existingFiles = fs.readdirSync(labnoteDir)
        .filter(file => /^\d{3}_.+\.labnote\.md$/i.test(file));

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
      
      const operations = getOperationsByCategory(category);
      console.log('[LabNoteV] Operations count:', operations.length);

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

      // Generate unit operation template
      const dateTime = getDateTime(new Date());
      const op = selected.operation;
      const descriptionPart = userDescription ? ` ${userDescription.trim()}` : '';
      
      const template = `

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
}

export function deactivate() {}
