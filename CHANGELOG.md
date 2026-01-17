# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Integrated labnote-lite logic module for date handling and YAML front matter parsing
  - `getSeoulDateString()`, `getSeoulDateTimeString()` for timezone-aware date formatting
  - `updateDateFieldInLine()`, `updateAllDatesInLine()`, `updateAllDateFields()` for date field updates
  - `findDateFieldsInDocument()` for date field discovery
  - `parseWorkflowFrontMatter()`, `parseReadmeFrontMatter()` for YAML parsing
- Added js-yaml dependency for YAML processing
- Added 34 new unit tests for labnote-lite logic module
- Added VS Code Commands for date operations:
  - `labnotev.insertDate` - Insert current date (YYYY-MM-DD)
  - `labnotev.insertDateTime` - Insert current date and time (YYYY-MM-DD HH:mm)
  - `labnotev.updateDateField` - Update date field on current line
  - `labnotev.updateAllDateFields` - Update all last_updated_date fields
- Added keyboard shortcuts:
  - `Ctrl+Shift+D` / `Cmd+Shift+D` for insert datetime
  - `Ctrl+Shift+U` / `Cmd+Shift+U` for update date field
- Added 11 new unit tests for VS Code commands
- Integrated labsample module for sample ID management:
  - Added `generateUniqueSampleId()` for timestamp-based unique ID generation
  - Added `SAMPLE_TYPES` constant with support for DNA, RNA, Plasmid, Reagent, Primer, Protein, Equip, Labware
  - Added application constants for commands, paths, and messages
- Added 8 new unit tests for ID generator
- Added Sample ID highlighting in markdown files:
  - Color-coded highlighting for DNA, RNA, Plasmid, Reagent, Primer, Protein, Equip, Labware
  - Real-time highlighting updates as you type
  - Decorations with type-specific colors
- Added 8 new unit tests for sample highlighting
- Added custom Slash Commands in BlockNote editor:
  - `/date` - Insert current date (YYYY-MM-DD)
  - `/datetime` - Insert current date and time (YYYY-MM-DD HH:mm)
  - `/dna`, `/rna`, `/protein`, etc. - Generate unique sample IDs
- Added 9 new unit tests for slash commands

## [0.1.0] - 2026-01-16

### Added

- Initial release of Lab Note Editor VSCode Extension
- Notion-style block editor using BlockNote
- Custom editor provider for `.labnote.md` files
- Markdown file support with bidirectional conversion
- Block types:
  - Headings (H1, H2, H3)
  - Paragraphs with inline formatting (bold, italic, code)
  - Bullet and numbered lists
  - Code blocks with syntax highlighting
  - Images with local storage
  - Tables (GFM format)
  - Math blocks with KaTeX rendering
- Slash command menu for quick block insertion
- Ctrl+V paste handling:
  - Plain text
  - Rich text (HTML)
  - Clipboard images (screenshots)
  - Image files from file explorer
- Auto-save images to `assets/` folder
- VSCode theme integration (light/dark mode)
- Drag and drop block reordering
- Test suite with 85 tests across 7 test files
