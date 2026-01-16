# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
