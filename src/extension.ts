import * as vscode from 'vscode';
import * as path from 'path';
import { SampleTreeViewProvider, SampleTreeDragAndDropController } from './views/SampleTreeViewProvider';
import { WorkflowTreeViewProvider } from './views/WorkflowTreeViewProvider';
import { createSampleCompletionProvider } from './providers/SampleCompletionProvider';
import { initRemoteData, disposeRemoteData } from './lib/dataLoader';
import {
  registerSampleCommands,
  registerWorkflowCommands,
  registerUtilityCommands,
  registerCreationCommands,
} from './commands';
import { SectionEditorProvider } from './sectionEditorProvider';

export async function activate(context: vscode.ExtensionContext) {
  console.log('Lab Note Editor is now active');

  // Initialize MongoDB connection (for Equip/Labware)
  try {
    await initRemoteData();
  } catch (error) {
    console.warn('[LabNoteV] MongoDB initialization failed:', error);
  }

  // Register Sample Completion Provider for @ based auto-completion
  context.subscriptions.push(createSampleCompletionProvider());

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

  // Register tree view. Phase D-3: attach drag-and-drop controller so users
  // can drag sample leaf nodes into any editor to insert their definition.
  const sampleDndController = new SampleTreeDragAndDropController();
  const treeView = vscode.window.createTreeView('labnotev.sampleTreeView', {
    treeDataProvider: sampleTreeProvider,
    showCollapseAll: true,
    dragAndDropController: sampleDndController,
  });
  context.subscriptions.push(treeView);

  // Track last active .labnote.md URI (for Preview → Section Editor fallback)
  let lastLabnoteUri: vscode.Uri | undefined;

  // Update document folder only when a .labnote.md file becomes active
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        const fsPath = editor.document.uri.fsPath;
        if (fsPath.endsWith('.labnote.md')) {
          const newFolder = path.dirname(fsPath);
          sampleTreeProvider.updateDocumentFolder(newFolder);
          lastLabnoteUri = editor.document.uri;
        }
      }
    })
  );

  // Refresh sample tree when customSampleTypes setting changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('labnotev.customSampleTypes')) {
        sampleTreeProvider.refresh();
      }
    })
  );

  // ========================================
  // Workflow TreeView Setup
  // ========================================
  const workflowTreeProvider = new WorkflowTreeViewProvider(
    context.extensionPath,
    workspaceRoot
  );

  // Register workflow tree view
  const workflowTreeView = vscode.window.createTreeView('labnotev.workflowTreeView', {
    treeDataProvider: workflowTreeProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(workflowTreeView);

  // ========================================
  // Section Editor Setup
  // ========================================
  const sectionEditorProvider = new SectionEditorProvider(context);
  sectionEditorProvider.setSampleTreeProvider(sampleTreeProvider);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      SectionEditorProvider.viewType,
      sectionEditorProvider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    )
  );

  // ========================================
  // Register All Commands
  // ========================================

  registerSampleCommands(context, {
    sampleTreeProvider,
    sectionEditorProvider,
  });

  registerWorkflowCommands(context, {
    workflowTreeProvider,
    sectionEditorProvider,
  });

  registerUtilityCommands(context, {
    sampleTreeProvider,
  });

  registerCreationCommands(context, { sectionEditorProvider });

  context.subscriptions.push(
    vscode.commands.registerCommand('labnotev.openWithSectionEditor', () => {
      const uri = vscode.window.activeTextEditor?.document.uri
        ?? sectionEditorProvider.getActiveDocument()?.uri
        ?? lastLabnoteUri;
      if (uri) {
        vscode.commands.executeCommand('vscode.openWith', uri, 'labnotev.sectionEditor');
      }
    }),
    vscode.commands.registerCommand('labnotev.openAsTextEditor', () => {
      const uri = sectionEditorProvider.getActiveDocument()?.uri;
      if (uri) {
        vscode.commands.executeCommand('vscode.openWith', uri, 'default');
      }
    }),
    vscode.commands.registerCommand('labnotev.openPreview', () => {
      const uri = sectionEditorProvider.getActiveDocument()?.uri;
      if (uri) {
        vscode.commands.executeCommand('markdown.showPreview', uri);
      }
    })
  );
}

export async function deactivate() {
  // Dispose MongoDB connection
  try {
    await disposeRemoteData();
  } catch (error) {
    console.error('[LabNoteV] Failed to dispose MongoDB connection:', error);
  }
}
