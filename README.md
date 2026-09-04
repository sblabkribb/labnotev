# Labnote Assistant (LabnoteV)

**v0.70.0** · [한국어 → README.ko.md](README.ko.md)

A VS Code extension that helps you write experiment notes in Markdown. It opens `.labnote.md` files in a webview-based Section Editor, providing a UI optimized for lab note keeping — Front Matter forms, workflow checklists, unit operation accordions, sample definition buttons, clipboard image paste/thumbnails, and more.

> Starting from v0.53.0, all UI strings and command labels in the extension are English by default. When VS Code's display language is set to Korean (`ko`), the command palette entries (`%key%` references) and runtime messages (`vscode.l10n.t()` calls) are automatically displayed in Korean via `l10n/bundle.l10n.ko.json` and `package.nls.ko.json`. **User-written note content — Korean text, folder names, aliases, descriptions — is never auto-translated** and is preserved exactly as you wrote it.

## Quick Start

If you are new to LabnoteV, follow these steps:

1. Open the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P` / `F1`).
2. Run `Labnote: Create New Labnote Folder` to create a new experiment.
3. Enter the experiment title and author name.
4. A `labnote/{number}_{title}/` folder is created and `README.labnote.md` opens in the **Section Editor**.
   - The Section Editor is a form-based structured editor showing Front Matter (title/author/dates), Experiment Objective, Related Workflows, and Summary and Discussion as visual sections.
   - `images/`: folder for images pasted or saved during experiments.
   - `resources/`: folder for sample/workflow data.
5. Fill in the Experiment Objective section.
6. Add a workflow:
   - Click the flask icon in the Activity Bar → click the `[Create]` button next to a workflow in the workflow tree view.
   - Or run `Labnote: Create Workflow` from the command palette.
   - The workflow file is created immediately and linked as a checklist item under Related Workflows.
   - The workflow description can be edited inline in the Section Editor (changes are automatically reflected back in `README.labnote.md`).
7. Click a workflow title to open its `.labnote.md` file in the Section Editor.
   - A "Back to Lab Note" link is shown at the top of the workflow file so you can return to the original experiment note.
8. Add unit operations to the workflow:
   - Click `[Insert]` next to the desired unit operation in the Activity Bar.
   - Unit operations are displayed as accordions; reorder them by drag-and-drop.
   - HW (hardware): Input, Reagent, Labware and Consumables, Equipment, Method, Output, Results & Discussions.
   - SW (software): Input, Output, Parameters, QC Metrics, Method, Environment, Discussion.
   - Each section heading (including **Output**) has a **flask (+Sample)** button to insert a sample definition.
   - When new workflows/unit operations are created, the body content (section placeholders, the "Unit operations are appended here automatically" hint, etc.) is **always stored in English** regardless of the active VS Code locale, ensuring file compatibility across users. Existing Korean content from older notes is treated as user data and never rewritten.
9. Define samples:
   - Click `+Sample` next to a section heading → enter type/alias/description in the modal → a line in the form `- @type;ID;alias;description` is inserted in that textarea.
   - Custom types can also be defined directly in the modal.
   - Or right-click a type in the Sample TreeView (Activity Bar) → Add Sample. The newly created sample appears under the type; use `[Insert to Editor]` to reference it from any Section Editor textarea.
10. Reference samples:
    - Place the cursor in any textarea inside a unit operation.
    - Click the `[Insert to Editor]` button in the Sample TreeView (Activity Bar).
11. Images:
    - Paste clipboard images at the cursor position with `Ctrl+V`.
    - Images are saved to the `images/` folder and a Markdown image link is inserted.
    - A thumbnail appears below the textarea; if you write `![Title](link)`, the title is shown under the thumbnail.
    - **File attachment** (clip icon next to a section heading): files inside the experiment folder are inserted as relative links only; files outside are copied into `resources/attachments/` and then linked. Image attachments are also previewed as thumbnails.
12. Tables:
    - Click the table icon next to a section heading → specify rows/columns → a table template is inserted.
    - Inside a table, Tab moves to the next cell, Shift+Tab to the previous cell (Tab in the last cell adds a new row).
    - Pasting data from Excel/Google Sheets is automatically converted into a Markdown table.
    - The align button auto-aligns table columns (CJK character widths are taken into account).
13. Miscellaneous:
    - The document is **auto-saved** 1.5 seconds after edits stop; a status badge at the top shows the current state.
    - **Dark mode**: toggle dark/light mode via the moon/sun icon at the top-right of the editor (the setting is auto-saved).
    - The top-right of the editor title bar provides quick switches between Text Editor, Section Editor (flask icon), and Preview.
    - **Markdown preview line breaks**: the extension applies `markdown.preview.breaks: true` as the default so that a single Enter is rendered as a line break in the built-in preview (an explicit `false` in your `settings.json` takes precedence).

## Features

### Section Editor (default editor)

When you open a `.labnote.md` file, the Section Editor is shown automatically. It parses the Markdown into a structured form UI and serializes edits back to Markdown when saving.

#### Lab Note mode (`README.labnote.md`)

- **Front Matter form**: edit Title, Author, Experiment Type, Created Date, and Last Updated in a form UI.
  - Date fields use a DatePickerInput (calendar) plus a time input (auto-formatted, with a "Now" button).
- **Experiment Objective**: a free-form textarea for the experiment objective.
- **Related Workflows**: checklist of linked workflows.
  - Clicking a workflow title opens that workflow's `.labnote.md` in the Section Editor.
  - Use the up/down arrow buttons on each item to reorder workflows. Only the list order in the README changes; file names and their numbers stay the same.
  - To make the file numbers follow the list order, use the "Renumber" button in the Related Workflows header (also available via the Command Palette "Labnote: Renumber Workflows" or by right-clicking the README in the Explorer). This renames the workflow files' `NNN` prefixes to 001..N to match the current order.
  - Use the trash button on each item to delete a workflow (also available via right-clicking the workflow file in the Explorer or the Command Palette "Labnote: Delete Workflow"). After confirmation the file is moved to the trash, its README entry is removed, and samples defined only in that file are cleaned up; you are then offered to renumber the remaining workflows. Shared attachments/images are left untouched.
  - On save, a `## Related Unit Operations` section is generated below the checklist with anchor links to each workflow and unit operation. The Markdown preview can be used to navigate to those headings.
- **Results & Discussion**: free-form textarea for experiment results and discussion.
- **Summary and Discussion**: free-form textarea for the overall experiment summary.

#### Workflow mode (workflow `.labnote.md`)

- **Back to Lab Note link**: appears at the top so you can return to the original lab note.
- **Front Matter form**: edit Title, Experimenter, Created Date, Last Updated, and End Date.
- **Workflow Header**: shows the workflow title and an inline-editable description. Editing the description automatically synchronizes the matching checklist entry in `README.labnote.md`.
- **Unit Operations**: shown as an accordion UI.
  - Reorder by drag-and-drop.
  - The unit operation alias is editable inline next to the name.
  - Meta section: Experimenter (text input) plus Start/End Date (calendar + time picker) shown as structured fields. Custom entries such as `Duration` are also shown as editable inputs, and an "+ Add field" button lets you add or delete (x) custom entries (non-ASCII field names supported).
  - Typos such as `#### Reagen` are auto-normalized back to `#### Reagent` when saving/loading.
  - Other sections (Input, Output, Method, etc.) are free-form textareas.
  - Unit operation IDs inserted from the catalog follow the **`UHW…` (hardware) / `USW…` (software)** prefix scheme. The Section Editor's HW/SW indicator and Meta `Equipment` / `Software` fields are aligned to that prefix (the recognition is stable even after editing the body via a text editor).
  - The `+Sample` button opens the sample creation modal: choose a type (8 built-ins + custom), enter an alias, enter a description, all in one place.
  - For Reagent/Labware, the "Search product" button opens a QuickPick over the local + workspace-level reference catalog at `resources/labsamples/{Reagent|Labware}_*.json`. If no candidates are found, an information toast explains what to add.
  - "Add new type" lets you define a custom sample type (stored in workspace settings).
- **Conclusions and Discussion**: textarea for the overall workflow summary and discussion. When saving, the Markdown always includes a `## Conclusions and Discussion` section, kept in sync between the Section Editor UI and the body so they don't duplicate.

#### Common features

- **Auto-save**: edits are saved 1.5 seconds after the last change; the status badge at the top shows Saved / Unsaved changes / Saving.
- **Image paste**: every textarea (including Conclusions and Discussion) accepts clipboard images via `Ctrl+V`.
  - Images are saved into `images/` and a Markdown image link is inserted.
  - After insertion, the cursor is positioned at the end of the inserted text (the same behavior applies to sample/text insertions).
  - Thumbnails appear below the textarea; writing `![Title]()` shows the title under the thumbnail.
  - Click a thumbnail to open the image in a zoomable modal.
- **File attachment**: clicking the attachment icon next to a section heading lets you pick a file. Files **inside the same experiment folder as the open `.labnote.md`** (under `images/`, `resources/`, etc.) are referenced via a relative link without copying. Files **outside** the experiment folder are copied into `resources/attachments/` and linked from there. Unlike clipboard paste, attachments are always inserted in `[name](path)` form.
  - Attachment links appear below the textarea; clicking opens the file (Office files prefer the OS default app).
  - Image-extension attachments are previewed as **thumbnails** like pasted images, while PDFs/spreadsheets/etc. show only a paperclip link row.
- **Auto-grow textarea**: all SectionEditor textareas grow to fit their content (no inner scrollbar).
- **Sample ID highlighting**: sample IDs inside textareas are highlighted per type color (including custom types).
  - Clicking a highlighted ID opens a definition popover (alias/description plus a "Go to definition" button); close it with the top-right x button, an outside click, or Esc.
- **Markdown table support**: every textarea (SectionEditor and UnitOp sections) helps you author Markdown tables.
  - Click the table icon next to a heading → specify rows/columns → insert a table template.
  - Tab/Shift+Tab navigates cells; Tab in the last cell adds a new row.
  - Pasting from Excel/Google Sheets auto-converts to a Markdown table.
  - The align button auto-aligns columns (CJK widths considered).
- **Tab indent / Shift+Tab outdent**: outside of tables, Tab inserts 2 spaces and Shift+Tab removes up to 2 leading spaces. Selecting multiple lines applies the operation to all selected lines (useful for Markdown list indentation).
  - Column alignment is triggered only via the **toolbar align button** (there is no dedicated keyboard shortcut).
- **Send selection to Chat** (v0.56.0+): drag-select text in any Section Editor textarea — including Lab Note mode (Experiment Objective, Results & Discussion, Summary and Discussion) and every UnitOp section in Workflow mode — and a small floating "Send selection to Chat" button appears next to the selection. Clicking the button (or pressing `Ctrl+Alt+L` / `Cmd+Alt+L` while the textarea is focused) opens the VS Code Chat panel with a prompt that includes the current file as a `#file:` reference variable, a meta line identifying the source section (UnitOp ID and section heading when applicable), and the selected text in a fenced code block. `isPartialQuery: true` is used so you can append your question (e.g. "summarize", "rewrite as bullet points") and submit manually. The shortcut is intentionally handled inside the webview only and not registered as a VS Code keybinding, so it cannot collide with the user's other Ctrl/Cmd+Alt+L bindings.
- **Dark mode**: toggle dark/light via the moon/sun icon (auto-saved).
- **Open as text**: a top-bar button opens the raw Markdown in VS Code's text editor.
- **3-way editor switcher**: top-right buttons switch between Text Editor, Section Editor, and Preview.
  - Text Editor / Preview modes: click the flask icon to switch to Section Editor.
  - Section Editor mode: click the Markdown editor / preview icon to switch to the corresponding mode.

### Sample ID management

Sample IDs are **defined** in the form `@type;ID;alias;description` and **referenced** in the form `ID;alias`. (Legacy `|` and `:` separators are still supported.)

#### Sample management in the Section Editor

- **Sample creation modal**: click the `+Sample` button next to any section heading inside a unit operation. The modal lets you pick a type (8 built-ins + custom), enter an alias, and enter a multi-line description, then inserts `- @type;ID;alias;description`.
  - For Reagent/Labware, the "Search product" button searches the local + workspace `resources/labsamples/{type}_*.json` catalogs. If the catalog is empty, a toast points you to the file path so the button is never a silent no-op.
  - "Add new type" defines a custom type usable for highlighting and extraction/storage.
- **Highlighting**: sample IDs in textareas are color-coded by type.
- **Navigation**: clicking a highlighted sample ID jumps to its definition.

#### `@` autocomplete in text editors (`.md` files)

When a regular `.md` file is opened in the text editor:

- `@dna:`, `@rna:`, `@plasmid:`, `@reagent:`, `@primer:`, `@labware:` — type-specific sample search.
- `@sample:` — search across all types.
- `@equip:` — equipment search (local reference DB / JSON).
- Typing the colon (`:`) opens the autocomplete list; further typing filters it.
- The list includes "Generate new ID" and "Enter info" actions.

| Scenario | Input | Result |
|----------|-------|--------|
| **Reference an existing sample** | `@dna:` → pick existing | `DNA-123\|SampleA` |
| **Define a new sample** | `@dna:` → Generate new ID | `@dna:DNA-xxx\|alias:description` |
| **TreeView reference** | double-click a sample (or use `[Insert to Editor]`) | `DNA-123\|SampleA` |

#### Sample storage

- On save, sample information is automatically written to `resources/labsamples/{TYPE}.json`.
- Even when an experiment folder is opened as the workspace root (where the local and global `labsamples` paths coincide), consecutive saves no longer wipe the local JSON.
- Supported formats: `@type;ID;alias;description`, `ID;alias;description`, `ID;alias`, `ID: description` (and the legacy `|` / `:` separators).
- Aliases may contain spaces or special characters (e.g. `Reagent-1|UltraPure™ DNase/RNase-Free Water:description`).
- **Reference DB**: `{TYPE}_{name}.json` files provide read-only product catalogs.
  - Examples: `reagent_buffer.json`, `labware_plate.json`.

### Sample TreeView (Activity Bar)

- **Tree view**: a sample panel with the flask icon is shown in the VS Code Activity Bar.
- **Local / Global split**: samples in the experiment folder and the workspace root are shown separately.
  - Local samples are loaded from `resources/labsamples/` inside the experiment folder of the currently active `.labnote.md`.
  - Switching to a `.labnote.md` from a different experiment automatically swaps in that experiment's local samples (in both the text editor and the Section Editor).
  - Custom sample types (via the `labnotev.customSampleTypes` setting) appear in the tree alongside built-ins; the tree refreshes automatically when the setting changes.
- **Hierarchy**:
  - `Samples (Local)` / `Samples (Global)`: root nodes.
  - `DNA [3]`, `RNA [1]`, etc.: per-type nodes (built-in + custom).
  - `DNA-123 | SampleA`: individual sample.
- **Context menu**:
  - Double-click a sample (or click the inline `[Insert to Editor]` icon): insert `ID;alias` into the active Section Editor textarea (reference). If the file is open as a plain markdown text editor instead, a nudge points you to `Labnote: Search Sample` — use that command (or the search icon in the tree view title bar) to insert at the cursor in text mode.
  - Right-click → Move to Definition: scroll the active Section Editor webview to the sample's `@type;ID...` definition inside the current document. The command stays inside the Section Editor and does not open the markdown text editor.
  - Right-click a type → Add Sample: add a new sample.
  - Right-click a sample → Edit Sample: rename/redescribe.
  - Move to Global / Move to Local: move the sample's scope.
- **Drag-and-drop**: dragging a sample node into any editor inserts `@type;ID;alias;description`. Multi-select inserts multiple lines.
- **Reordering**: dropping a sample on another sample within the same type (e.g. DNA) reorders them and persists to the JSON file. Dropping on the type node moves to the end. Multi-select preserves relative order. Drops across types or scopes are ignored — use the "Move to Global/Local" commands instead.
- **Per-type icon color**: the type node icon uses the same palette as body highlighting, making types easy to distinguish at a glance.
- **Empty state**: when a type has no samples, a "No samples" row is shown (Local hints at the right-click "Create Sample" action; Global explains that saving an `@type;id` definition anywhere registers the sample automatically).
- **Sample search**: the search icon in the tree view title bar, or run `Labnote: Search Sample` from the Command Palette. The QuickPick searches every Local + Global sample by ID, alias, and description.
  - The selected sample is inserted at the cursor in **both the Section Editor and the plain markdown text editor**, so this is the recommended path for inserting samples while editing the raw `.labnote.md` as text. (The tree view inline `Insert to Editor` action stays Section Editor-only by design.)

### Workflow TreeView (Activity Bar)

- **Workflow tree view**: shown alongside Lab Samples in the Activity Bar, displays the workflow catalog.
- **Hierarchy**:
  - `Workflows [50]`: root.
    - `Design [13]`: design workflows (WD prefix).
    - `Build [17]`: build workflows (WB prefix).
    - `Test [19]`: test workflows (WT prefix).
    - `Learn [10]`: learn workflows (WL prefix).
    - `General [1]`: general workflows (WG prefix) — Blank Workflow and other DBTL-independent workflows.
  - `HW Unit Operations`: hardware unit operations (UHW prefix).
  - `SW Unit Operations`: software unit operations (USW prefix).
- **Workflow commands**:
  - `[Create]` button: create the workflow file from `README.labnote.md`.
  - Right-click → Edit, Delete: edit/remove the JSON entry.
  - Right-click a category → Add Workflow: add a new workflow.
- **Unit operation commands**:
  - `[Insert]` button: insert the unit operation template into the currently open workflow.
  - Right-click → Edit, Delete: edit/remove the JSON entry.
  - Right-click the root → Add Unit Operation: add a new unit operation.
- **Search**: the search icon in the tree view title bar searches workflows and unit operations.
- **Auto resource copy**: on first run, the extension's JSON files are copied to the workspace so users can freely edit them.

### Image handling

- **Image paste in the Section Editor**: every textarea accepts clipboard images via `Ctrl+V`.
  - Images are saved into `images/` and a Markdown image link (`![](images/img_xxx.png)`) is inserted.
  - A thumbnail appears below the textarea automatically.
  - Clicking the thumbnail opens a zoomable modal.
- **Attachment-style images**: image references inserted as `[filename](images/…)` / `[filename](resources/…)` are also rendered as thumbnails and previewable in the modal (deduplicated against any matching `![](same-path)`).
- **Image preview panel**: clicking an image link opens a dedicated preview panel.
  - Zoom controls (+, -, Reset).
  - Keyboard shortcuts: Esc (close), +/- (zoom), 0 (reset).

### Export (PDF / CSV)

- **`Labnote: Export Research Notebook PDF`**: builds a printable report and opens it in your OS default browser so you can use the browser's own Print dialog (`Ctrl/Cmd+P` → *Save as PDF*) to produce the PDF. The extension does not generate the PDF itself — no bundled PDF engine, so there is nothing extra to install.
  - **Scope selection**: pick the experiment folder (auto-detected from the active editor when possible, otherwise a QuickPick over the workspace), then choose which files to include — `README.labnote.md` plus any of its linked workflows — via a multi-select QuickPick. Files already checked in the Related Workflows checklist are pre-selected.
  - **Cover info**: the report opens with a cover showing the first selected file's title, author, created date, and last-updated date, taken verbatim from the front matter (no recomputation). Every additional file included gets its own heading with its own created/last-updated dates, so multi-file reports stay accurate per file.
  - **Formatting**: Markdown is rendered via VS Code's built-in Markdown renderer for proper styling (falls back to a minimal built-in renderer if unavailable), images are resolved to absolute paths so they display correctly outside the workspace, and print CSS keeps tables/images/code blocks from splitting across a page break.
- **`Labnote: Export Tables as CSV`**: reuses the same file-selection QuickPick, then extracts every Markdown table (`| ... |`) from the selected files and writes one `.csv` per table into a folder you choose.

### Experiment folder structure

- **Create a new experiment**: `Labnote: Create New Labnote Folder` prompts for title and author.
- **Location**: `labnote/{number}_{title}/`.
- **Auto numbering**: `001`, `002`, ...
- **Auto-generated entries**:
  - `README.labnote.md`: the main experiment overview (opens in the Section Editor).
  - `images/`: image folder.
  - `resources/`: samples/workflows data folder.
- **Workflow filename format**: `{number}_{workflowID}_{name}.labnote.md` (e.g. `001_WD010_General_Design_of_Experiment.labnote.md`).
- **Rename Workflow**: the `Labnote: Rename Workflow` command (v0.52+) renames a workflow across **five places at once** — file name, front matter `title`, body H1 heading, and the matching checklist label/link in `README.labnote.md`.

### Date management

- **Section Editor**: edit Front Matter's Created Date, Last Updated, and End Date via calendar + time input.
  - Click the time input to clear it; typing digits auto-formats to HH:MM (auto-confirmed at 4 digits).
  - The "Now" (clock icon) button immediately sets the current date+time.
- **Text editor**: keyboard shortcuts to insert/update dates.
  - `Ctrl+Shift+D` / `Cmd+Shift+D`: insert date/time.
  - `Ctrl+Shift+U` / `Cmd+Shift+U`: update date fields.

### Localization

- The extension's UI strings and command labels are English by default. When VS Code's display language is set to Korean (`ko`), command palette entries (`%key%` references) and runtime messages (`vscode.l10n.t()`) are automatically rendered in Korean.
- Translation sources:
  - `package.nls.json` / `package.nls.ko.json`: translations for declarative strings in `package.json` (e.g. command titles).
  - `l10n/bundle.l10n.ko.json`: translations for runtime messages and prompts.
- **User-written note content is never auto-translated.** Korean text, folder names, aliases, and descriptions are preserved exactly.
- **Newly created body content is always English-fixed**: when creating new workflows/unit operations, the body strings written to disk (section placeholders, the "Unit operations are appended here automatically" hint, etc.) are stored in English regardless of the active locale. This guarantees file compatibility across users with different display languages.
- To switch VS Code's display language: command palette → `Configure Display Language` → pick a language → restart.

## Installation

### Install from GitHub Releases

1. Download the latest `.vsix` from the [Releases](https://github.com/sblabkribb/labnotev/releases) page.
2. In VS Code, run `Ctrl+Shift+P` → `Extensions: Install from VSIX...`
3. Select the downloaded `.vsix`.
4. After installation, restart VS Code, open your workspace, press `F1`, and run any command starting with `Labnote`.

### Obsidian plugin (Labnote Assistant)

Starting with v0.70.0, the same lab-note workflow is available as an Obsidian plugin built from `packages/obsidian-plugin` (shared logic lives in the `@labnotev/core` package).

1. Download `main.js`, `manifest.json`, and `versions.json` from the [Releases](https://github.com/sblabkribb/labnotev/releases) page (or build locally with `npm run build:obsidian`).
2. Copy the three files into `<vault>/.obsidian/plugins/labnotev/`.
3. In Obsidian, open **Settings → Community plugins**, turn off **Restricted mode**, then enable **"Labnote Assistant"**.

The Obsidian plugin supports experiment/workflow creation, unit-operation insertion (with non-destructive TOC updates), sample autocomplete and highlighting, workflow/sample sidebar views, CSV export, and optional local LLM/MCP integration (desktop only). PDF export uses Obsidian's built-in Export to PDF.

## Commands

| Command | Description |
|---------|-------------|
| `Labnote: Create New Labnote Folder` | Create a new experiment folder structure |
| `Labnote: Create Workflow` | Create a workflow file from the README |
| `Labnote: Rename Workflow` | Rename a workflow across all 5 places (file name, front matter, body header, README checklist label/link) at once |
| `Labnote: Insert Unit Operation` | Insert a unit operation template into a workflow |
| `Labnote: Search Sample` | Search and insert samples |
| `Labnote: Search Workflow` | Search workflows and unit operations |
| `Labnote: Insert Current Date` | Insert the current date (text editor) |
| `Labnote: Insert Current Date and Time` | Insert the current date and time (text editor) |
| `Labnote: Manage Templates` | Edit workflow/unit operation JSON catalogs |
| `Labnote: Open with Section Editor` | Open the current Markdown file in the Section Editor |
| `Labnote: Open as Markdown Editor` | Open the current file in the text editor |
| `Labnote: Open Preview` | Open the Markdown preview for the current file |
| `Labnote: Export Research Notebook PDF` | Open a printable HTML report in your browser (Print → Save as PDF) |
| `Labnote: Export Tables as CSV` | Extract Markdown tables from selected files as CSV |

## Troubleshooting

### When the Section Editor does not open

If a `.labnote.md` file opens in the regular text editor instead of the Section Editor, configure the default editor as follows.

**Option 1: "Open With" menu**

1. Right-click a `.labnote.md` file → "Open With..."
2. Choose "Lab Note Section Editor".
3. Click "Configure default editor for '*.labnote.md'" to make it the default.

**Option 2: edit `settings.json` directly**

Add the following to VS Code's `settings.json`:

```json
{
  "workbench.editorAssociations": {
    "*.labnote.md": "labnotev.sectionEditor"
  }
}
```

**Option 3: use the editor title bar button**

When a `.labnote.md` is opened in the text editor or the preview, the editor title bar shows a flask icon that switches to the Section Editor. While in the Section Editor, the Markdown editor and preview icons let you switch back.

Normally, installing the extension automatically registers the Section Editor as the default. The settings above may be required when other Markdown extensions conflict with it.

### When `@` autocomplete doesn't appear

- `@` autocomplete only works in the **text editor**. In the Section Editor, use the per-section sample definition buttons.
- Make sure the `.md` file is open in the text editor (you can switch from the Section Editor via "Open in text editor").
- Autocomplete is triggered after prefixes like `@dna:`, `@rna:`, `@sample:`.
- If the sample tree in the Activity Bar looks stale, click the refresh icon to re-read it.

## File format

- Experiment notes are saved as `.labnote.md` Markdown files.
- The Section Editor parses Markdown into structured UI and serializes edits back to Markdown when saving, preserving the original Markdown compatibility.
- Standard Markdown — image links, YAML front matter, etc. — is fully supported.

```markdown
- @dna:DNA-123|SampleA:assembly template

DNA-123|SampleA
```

In the example above, the first line is a **sample definition** (starts with `@`) and the second is a **body reference** (just the ID without `@`).

## Requirements

- **VS Code**: ^1.85.0

## Developer notes

To run or develop from source, clone the repository and use:

```bash
npm run install:all
npm run build
npm test
```

- `npm test`: host-side Vitest unit tests (`src/__tests__/**`).
- `cd webview-section && npm test`: webview-side Vitest component tests.
- `npm run build`: bundles the host with esbuild and the webview with Vite.
- The English/Korean UI is switched automatically based on VS Code's display language. To add or modify Korean translations, edit `l10n/bundle.l10n.ko.json` and `package.nls.ko.json` in the workspace root.
- `tools/demo-recorder`: standalone pipeline that auto-captures the user-manual screenshots and generates the Korean/English PDFs. It is excluded from the published VSIX. See `tools/demo-recorder/README.md`.

## License

MIT License
