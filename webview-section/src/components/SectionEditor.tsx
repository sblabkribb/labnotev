import { useRef, useEffect, useState } from 'react';
import { Title, Paper, Stack } from '@mantine/core';
import { SampleHighlighter, highlightSampleIds } from './SampleHighlighter';

interface SectionEditorProps {
  heading: string;
  content: string;
  onChange: (content: string) => void;
  onFocus?: () => void;
  headingLevel?: 'h2' | 'h3' | 'h4';
  minRows?: number;
}

export function SectionEditor({
  heading,
  content,
  onChange,
  onFocus,
  headingLevel = 'h3',
  minRows = 4,
}: SectionEditorProps) {
  const order = headingLevel === 'h2' ? 2 : headingLevel === 'h3' ? 3 : 4;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [hasSamples, setHasSamples] = useState(false);

  useEffect(() => {
    setHasSamples(highlightSampleIds(content));
  }, [content]);

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
    resize: 'vertical',
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
        <Title order={order}>{heading}</Title>
        <div style={{ position: 'relative' }}>
          {hasSamples && (
            <div ref={overlayRef} style={overlayStyle}>
              <SampleHighlighter text={content} interactive />
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => onChange(e.currentTarget.value)}
            onFocus={onFocus}
            onScroll={syncScroll}
            style={textareaStyle}
          />
        </div>
      </Stack>
    </Paper>
  );
}
