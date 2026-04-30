import { useCallback, type RefObject } from 'react';
import {
  isInsideTable,
  getNextCellPosition,
  getPrevCellPosition,
  alignTableColumns,
  looksLikeTsv,
  tsvToMarkdownTable,
} from '../utils/markdownTable';
import { applyIndent } from '../utils/indent';

export function useTableEditing(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  content: string,
  onChange: (content: string) => void,
  reportCursor: () => void,
) {
  const insertTextAtCursor = useCallback((text: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const prefix = pos > 0 && content[pos - 1] !== '\n' ? '\n' : '';
    const newContent = content.slice(0, pos) + prefix + text + content.slice(pos);
    onChange(newContent);
    requestAnimationFrame(() => {
      const newPos = pos + prefix.length + text.length;
      ta.selectionStart = ta.selectionEnd = newPos;
      ta.focus();
      reportCursor();
    });
  }, [content, onChange, textareaRef, reportCursor]);

  const handleTableInsert = useCallback((tableMarkdown: string) => {
    insertTextAtCursor(tableMarkdown);
  }, [insertTextAtCursor]);

  const handleAlignTable = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const result = alignTableColumns(content, ta.selectionStart);
    if (!result) return;
    onChange(result.text);
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = result.newCursorPos;
      ta.focus();
      reportCursor();
    });
  }, [content, onChange, textareaRef, reportCursor]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    const pos = ta.selectionStart;

    if (e.key === 'Escape') {
      ta.blur();
      return;
    }

    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
      if (isInsideTable(content, pos)) {
        e.preventDefault();

        if (e.shiftKey) {
          const prev = getPrevCellPosition(content, pos);
          if (prev !== null) {
            ta.selectionStart = ta.selectionEnd = prev;
            reportCursor();
          }
        } else {
          const next = getNextCellPosition(content, pos);
          if (next) {
            if (next.newText) {
              onChange(next.newText);
              requestAnimationFrame(() => {
                ta.selectionStart = ta.selectionEnd = next.pos;
                reportCursor();
              });
            } else {
              ta.selectionStart = ta.selectionEnd = next.pos;
              reportCursor();
            }
          }
        }
        return;
      }

      // Issue #18-2: outside tables, Tab indents and Shift+Tab outdents
      // instead of moving focus to the next focusable element.
      e.preventDefault();
      const selStart = ta.selectionStart;
      const selEnd = ta.selectionEnd;
      const result = applyIndent(content, selStart, selEnd, e.shiftKey ? 'outdent' : 'indent');
      if (result.text === content && result.selStart === selStart && result.selEnd === selEnd) {
        return;
      }
      onChange(result.text);
      requestAnimationFrame(() => {
        ta.selectionStart = result.selStart;
        ta.selectionEnd = result.selEnd;
        reportCursor();
      });
    }
  }, [content, onChange, handleAlignTable, reportCursor]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text || !looksLikeTsv(text)) return;

    const table = tsvToMarkdownTable(text);
    if (!table) return;

    e.preventDefault();
    const ta = e.currentTarget;
    const pos = ta.selectionStart;
    const end = ta.selectionEnd;
    const prefix = pos > 0 && content[pos - 1] !== '\n' ? '\n' : '';
    const newContent = content.slice(0, pos) + prefix + table + content.slice(end);
    onChange(newContent);
    requestAnimationFrame(() => {
      const newPos = pos + prefix.length + table.length;
      ta.selectionStart = ta.selectionEnd = newPos;
      reportCursor();
    });
  }, [content, onChange]);

  const cursorInTable = (() => {
    const ta = textareaRef.current;
    if (!ta) return false;
    return isInsideTable(content, ta.selectionStart);
  })();

  return {
    insertTextAtCursor,
    handleTableInsert,
    handleAlignTable,
    handleKeyDown,
    handlePaste,
    cursorInTable,
  };
}
