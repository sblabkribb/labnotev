/**
 * ObsidianHost — the Obsidian implementation of {@link LabnoteHost}.
 *
 * Mirrors `src/host/vscodeHost.ts` on the extension side so the same core
 * command logic (e.g. `insertUnitOperationAtCursor`) runs unchanged. Because
 * Obsidian has no Section Editor webview, the {@link EditTarget} collapses to a
 * single CodeMirror editor implementation.
 *
 * Path convention: `editTarget().path` returns the **vault-relative** path of
 * the active note (e.g. `labnote/001_Exp/002_WD010_Design.labnote.md`). This is
 * exactly what `isValidWorkflowPath` expects (parent folder must be `labnote`)
 * and what {@link VaultFileSystem} reads, so no absolute-path conversion is
 * needed anywhere in shared logic.
 */
import { App, MarkdownView, Notice, TFile } from 'obsidian';
import type {
  LabnoteHost,
  EditTarget,
  PickItem,
  PromptOpts,
  NotifyKind,
  LabnoteFs,
  Translator,
} from '@labnotev/core';
import { pickModal, pickManyModal, promptModal, confirmModal } from './modals';

export function createObsidianHost(
  app: App,
  fs: LabnoteFs,
  t: Translator
): LabnoteHost {
  function editTarget(): EditTarget | undefined {
    const view = app.workspace.getActiveViewOfType(MarkdownView);
    const file = view?.file;
    if (!view || !file) return undefined;
    const editor = view.editor;
    return {
      path: file.path,
      async getText() {
        return editor.getValue();
      },
      async insertAtCursor(text: string) {
        editor.replaceSelection(text);
      },
      async replaceRange(start: number, end: number, text: string) {
        editor.replaceRange(text, editor.offsetToPos(start), editor.offsetToPos(end));
      },
    };
  }

  return {
    fs,

    pick<T>(items: PickItem<T>[], opts?: { title?: string; placeholder?: string }) {
      return pickModal(app, items, opts);
    },

    pickMany<T>(items: PickItem<T>[], opts?: { title?: string; placeholder?: string }) {
      return pickManyModal(app, items, opts);
    },

    prompt(opts: PromptOpts) {
      return promptModal(app, opts);
    },

    confirm(message: string, opts?: { confirmLabel?: string }) {
      return confirmModal(app, message, opts?.confirmLabel ?? t('Yes'));
    },

    notify(kind: NotifyKind, message: string) {
      // Obsidian has a single Notice surface; prefix errors/warnings for clarity.
      const prefix = kind === 'error' ? '❌ ' : kind === 'warn' ? '⚠️ ' : '';
      new Notice(prefix + message);
    },

    editTarget,

    async openFile(path: string) {
      const file = app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        await app.workspace.getLeaf(false).openFile(file);
      }
    },

    t,
  };
}
