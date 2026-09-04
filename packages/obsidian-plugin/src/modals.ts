/**
 * Reusable Obsidian modal wrappers that adapt native UI to the promise-based
 * {@link LabnoteHost} primitives (pick / pickMany / prompt / confirm).
 *
 * Each wrapper resolves a Promise so command logic in `@labnotev/core` can use
 * ordinary `await` control flow, exactly as it does with the VS Code host.
 */
import { App, Modal, SuggestModal, Setting } from 'obsidian';
import type { PickItem, PromptOpts } from '@labnotev/core';

/** Single-select fuzzy picker backed by Obsidian's `SuggestModal`. */
class PickModal<T> extends SuggestModal<PickItem<T>> {
  private resolved = false;

  constructor(
    app: App,
    private readonly items: PickItem<T>[],
    private readonly resolve: (value: T | undefined) => void,
    opts?: { title?: string; placeholder?: string }
  ) {
    super(app);
    if (opts?.placeholder) this.setPlaceholder(opts.placeholder);
  }

  getSuggestions(query: string): PickItem<T>[] {
    const q = query.toLowerCase();
    if (!q) return this.items;
    return this.items.filter(
      it =>
        it.label.toLowerCase().includes(q) ||
        (it.description?.toLowerCase().includes(q) ?? false) ||
        (it.detail?.toLowerCase().includes(q) ?? false)
    );
  }

  renderSuggestion(item: PickItem<T>, el: HTMLElement): void {
    el.createEl('div', { text: item.label });
    if (item.description) {
      el.createEl('small', { text: item.description, cls: 'labnote-pick-desc' });
    }
  }

  onChooseSuggestion(item: PickItem<T>): void {
    this.resolved = true;
    this.resolve(item.value);
  }

  onClose(): void {
    if (!this.resolved) this.resolve(undefined);
  }
}

export function pickModal<T>(
  app: App,
  items: PickItem<T>[],
  opts?: { title?: string; placeholder?: string }
): Promise<T | undefined> {
  return new Promise(resolve => new PickModal(app, items, resolve, opts).open());
}

/** Multi-select picker: a checkbox list in a plain `Modal`. */
class PickManyModal<T> extends Modal {
  private resolved = false;
  private readonly selected = new Set<number>();

  constructor(
    app: App,
    private readonly items: PickItem<T>[],
    private readonly resolve: (values: T[]) => void,
    private readonly opts?: { title?: string; placeholder?: string }
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    if (this.opts?.title) contentEl.createEl('h3', { text: this.opts.title });

    this.items.forEach((item, idx) => {
      new Setting(contentEl)
        .setName(item.label)
        .setDesc(item.description ?? '')
        .addToggle(t =>
          t.setValue(false).onChange(v => {
            if (v) this.selected.add(idx);
            else this.selected.delete(idx);
          })
        );
    });

    new Setting(contentEl).addButton(b =>
      b
        .setButtonText('OK')
        .setCta()
        .onClick(() => {
          this.resolved = true;
          this.resolve([...this.selected].map(i => this.items[i].value));
          this.close();
        })
    );
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.resolved) this.resolve([]);
  }
}

export function pickManyModal<T>(
  app: App,
  items: PickItem<T>[],
  opts?: { title?: string; placeholder?: string }
): Promise<T[]> {
  return new Promise(resolve => new PickManyModal(app, items, resolve, opts).open());
}

/** Single-line text input with optional (async) validation. */
class PromptModal extends Modal {
  private resolved = false;
  private value: string;

  constructor(
    app: App,
    private readonly opts: PromptOpts,
    private readonly resolve: (value: string | undefined) => void
  ) {
    super(app);
    this.value = opts.value ?? '';
  }

  onOpen(): void {
    const { contentEl } = this;
    if (this.opts.title) contentEl.createEl('h3', { text: this.opts.title });
    if (this.opts.prompt) contentEl.createEl('p', { text: this.opts.prompt });

    const errorEl = contentEl.createEl('div', { cls: 'labnote-prompt-error' });
    errorEl.style.color = 'var(--text-error)';
    errorEl.style.minHeight = '1em';

    const submit = async () => {
      if (this.opts.validate) {
        const err = await this.opts.validate(this.value);
        if (err) {
          errorEl.setText(err);
          return;
        }
      }
      this.resolved = true;
      this.resolve(this.value);
      this.close();
    };

    new Setting(contentEl).addText(t => {
      t.setValue(this.value).onChange(v => {
        this.value = v;
        errorEl.setText('');
      });
      if (this.opts.placeholder) t.setPlaceholder(this.opts.placeholder);
      t.inputEl.addEventListener('keydown', ev => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          void submit();
        }
      });
      // Focus the input on open.
      window.setTimeout(() => t.inputEl.focus(), 0);
    });

    new Setting(contentEl).addButton(b =>
      b.setButtonText('OK').setCta().onClick(() => void submit())
    );
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.resolved) this.resolve(undefined);
  }
}

export function promptModal(app: App, opts: PromptOpts): Promise<string | undefined> {
  return new Promise(resolve => new PromptModal(app, opts, resolve).open());
}

/** Yes/No confirmation dialog. */
class ConfirmModal extends Modal {
  private resolved = false;

  constructor(
    app: App,
    private readonly message: string,
    private readonly confirmLabel: string,
    private readonly resolve: (ok: boolean) => void
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl('p', { text: this.message });
    new Setting(contentEl)
      .addButton(b =>
        b
          .setButtonText(this.confirmLabel)
          .setWarning()
          .onClick(() => {
            this.resolved = true;
            this.resolve(true);
            this.close();
          })
      )
      .addButton(b =>
        b.setButtonText('Cancel').onClick(() => {
          this.resolved = true;
          this.resolve(false);
          this.close();
        })
      );
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.resolved) this.resolve(false);
  }
}

export function confirmModal(
  app: App,
  message: string,
  confirmLabel = 'Yes'
): Promise<boolean> {
  return new Promise(resolve => new ConfirmModal(app, message, confirmLabel, resolve).open());
}
