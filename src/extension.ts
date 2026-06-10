import * as vscode from 'vscode';
import * as path from 'path';
import { SampleTreeViewProvider, SampleTreeDragAndDropController } from './views/SampleTreeViewProvider';
import { WorkflowTreeViewProvider } from './views/WorkflowTreeViewProvider';
import { createSampleCompletionProvider } from './providers/SampleCompletionProvider';
import {
  registerSampleCommands,
  registerWorkflowCommands,
  registerUtilityCommands,
  registerCreationCommands,
} from './commands';
import { SectionEditorProvider } from './sectionEditorProvider';
import { disposeDecorations } from './lib/sampleDecorations';

// Captures the time when this module finishes being required by the extension
// host. Comparing this against `activateStart` reveals how long VS Code waits
// between loading the bundle and actually invoking `activate()`. Large values
// point at bundle size / top-level import cost rather than activation logic.
const moduleLoadedAt = performance.now();

/**
 * Build a debounced handler for `resources/labsamples/*.json` changes.
 *
 * Bursty file writes (e.g. saving one markdown that touches multiple sample
 * type JSON files) get collapsed into a single `refresh()` + `broadcast()`
 * pair after `delay` ms of quiescence. Extracted from `activate` so unit
 * tests can drive it with `vi.useFakeTimers` without booting the whole
 * extension.
 */
export function createDebouncedLabsamplesHandler(
  refresh: () => void,
  broadcast: () => void,
  delay = 100
): () => void {
  let pending: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => {
      pending = undefined;
      refresh();
      broadcast();
    }, delay);
  };
}

export async function activate(context: vscode.ExtensionContext) {
  const activateStart = performance.now();
  const logStep = (step: string) => {
    console.log(`[labnotev] step=${step} elapsed=${(performance.now() - activateStart).toFixed(1)}ms`);
  };
  console.log(`[labnotev] step=beforeActivate elapsed=${(activateStart - moduleLoadedAt).toFixed(1)}ms`);
  console.log('Lab Note Editor is now active');

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
  const sampleDndController = new SampleTreeDragAndDropController(sampleTreeProvider);
  const treeView = vscode.window.createTreeView('labnotev.sampleTreeView', {
    treeDataProvider: sampleTreeProvider,
    showCollapseAll: true,
    dragAndDropController: sampleDndController,
  });
  context.subscriptions.push(treeView);
  logStep('createSampleTreeView');

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
    sectionEditorProvider,
  });

  registerCreationCommands(context, { sectionEditorProvider });

  // Watch `resources/labsamples/*.json` for any change/create/delete and
  // refresh both the TreeView and every live Section Editor. This catches
  // edits made outside the extension (manual JSON edits, git pulls, etc.)
  // and serves as a single idempotent rendezvous for the same flow that the
  // tree/save handlers trigger directly. The 100ms debounce collapses bursts
  // (e.g. multiple files written in sequence) into one refresh + broadcast.
  const labsamplesWatcher = vscode.workspace.createFileSystemWatcher(
    '**/resources/labsamples/*.json'
  );
  const onLabsamplesChange = createDebouncedLabsamplesHandler(
    () => sampleTreeProvider.refresh(),
    () => sectionEditorProvider.broadcastSampleDefsUpdated(),
    100
  );
  labsamplesWatcher.onDidChange(onLabsamplesChange);
  labsamplesWatcher.onDidCreate(onLabsamplesChange);
  labsamplesWatcher.onDidDelete(onLabsamplesChange);
  context.subscriptions.push(labsamplesWatcher);

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
  logStep('registerCommands');
  logStep('activateEnd');
}

export function deactivate() {
  // Decoration types are created lazily at module load (not via
  // context.subscriptions), so dispose them explicitly here.
  disposeDecorations();
}
