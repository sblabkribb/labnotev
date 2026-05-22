import { useRef, useState } from 'react';
import { Title, Paper, Stack, Group, ActionIcon, Tooltip } from '@mantine/core';
import { HighlightedTextarea } from './HighlightedTextarea';
import { ImageThumbnails } from './ImageThumbnails';
import { AttachmentLinks } from './AttachmentLinks';
import { TableInsertModal } from './TableInsertModal';
import { useTableEditing } from '../hooks/useTableEditing';
import type { SampleDefMap } from '../types';

interface SectionEditorProps {
  heading: string;
  content: string;
  onChange: (content: string) => void;
  onFocus?: () => void;
  onCursorActivity?: (pos: number) => void;
  headingLevel?: 'h2' | 'h3' | 'h4';
  minRows?: number;
  docBaseUri?: string;
  requestFocusAt?: { pos: number; tick: number; scroll?: 'none' | 'nearest' | 'center' } | null;
  availableTypes?: string[];
  sampleTypeColors?: Record<string, string>;
  sampleDefs?: SampleDefMap;
  onAttachFile?: () => void;
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
  sampleTypeColors,
  sampleDefs,
  onAttachFile,
}: SectionEditorProps) {
  const order = headingLevel === 'h2' ? 2 : headingLevel === 'h3' ? 3 : 4;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [tableModalOpen, setTableModalOpen] = useState(false);

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

  return (
    <Paper p="sm" withBorder>
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Title order={order}>{heading}</Title>
          <Group gap={4}>
            {onAttachFile && (
              <Tooltip label="Attach file" position="bottom" withArrow>
                <ActionIcon variant="subtle" size="sm" onClick={onAttachFile} aria-label="Attach file">
                  <AttachIcon />
                </ActionIcon>
              </Tooltip>
            )}
            <Tooltip label="Insert table" position="bottom" withArrow>
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={() => setTableModalOpen(true)}
                aria-label="Insert table"
              >
                <TableIcon />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Align table" position="bottom" withArrow>
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={handleAlignTable}
                disabled={!cursorInTable}
                aria-label="Align table"
              >
                <AlignIcon />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>

        <HighlightedTextarea
          ref={textareaRef}
          value={content}
          onChange={onChange}
          onFocus={onFocus}
          onCursorChange={onCursorActivity}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          minRows={minRows}
          availableTypes={availableTypes}
          sampleTypeColors={sampleTypeColors}
          sampleDefs={sampleDefs}
          requestFocusAt={requestFocusAt}
          chatContextSectionHeading={heading}
        />
        {docBaseUri && <ImageThumbnails content={content} docBaseUri={docBaseUri} />}
        <AttachmentLinks content={content} />
      </Stack>

      <TableInsertModal
        opened={tableModalOpen}
        onClose={() => setTableModalOpen(false)}
        onInsert={handleTableInsert}
      />
    </Paper>
  );
}

function AttachIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 4.5L4.5 9.5a2 2 0 102.8 2.8l5.8-5.8a2.5 2.5 0 00-3.5-3.5L3.8 8.3" />
    </svg>
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
