import { useRef, useEffect, useState, useCallback } from 'react';
import { Title, Paper, Stack, Group, ActionIcon, Tooltip } from '@mantine/core';
import { SampleHighlighter, highlightSampleIds } from './SampleHighlighter';
import { ImageThumbnails } from './ImageThumbnails';
import { TableInsertModal } from './TableInsertModal';
import {
  isInsideTable,
  getNextCellPosition,
  getPrevCellPosition,
  alignTableColumns,
  looksLikeTsv,
  tsvToMarkdownTable,
} from '../utils/markdownTable';

interface SectionEditorProps {
  heading: string;
  content: string;
  onChange: (content: string) => void;
  onFocus?: () => void;
  onCursorActivity?: (pos: number) => void;
  headingLevel?: 'h2' | 'h3' | 'h4';
  minRows?: number;
  docBaseUri?: string;
}

export function SectionEditor({
  heading,
  content,
  onChange,
  onFocus,
  onCursorActivity,
  headingLevel = 'h3',
  minRows = 4,
  docBaseUri,
}: SectionEditorProps) {
  const order = headingLevel === 'h2' ? 2 : headingLevel === 'h3' ? 3 : 4;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [hasSamples, setHasSamples] = useState(false);
  const [tableModalOpen, setTableModalOpen] = useState(false);

  useEffect(() => {
    setHasSamples(highlightSampleIds(content));
  }, [content]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }, [content]);

  const reportCursor = () => {
    if (textareaRef.current && onCursorActivity) {
      onCursorActivity(textareaRef.current.selectionStart);
    }
  };

  const syncScroll = () => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

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
  }, [content, onChange]);

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
  }, [content, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    const pos = ta.selectionStart;

    // Escape: blur textarea for accessibility
    if (e.key === 'Escape') {
      ta.blur();
      return;
    }

    // Ctrl+Shift+F: align table columns
    if (e.key === 'f' && e.ctrlKey && e.shiftKey && !e.altKey) {
      if (isInsideTable(content, pos)) {
        e.preventDefault();
        handleAlignTable();
        return;
      }
    }

    // Tab / Shift+Tab: cell navigation inside tables
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
      if (!isInsideTable(content, pos)) return;
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
    }
  }, [content, onChange, handleAlignTable]);

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

  const textareaStyle: React.CSSProperties = {
    fontFamily: 'monospace',
    fontSize: '13px',
    lineHeight: '1.55',
    width: '100%',
    padding: '8px',
    border: '1px solid var(--mantine-color-default-border)',
    borderRadius: '4px',
    resize: 'none',
    overflow: 'hidden',
    minHeight: `${minRows * 1.55 * 13 + 16}px`,
    background: hasSamples ? 'transparent' : undefined,
    position: hasSamples ? 'relative' : undefined,
    zIndex: hasSamples ? 2 : undefined,
    caretColor: 'var(--mantine-color-text)',
    color: hasSamples ? 'transparent' : undefined,
  };

  const overlayStyle: React.CSSProperties = {
    fontFamily: 'monospace',
    fontSize: '13px',
    lineHeight: '1.55',
    padding: '8px',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    overflow: 'hidden',
    zIndex: 1,
    color: 'var(--mantine-color-text)',
  };

  return (
    <Paper p="sm" withBorder>
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Title order={order}>{heading}</Title>
          <Group gap={4}>
            <Tooltip label="테이블 삽입" position="bottom" withArrow>
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={() => setTableModalOpen(true)}
                aria-label="테이블 삽입"
              >
                <TableIcon />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="테이블 정렬 (Ctrl+Shift+F)" position="bottom" withArrow>
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={handleAlignTable}
                disabled={!cursorInTable}
                aria-label="테이블 정렬"
              >
                <AlignIcon />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <div style={{ position: 'relative' }}>
          {hasSamples && (
            <div ref={overlayRef} style={overlayStyle}>
              <SampleHighlighter text={content} interactive />
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => { onChange(e.currentTarget.value); reportCursor(); }}
            onFocus={() => { onFocus?.(); reportCursor(); }}
            onClick={reportCursor}
            onKeyUp={reportCursor}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onScroll={syncScroll}
            style={textareaStyle}
          />
        </div>
        {docBaseUri && <ImageThumbnails content={content} docBaseUri={docBaseUri} />}
      </Stack>

      <TableInsertModal
        opened={tableModalOpen}
        onClose={() => setTableModalOpen(false)}
        onInsert={handleTableInsert}
      />
    </Paper>
  );
}

function TableIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2.5" width="13" height="11" rx="1" />
      <line x1="1.5" y1="6" x2="14.5" y2="6" />
      <line x1="1.5" y1="10" x2="14.5" y2="10" />
      <line x1="6" y1="2.5" x2="6" y2="13.5" />
      <line x1="10.5" y1="2.5" x2="10.5" y2="13.5" />
    </svg>
  );
}

function AlignIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="4" x2="14" y2="4" />
      <line x1="2" y1="8" x2="14" y2="8" />
      <line x1="2" y1="12" x2="10" y2="12" />
    </svg>
  );
}
