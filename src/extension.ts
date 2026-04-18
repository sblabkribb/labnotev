import * as vscode from 'vscode';
import * as path from 'path';
import { SampleTreeViewProvider, SampleTreeDragAndDropController } from './views/SampleTreeViewProvider';
import { WorkflowTreeViewProvider } from './views/WorkflowTreeViewProvider';
import { createSampleCompletionProvider } from './providers/SampleCompletionProvider';
import { disposeRemoteData, onRemoteDataLoaded, reloadRemoteData } from './lib/dataLoader';
import {
  registerSampleCommands,
  registerWorkflowCommands,
  registerUtilityCommands,
  registerCreationCommands,
} from './commands';
import { SectionEditorProvider } from './sectionEditorProvider';

export async function activate(context: vscode.ExtensionContext) {
  const activateStart = performance.now();
  const logStep = (step: string) => {
    console.log(`[labnotev] step=${step} elapsed=${(performance.now() - activateStart).toFixed(1)}ms`);
  };
  console.log('Lab Note Editor is now active');

  // Phase 1: MongoDB connection is now lazy. We no longer await it here so
  // activation stays responsive even when the Mongo server is unreachable.
  // `ensureRemoteDataLoaded` is invoked on-demand from completion/product
  // picker code paths.

  // Register Sample Completion Provider for @ based auto-completion
  context.subscriptions.push(createSampleCompletionProvider());
  logStep('registerCompletionProvider');

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
  logStep('createSampleTreeView');

  // Phase 1: refresh the sample tree when MongoDB-backed data finishes
  // loading so Equip/Labware counts and ids appear without manual refresh.
  context.subscriptions.push(
    onRemoteDataLoaded(() => {
      sampleTreeProvider.refresh();
    })
  );

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
  logStep('createWorkflowTreeView');

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
  logStep('registerCustomEditor');

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
    }),
    // Phase 1: manual MongoDB reload for users who configure/change the URL
    // after activation.
    vscode.commands.registerCommand('labnotev.reloadRemoteData', async () => {
      await reloadRemoteData();
    })
  );
  logStep('registerCommands');
  logStep('activateEnd');
}

export async function deactivate() {
  // Dispose MongoDB connection
  try {
    await disposeRemoteData();
  } catch (error) {
    console.error('[LabNoteV] Failed to dispose MongoDB connection:', error);
  }
}
