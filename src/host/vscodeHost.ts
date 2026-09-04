/**
 * VS Code implementation of the platform-neutral {@link LabnoteHost}.
 *
 * This wraps the editor / webview / QuickPick primitives so that command logic
 * can be written once against `LabnoteHost` in `@labnotev/core` and reused by
 * the Obsidian plugin (which supplies its own host over Modal/SuggestModal and
 * the CodeMirror editor).
 *
 * The dual edit surface (README text editor vs Section Editor webview) is
 * hidden behind a single {@link EditTarget}: the section webview already
 * exposes a generic `insertTextToActiveEditor`, so both modes map cleanly.
 */
import * as vscode from 'vscode';
import type {
  LabnoteHost,
  EditTarget,
  PickItem,
  PromptOpts,
  NotifyKind,
  LabnoteFs,
} from '@labnotev/core';
import {
  getActiveLabnoteEditTarget,
  type ActiveLabnoteEditTarget,
} from '../lib/labnoteWorkflowContext';
import type { SectionEditorProvider } from '../sectionEditorProvider';

/**
 * Wrap a resolved {@link ActiveLabnoteEditTarget} in the platform-neutral
 * {@link EditTarget} interface.
 */
export function makeVscodeEditTarget(target: ActiveLabnoteEditTarget): EditTarget {
  if (target.mode === 'readme') {
    const editor = target.editor;
    return {
      path: editor.document.uri.fsPath,
      async getText() {
        return editor.document.getText();
      },
      async insertAtCursor(text: string) {
        await editor.edit(b => b.insert(editor.selection.active, text));
      },
      async replaceRange(start: number, end: number, text: string) {
        const range = new vscode.Range(
          editor.document.positionAt(start),
          editor.document.positionAt(end)
        );
        const edit = new vscode.WorkspaceEdit();
        edit.replace(editor.document.uri, range, text);
        await vscode.workspace.applyEdit(edit);
      },
    };
  }

  // Section Editor (webview) mode.
  const { document, provider } = target;
  return {
    path: document.uri.fsPath,
    async getText() {
      return document.getText();
    },
    async insertAtCursor(text: string) {
      await provider.insertTextToActiveEditor(text);
    },
    async replaceRange(start: number, end: number, text: string) {
      // The webview owns selection/rendering; a generic range replace is not
      // meaningful there. Fall back to a WorkspaceEdit on the backing document
      // so callers still get a correct text mutation.
      const range = new vscode.Range(
        document.positionAt(start),
        document.positionAt(end)
      );
      const edit = new vscode.WorkspaceEdit();
      edit.replace(document.uri, range, text);
      await vscode.workspace.applyEdit(edit);
    },
  };
}

/**
 * Build a {@link LabnoteHost} bound to the current VS Code window.
 *
 * @param fs the Node-backed {@link LabnoteFs} adapter
 * @param sectionEditorProvider used to resolve the active section-editor target
 */
export function createVscodeHost(
  fs: LabnoteFs,
  sectionEditorProvider?: SectionEditorProvider
): LabnoteHost {
  return {
    fs,

    async pick<T>(items: PickItem<T>[], opts?: { title?: string; placeholder?: string }) {
      const picks = items.map(it => ({
        label: it.label,
        description: it.description,
        detail: it.detail,
        _value: it.value,
      }));
      const chosen = await vscode.window.showQuickPick(picks, {
        title: opts?.title,
        placeHolder: opts?.placeholder,
      });
      return chosen ? (chosen as { _value: T })._value : undefined;
    },

    async pickMany<T>(items: PickItem<T>[], opts?: { title?: string; placeholder?: string }) {
      const picks = items.map(it => ({
        label: it.label,
        description: it.description,
        detail: it.detail,
        _value: it.value,
      }));
      const chosen = await vscode.window.showQuickPick(picks, {
        title: opts?.title,
        placeHolder: opts?.placeholder,
        canPickMany: true,
      });
      return chosen ? (chosen as Array<{ _value: T }>).map(c => c._value) : [];
    },

    async prompt(opts: PromptOpts) {
      return vscode.window.showInputBox({
        prompt: opts.prompt,
        placeHolder: opts.placeholder,
        value: opts.value,
        title: opts.title,
        validateInput: opts.validate
          ? async (v: string) => (await opts.validate!(v)) ?? null
          : undefined,
      });
    },

    async confirm(message: string, opts?: { confirmLabel?: string }) {
      const confirmLabel = opts?.confirmLabel ?? vscode.l10n.t('Yes');
      const chosen = await vscode.window.showWarningMessage(
        message,
        { modal: true },
        confirmLabel
      );
      return chosen === confirmLabel;
    },

    notify(kind: NotifyKind, message: string) {
      if (kind === 'error') vscode.window.showErrorMessage(message);
      else if (kind === 'warn') vscode.window.showWarningMessage(message);
      else vscode.window.showInformationMessage(message);
    },

    editTarget(): EditTarget | undefined {
      const target = getActiveLabnoteEditTarget(sectionEditorProvider);
      return target ? makeVscodeEditTarget(target) : undefined;
    },

    async openFile(path: string) {
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(path));
      await vscode.window.showTextDocument(doc);
    },

    t(key: string, ...args: Array<string | number | boolean>) {
      return vscode.l10n.t(key, ...args);
    },
  };
}
