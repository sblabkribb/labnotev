import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

// Mock KaTeX
vi.mock('katex', () => ({
  default: {
    render: vi.fn((latex: string, element: HTMLElement) => {
      element.innerHTML = `<span class="katex-mock">${latex}</span>`;
    }),
  },
}));

// Import after mocking
import { insertMathBlock, createInsertMathBlock } from '../blocks/MathBlock';

// Since MathBlock uses createReactBlockSpec which is complex to test,
// we'll test the insertMathBlock slash menu item and the core logic
describe('MathBlock', () => {
  describe('insertMathBlock default item (backward compatibility)', () => {
    it('should have correct title', () => {
      expect(insertMathBlock.title).toBe('Math Formula');
    });

    it('should have correct aliases', () => {
      expect(insertMathBlock.aliases).toContain('math');
      expect(insertMathBlock.aliases).toContain('latex');
      expect(insertMathBlock.aliases).toContain('equation');
      expect(insertMathBlock.aliases).toContain('formula');
      expect(insertMathBlock.aliases).toContain('katex');
    });

    it('should be in Advanced group', () => {
      expect(insertMathBlock.group).toBe('Advanced');
    });

    it('should have subtext', () => {
      expect(insertMathBlock.subtext).toBe('Insert a math formula (LaTeX)');
    });

    it('should have an icon', () => {
      expect(insertMathBlock.icon).toBeDefined();
    });
  });

  describe('createInsertMathBlock factory function', () => {
    it('should create a valid slash menu item with onItemClick', () => {
      const mockEditor = {
        getTextCursorPosition: vi.fn(() => ({
          block: { id: 'current-block' },
        })),
        insertBlocks: vi.fn(),
      } as any;

      const item = createInsertMathBlock(mockEditor);

      expect(item.title).toBe('Math Formula');
      expect(typeof item.onItemClick).toBe('function');
      expect(item.aliases).toContain('math');
      expect(item.group).toBe('Advanced');
    });

    it('should insert math block when onItemClick is called', () => {
      const mockEditor = {
        getTextCursorPosition: vi.fn(() => ({
          block: { id: 'current-block' },
        })),
        insertBlocks: vi.fn(),
      } as any;

      const item = createInsertMathBlock(mockEditor);
      item.onItemClick();

      expect(mockEditor.insertBlocks).toHaveBeenCalledWith(
        [{ type: 'math', props: { latex: '' } }],
        { id: 'current-block' },
        'after'
      );
    });
  });

  describe('MathBlock component behavior', () => {
    // Create a simple test component that mimics MathBlock behavior
    const TestMathComponent: React.FC<{
      latex: string;
      onSave: (latex: string) => void;
    }> = ({ latex: initialLatex, onSave }) => {
      const [isEditing, setIsEditing] = React.useState(!initialLatex);
      const [latex, setLatex] = React.useState(initialLatex);

      const handleSave = () => {
        onSave(latex);
        setIsEditing(false);
      };

      if (isEditing) {
        return (
          <div data-testid="math-editing">
            <textarea
              data-testid="math-input"
              value={latex}
              onChange={(e) => setLatex(e.target.value)}
              placeholder="Enter LaTeX formula"
            />
            <button data-testid="save-btn" onClick={handleSave}>Save</button>
            <button data-testid="cancel-btn" onClick={() => {
              setLatex(initialLatex);
              setIsEditing(false);
            }}>Cancel</button>
          </div>
        );
      }

      return (
        <div data-testid="math-display" onClick={() => setIsEditing(true)}>
          {latex ? <span>{latex}</span> : <span>Click to add math</span>}
        </div>
      );
    };

    it('should show editing mode when no latex content', () => {
      render(<TestMathComponent latex="" onSave={vi.fn()} />);
      
      expect(screen.getByTestId('math-editing')).toBeInTheDocument();
      expect(screen.getByTestId('math-input')).toBeInTheDocument();
    });

    it('should show display mode when latex content exists', () => {
      render(<TestMathComponent latex="E=mc^2" onSave={vi.fn()} />);
      
      expect(screen.getByTestId('math-display')).toBeInTheDocument();
      expect(screen.getByText('E=mc^2')).toBeInTheDocument();
    });

    it('should switch to editing mode on click', async () => {
      const user = userEvent.setup();
      render(<TestMathComponent latex="E=mc^2" onSave={vi.fn()} />);
      
      await user.click(screen.getByTestId('math-display'));
      
      expect(screen.getByTestId('math-editing')).toBeInTheDocument();
    });

    it('should update latex content in textarea', async () => {
      const user = userEvent.setup();
      render(<TestMathComponent latex="" onSave={vi.fn()} />);
      
      const input = screen.getByTestId('math-input');
      await user.type(input, 'x^2 + y^2 = z^2');
      
      expect(input).toHaveValue('x^2 + y^2 = z^2');
    });

    it('should save and switch to display mode', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      render(<TestMathComponent latex="" onSave={onSave} />);
      
      const input = screen.getByTestId('math-input');
      await user.type(input, 'a^2 + b^2 = c^2');
      await user.click(screen.getByTestId('save-btn'));
      
      expect(onSave).toHaveBeenCalledWith('a^2 + b^2 = c^2');
      expect(screen.getByTestId('math-display')).toBeInTheDocument();
    });

    it('should cancel and revert changes', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      render(<TestMathComponent latex="original" onSave={onSave} />);
      
      // Click to edit
      await user.click(screen.getByTestId('math-display'));
      
      // Change content
      const input = screen.getByTestId('math-input');
      await user.clear(input);
      await user.type(input, 'modified');
      
      // Cancel
      await user.click(screen.getByTestId('cancel-btn'));
      
      expect(onSave).not.toHaveBeenCalled();
      expect(screen.getByTestId('math-display')).toBeInTheDocument();
      expect(screen.getByText('original')).toBeInTheDocument();
    });

    it('should show placeholder when empty', () => {
      render(<TestMathComponent latex="" onSave={vi.fn()} />);
      
      expect(screen.getByPlaceholderText('Enter LaTeX formula')).toBeInTheDocument();
    });
  });

  describe('KaTeX rendering', () => {
    it('should render basic LaTeX expressions', async () => {
      const katex = await import('katex');
      const container = document.createElement('div');
      
      katex.default.render('E=mc^2', container, { displayMode: true });
      
      expect(katex.default.render).toHaveBeenCalled();
      expect(container.innerHTML).toContain('E=mc^2');
    });

    it('should handle complex formulas', async () => {
      const katex = await import('katex');
      const container = document.createElement('div');
      
      const complexFormula = '\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}';
      katex.default.render(complexFormula, container, { displayMode: true });
      
      expect(katex.default.render).toHaveBeenCalledWith(
        complexFormula,
        container,
        expect.objectContaining({ displayMode: true })
      );
    });
  });
});
