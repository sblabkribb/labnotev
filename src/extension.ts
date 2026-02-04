import * as vscode from 'vscode';
import * as path from 'path';
import { LabNoteEditorProvider } from './labNoteEditorProvider';
import { SampleTreeViewProvider } from './views/SampleTreeViewProvider';
import { WorkflowTreeViewProvider } from './views/WorkflowTreeViewProvider';
import { createSampleCompletionProvider } from './providers/SampleCompletionProvider';
import { initRemoteData, disposeRemoteData } from './lib/dataLoader';
import {
  registerSampleCommands,
  registerWorkflowCommands,
  registerUtilityCommands,
  registerCreationCommands,
} from './commands';

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

  // Register the custom editor provider (BlockNote - optional)
  const labNoteEditorProvider = new LabNoteEditorProvider(context);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      LabNoteEditorProvider.viewType,
      labNoteEditorProvider,
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
  // Register All Commands
  // ========================================

  // Register sample commands
  registerSampleCommands(context, {
    sampleTreeProvider,
    labNoteEditorProvider,
  });

  // Register workflow commands
  registerWorkflowCommands(context, {
    workflowTreeProvider,
  });

  // Register utility commands
  registerUtilityCommands(context, {
    sampleTreeProvider,
    labNoteEditorProvider,
  });

  // Register creation commands
  registerCreationCommands(context);
}

export async function deactivate() {
  // Dispose MongoDB connection
  try {
    await disposeRemoteData();
  } catch (error) {
    console.error('[LabNoteV] Failed to dispose MongoDB connection:', error);
  }
}
