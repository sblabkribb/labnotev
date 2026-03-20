import { useRef, useEffect, useState, useCallback } from 'react';
import { Title, Paper, Stack } from '@mantine/core';
import { SampleHighlighter, highlightSampleIds } from './SampleHighlighter';
import { SampleAutocomplete } from './SampleAutocomplete';

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
  const [autocomplete, setAutocomplete] = useState<{ top: number; left: number; atPos: number } | null>(null);

  useEffect(() => {
    setHasSamples(highlightSampleIds(content));
  }, [content]);

  const syncScroll = () => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === '@' && !autocomplete) {
      const ta = textareaRef.current;
      if (!ta) return;
      const rect = ta.getBoundingClientRect();
      const containerRect = ta.parentElement?.getBoundingClientRect();
      if (!containerRect) return;

      // Approximate caret position using character metrics
      const lineHeight = 13 * 1.55;
      const text = ta.value.substring(0, ta.selectionStart);
      const lines = text.split('\n');
      const currentLine = lines.length - 1;
      const top = (currentLine + 1) * lineHeight + 8 - ta.scrollTop;
      const left = 8;

      setAutocomplete({ top, left, atPos: ta.selectionStart });
    }
  }, [autocomplete]);

  const handleAutocompleteSelect = useCallback((sampleText: string) => {
    if (autocomplete === null) return;
    const ta = textareaRef.current;
    if (!ta) return;

    const before = content.substring(0, autocomplete.atPos + 1);
    const after = content.substring(ta.selectionStart);
    const filterText = content.substring(autocomplete.atPos + 1, ta.selectionStart);

    // Replace @<filter> with the selected sample
    const newContent = content.substring(0, autocomplete.atPos) + sampleText + after;
    onChange(newContent);
    setAutocomplete(null);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        const newPos = autocomplete.atPos + sampleText.length;
        textareaRef.current.selectionStart = newPos;
        textareaRef.current.selectionEnd = newPos;
        textareaRef.current.focus();
      }
    });
  }, [autocomplete, content, onChange]);

  const handleAutocompleteClose = useCallback(() => {
    setAutocomplete(null);
  }, []);

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
            onKeyDown={handleKeyDown}
            style={textareaStyle}
          />
          {autocomplete && (
            <SampleAutocomplete
              position={{ top: autocomplete.top, left: autocomplete.left }}
              onSelect={handleAutocompleteSelect}
              onClose={handleAutocompleteClose}
            />
          )}
        </div>
      </Stack>
    </Paper>
  );
}
