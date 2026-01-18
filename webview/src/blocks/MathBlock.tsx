import React, { useState, useEffect, useRef } from 'react';
import { createReactBlockSpec, DefaultReactSuggestionItem } from '@blocknote/react';
import { BlockNoteEditor } from '@blocknote/core';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Math block component
const MathBlockComponent: React.FC<{
  block: {
    id: string;
    props: { latex: string };
  };
  editor: {
    updateBlock: (id: string, update: { props: { latex: string } }) => void;
  };
}> = ({ block, editor }) => {
  const [isEditing, setIsEditing] = useState(!block.props.latex);
  const [latex, setLatex] = useState(block.props.latex || '');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const renderedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing && renderedRef.current && latex) {
      try {
        katex.render(latex, renderedRef.current, {
          displayMode: true,
          throwOnError: false,
          trust: true,
        });
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    }
  }, [isEditing, latex]);

  const handleSave = () => {
    editor.updateBlock(block.id, {
      props: { latex },
    });
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setLatex(block.props.latex || '');
      setIsEditing(false);
    }
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  };

  if (isEditing) {
    return (
      <div className="math-block math-block-editing">
        <textarea
          ref={inputRef}
          value={latex}
          onChange={(e) => setLatex(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter LaTeX formula (Ctrl+Enter to save, Esc to cancel)"
          rows={3}
          className="math-input"
        />
        <div className="math-preview">
          {latex && (
            <div
              ref={renderedRef}
              className="math-rendered"
            />
          )}
          {error && <div className="math-error">{error}</div>}
        </div>
        <div className="math-actions">
          <button onClick={handleSave} className="math-save-btn">
            Save
          </button>
          <button
            onClick={() => {
              setLatex(block.props.latex || '');
              setIsEditing(false);
            }}
            className="math-cancel-btn"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="math-block math-block-display"
      onClick={() => setIsEditing(true)}
      title="Click to edit"
    >
      {latex ? (
        <div ref={renderedRef} className="math-rendered" />
      ) : (
        <div className="math-placeholder">Click to add math formula</div>
      )}
    </div>
  );
};

// Create the math block spec
export const MathBlock = createReactBlockSpec(
  {
    type: 'math',
    propSchema: {
      latex: {
        default: '',
      },
    },
    content: 'none',
  },
  {
    render: (props) => (
      <MathBlockComponent
        block={props.block}
        editor={props.editor as {
          updateBlock: (id: string, update: { props: { latex: string } }) => void;
        }}
      />
    ),
  }
);

// Factory function to create slash menu item for math block
export const createInsertMathBlock = (editor: BlockNoteEditor<any, any, any>): DefaultReactSuggestionItem => ({
  title: 'Math Formula',
  onItemClick: () => {
    const currentBlock = editor.getTextCursorPosition().block;
    editor.insertBlocks(
      [{ type: 'math' as const, props: { latex: '' } }],
      currentBlock,
      'after'
    );
  },
  aliases: ['math', 'latex', 'equation', 'formula', 'katex'],
  group: 'Advanced',
  icon: <span style={{ fontSize: '14px' }}>∑</span>,
  subtext: 'Insert a math formula (LaTeX)',
});

// For backward compatibility
export const insertMathBlock: DefaultReactSuggestionItem = {
  title: 'Math Formula',
  onItemClick: () => {},
  aliases: ['math', 'latex', 'equation', 'formula', 'katex'],
  group: 'Advanced',
  icon: <span style={{ fontSize: '14px' }}>∑</span>,
  subtext: 'Insert a math formula (LaTeX)',
};
