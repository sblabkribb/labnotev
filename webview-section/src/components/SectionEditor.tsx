import { useRef, useEffect, useState } from 'react';
import { Title, Paper, Stack, Group, ActionIcon, Tooltip } from '@mantine/core';
import { SampleHighlighter, highlightSampleIds } from './SampleHighlighter';
import { ImageThumbnails } from './ImageThumbnails';
import { TableInsertModal } from './TableInsertModal';
import { useTableEditing } from '../hooks/useTableEditing';

interface SectionEditorProps {
  heading: string;
  content: string;
  onChange: (content: string) => void;
  onFocus?: () => void;
  onCursorActivity?: (pos: number) => void;
  headingLevel?: 'h2' | 'h3' | 'h4';
  minRows?: number;
  docBaseUri?: string;
  requestFocusAt?: { pos: number; tick: number } | null;
  availableTypes?: string[];
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
  requestFocusAt,
  availableTypes,
}: SectionEditorProps) {
  const order = headingLevel === 'h2' ? 2 : headingLevel === 'h3' ? 3 : 4;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [hasSamples, setHasSamples] = useState(false);
  const [tableModalOpen, setTableModalOpen] = useState(false);

  useEffect(() => {
    setHasSamples(highlightSampleIds(content, availableTypes));
  }, [content, availableTypes]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }, [content]);

  useEffect(() => {
    if (!requestFocusAt) return;
    const ta = textareaRef.current;
    if (!ta) return;
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = requestFocusAt.pos;
      reportCursor();
    });
  }, [requestFocusAt?.tick]);

  const reportCursor = () => {
    if (textareaRef.current && onCursorActivity) {
      onCursorActivity(textareaRef.current.selectionStart);
    }
  };

  const {
    handleTableInsert,
    handleAlignTable,
    handleKeyDown,
    handlePaste,
    cursorInTable,
  } = useTableEditing(textareaRef, content, onChange, reportCursor);

  const syncScroll = () => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

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
    background: hasSamples ? 'transparent' : 'var(--mantine-color-body)',
    position: hasSamples ? 'relative' : undefined,
    zIndex: hasSamples ? 2 : undefined,
    caretColor: 'var(--mantine-color-text)',
    color: hasSamples ? 'transparent' : 'var(--mantine-color-text)',
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
              <SampleHighlighter text={content} interactive availableTypes={availableTypes} />
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
