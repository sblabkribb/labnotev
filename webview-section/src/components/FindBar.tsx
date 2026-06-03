import { useEffect, useRef } from 'react';
import { Paper, Group, TextInput, ActionIcon, Text, Tooltip } from '@mantine/core';

/**
 * Editor-mode find (#30): a compact floating find bar shown at the top-right
 * of the Section Editor. Purely presentational — match collection, navigation,
 * and highlighting live in App / SearchHighlightLayer.
 */
interface FindBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  caseSensitive: boolean;
  onToggleCase: () => void;
  /** Total match count. */
  count: number;
  /** Zero-based index of the active match (-1 when none). */
  activeIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export function FindBar({
  query,
  onQueryChange,
  caseSensitive,
  onToggleCase,
  count,
  activeIndex,
  onNext,
  onPrev,
  onClose,
}: FindBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus + select the query on open so the user can immediately type or
  // overwrite the previous search.
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const countLabel = query.length === 0
    ? ''
    : count === 0
      ? 'No results'
      : `${activeIndex + 1}/${count}`;

  return (
    <Paper
      shadow="md"
      withBorder
      p="xs"
      style={{ position: 'fixed', top: 12, right: 16, zIndex: 50, minWidth: 280 }}
    >
      <Group gap="xs" wrap="nowrap">
        <TextInput
          ref={inputRef}
          size="xs"
          placeholder="Find"
          aria-label="Find in editor"
          value={query}
          onChange={(e) => onQueryChange(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (e.shiftKey) onPrev();
              else onNext();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
          }}
          style={{ flex: 1 }}
        />
        <Text size="xs" c="dimmed" style={{ minWidth: 56, textAlign: 'center', whiteSpace: 'nowrap' }}>
          {countLabel}
        </Text>
        <Tooltip label="Match case" withArrow>
          <ActionIcon
            size="sm"
            variant={caseSensitive ? 'filled' : 'subtle'}
            color="blue"
            aria-label="Match case"
            aria-pressed={caseSensitive}
            onClick={onToggleCase}
          >
            <Text size="xs" fw={700}>Aa</Text>
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Previous (Shift+Enter)" withArrow>
          <ActionIcon size="sm" variant="subtle" aria-label="Previous match" disabled={count === 0} onClick={onPrev}>
            <ChevronUpIcon />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Next (Enter)" withArrow>
          <ActionIcon size="sm" variant="subtle" aria-label="Next match" disabled={count === 0} onClick={onNext}>
            <ChevronDownIcon />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Close (Esc)" withArrow>
          <ActionIcon size="sm" variant="subtle" aria-label="Close find" onClick={onClose}>
            <CloseIcon />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Paper>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
