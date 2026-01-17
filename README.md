# Lab Note Editor

A Notion-style block editor for VS Code, designed specifically for lab notes. Built with BlockNote and React, providing a modern, intuitive editing experience for scientific documentation.

## Features

### 📝 Rich Block Editor
- **Notion-style editing**: Block-based editor with drag-and-drop reordering
- **Markdown support**: Bidirectional conversion between Markdown and blocks
- **Slash commands**: Quick block insertion with `/` menu

### 🧩 Supported Block Types
- **Headings** (H1, H2, H3)
- **Paragraphs** with inline formatting (bold, italic, code)
- **Lists** (bullet and numbered)
- **Code blocks** with syntax highlighting
- **Images** with local storage
- **Tables** (GFM format)
- **Math blocks** with KaTeX rendering

### 🖼️ Image Handling
- **Paste images** from clipboard (Ctrl+V)
  - Screenshots
  - Image files from file explorer
  - Rich text with embedded images
- **Auto-save** to `assets/` folder
- **Drag and drop** image upload

### 🎨 VS Code Integration
- **Theme support**: Automatically adapts to VS Code light/dark theme
- **Custom editor**: Opens `.labnote.md` files automatically
- **Auto-save**: Debounced saving (500ms) for smooth editing

## Installation

### From Source

1. Clone the repository:
```bash
git clone <repository-url>
cd labnotev
```

2. Install dependencies:
```bash
npm run install:all
```

3. Build the extension:
```bash
npm run build
```

4. Open in VS Code and press `F5` to start debugging

## Usage

### Creating a New Note

1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Type "Lab Note: New Note"
3. Enter a file name (without extension)
4. The file will be created as `filename.labnote.md` and opened in the editor

### Opening Existing Files

Simply open any `.labnote.md` file in VS Code. The custom editor will automatically activate.

### Editing

- **Type `/`** to open the slash command menu
- **Drag blocks** to reorder them
- **Paste images** with `Ctrl+V` (or `Cmd+V` on Mac)
- **Format text** with keyboard shortcuts:
  - `Ctrl+B` / `Cmd+B`: Bold
  - `Ctrl+I` / `Cmd+I`: Italic
  - `Ctrl+K` / `Cmd+K`: Link

### Math Blocks

Insert math equations using the `/math` command or by typing `$$` and pressing Enter. Math blocks support LaTeX syntax and are rendered with KaTeX.

Example:
```latex
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
```

## Development

### Project Structure

```
labnotev/
├── src/                    # Extension source code
│   ├── extension.ts       # Main extension entry point
│   └── labNoteEditorProvider.ts  # Custom editor provider
├── webview/               # Webview (React app)
│   └── src/
│       ├── Editor.tsx    # Main editor component
│       ├── blocks/        # Custom block types
│       └── hooks/         # React hooks
└── dist/                  # Compiled output
```

### Available Scripts

```bash
# Build extension and webview
npm run build

# Build extension only
npm run build:extension

# Build webview only
npm run build:webview

# Watch mode (auto-rebuild on changes)
npm run watch

# Development mode (watch both extension and webview)
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run all tests (extension + webview)
npm run test:all
```

### Debugging

1. Open the project in VS Code
2. Press `F5` to start debugging
3. A new Extension Development Host window will open
4. Open a `.labnote.md` file in the new window to test

For more details, see the [Debugging Guide](#debugging).

## Testing

The project includes comprehensive test coverage:

- **Extension tests**: Unit tests for extension logic
- **Webview tests**: Component and hook tests
- **Test framework**: Vitest

Run tests:
```bash
npm test
```

## File Format

Lab notes are stored as Markdown files (`.labnote.md`). The editor provides a visual interface while maintaining compatibility with standard Markdown syntax.

### Image Storage

Images are automatically saved to an `assets/` folder in the same directory as the note file. The Markdown file references images using relative paths:

```markdown
![Image caption](./assets/1234567890_abc123.png)
```

## Requirements

- **VS Code**: ^1.85.0
- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0

## Known Issues

- Image paste may occasionally duplicate in some edge cases (fixed in latest version)
- Large images may take time to process

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[Add your license here]

## Acknowledgments

- Built with [BlockNote](https://www.blocknotejs.org/)
- UI components from [Mantine](https://mantine.dev/)
- Math rendering with [KaTeX](https://katex.org/)
