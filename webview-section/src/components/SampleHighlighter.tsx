import React, { memo, useMemo, useState } from 'react';
import { Popover, CloseButton, Group, Stack, Text, Button } from '@mantine/core';
import type { SampleDefMap } from '../types';
import { postMessage } from '../vscodeApi';

// NOTE: Single source of truth for sample types and colors now lives in
// extension `src/lib/sampleUtils.ts`. The webview MUST receive both via the
// init message (availableTypes + sampleTypeColors props). This component no
// longer embeds its own hard-coded BUILTIN_TYPES or SAMPLE_COLORS so the
// document decoration and webview overlay cannot drift out of sync.

const DEFAULT_CUSTOM_COLOR = '#607D8B';

function escapeRegExpForType(t: string): string {
  return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSamplePattern(availableTypes?: string[]): RegExp | null {
  const types = availableTypes && availableTypes.length > 0 ? availableTypes : [];
  if (types.length === 0) {
    return null;
  }
  const typeStr = types.map(escapeRegExpForType).join('|');
  // Highlight the sample ID only (e.g. `Reagent-123`), matching the text-mode
  // decoration in `sampleUtils.ts buildSampleIdPattern`. We deliberately do NOT
  // extend into a trailing `;alias` token: aliases can contain spaces, so the
  // old `(?:[;|][^\s;|]+)?` tail highlighted only the first word (e.g. `;TE` of
  // `;TE buffer`), which made the two render paths disagree (issue #27).
  return new RegExp(`\\b(${typeStr})-\\d+(?:-\\d+)*`, 'g');
}

interface SampleHighlighterProps {
  text: string;
  /** When true, clicking a token opens its definition Popover (overlay mode). */
  interactive?: boolean;
  availableTypes?: string[];
  /** Injected via init message; keys match SAMPLE_TYPES + customSampleTypes. */
  sampleTypeColors?: Record<string, string>;
  sampleDefs?: SampleDefMap;
  /**
   * Phase B-2: mousedown on a sample token should still move the caret in the
   * underlying textarea (so the token stays editable) in addition to opening
   * the Popover on click. The parent (HighlightedTextarea) supplies this
   * callback and translates mouse coordinates into a character offset inside
   * the textarea value.
   */
  onSampleClick?: (event: React.MouseEvent<HTMLSpanElement>) => void;
}

export function navigateSampleToDefinition(sampleId: string, sampleType: string) {
  postMessage({ type: 'navigateToSample', data: { sampleId, sampleType } });
}

function SampleInfoDropdown({
  sampleType,
  sampleId,
  sampleDefs,
  onClose,
}: {
  sampleType: string;
  sampleId: string;
  sampleDefs?: SampleDefMap;
  onClose: () => void;
}) {
  const def = sampleDefs?.[sampleId];
  const hasMeta = Boolean(def?.alias || def?.description);
  // Phase B-3: "Go to definition" is only meaningful when the document actually
  // contains this sample's definition. If `sampleDefs` does not know about
  // the id, clicking the button used to silently do nothing — which was
  // indistinguishable from the navigation failing. Disable it instead and
  // surface the reason through a native tooltip.
  const canNavigate = def !== undefined;
  const navTitle = canNavigate
    ? 'Jump to where this sample is defined (@type;id;...)'
    : 'This sample is not yet defined in this document';

  return (
    <Stack gap="xs">
      <Group justify="space-between" wrap="nowrap" align="flex-start" gap="xs">
        <Text size="sm" fw={600}>
          {sampleType} {sampleId}
        </Text>
        <CloseButton size="sm" aria-label="Close" onClick={onClose} />
      </Group>
      {def === undefined ? (
        <Text size="sm" c="dimmed">
          No definition info
        </Text>
      ) : hasMeta ? (
        <>
          {def.alias ? (
            <Text size="sm" fw={700}>
              {def.alias}
            </Text>
          ) : null}
          {def.description ? <Text size="sm">{def.description}</Text> : null}
        </>
      ) : (
        <Text size="sm" c="dimmed">
          No alias or description registered
        </Text>
      )}
      <Button
        size="xs"
        variant="light"
        disabled={!canNavigate}
        title={navTitle}
        onClick={() => navigateSampleToDefinition(sampleId, sampleType)}
      >
        Go to definition
      </Button>
    </Stack>
  );
}

/**
 * A single highlighted sample token.
 *
 * Performance: in `interactive` mode we used to wrap every token in a Mantine
 * popover up-front, so each keystroke re-created the popover target machinery
 * for *all* tokens in the active section. Instead we render a bare `<span>`
 * and only mount the `Popover` once the token is first clicked (`mounted`).
 * Tokens the user never clicks stay as cheap spans.
 *
 * `mounted` is intentionally sticky (never reset to false): once a token has a
 * Popover, keeping it avoids unmount/remount churn on reopen. Only clicked
 * tokens ever pay the Popover cost.
 *
 * Interaction: `onMouseDown` forwards to `onSampleClick` so the caret still
 * lands in the textarea (Phase B-2); `onClick` opens the Popover. mousedown's
 * `preventDefault` (in the parent handler) does not suppress the click event,
 * so a single click both moves the caret and opens the definition popup.
 *
 * Props are kept primitive so the surrounding `React.memo` stays effective:
 * tokens before an edit point keep stable props and skip re-render.
 */
const SampleToken = memo(function SampleToken({
  fullMatch,
  sampleType,
  sampleId,
  color,
  interactive,
  sampleDefs,
  onSampleClick,
}: {
  fullMatch: string;
  sampleType: string;
  sampleId: string;
  color: string;
  interactive: boolean;
  sampleDefs?: SampleDefMap;
  onSampleClick?: (event: React.MouseEvent<HTMLSpanElement>) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [opened, setOpened] = useState(false);

  // Keep this style byte-for-byte identical to the previous inline style: no
  // horizontal padding (the overlay must match the textarea's character grid),
  // color + fontWeight + a slightly stronger background alpha for emphasis.
  const spanStyle = useMemo<React.CSSProperties>(
    () => ({
      color,
      fontWeight: 600,
      backgroundColor: `${color}22`,
      borderRadius: '2px',
      ...(interactive ? { pointerEvents: 'auto' as const } : {}),
    }),
    [color, interactive]
  );

  const span = (
    <span
      style={spanStyle}
      onMouseDown={onSampleClick}
      onClick={
        interactive
          ? () => {
              setMounted(true);
              setOpened(true);
            }
          : undefined
      }
    >
      {fullMatch}
    </span>
  );

  if (!interactive || !mounted) {
    return span;
  }

  return (
    <Popover
      width={300}
      shadow="md"
      withArrow
      withinPortal
      opened={opened}
      // Reflect Mantine-driven closes (click-outside, Escape) back into state.
      onChange={setOpened}
      // Keep focus in the textarea so editing continues uninterrupted.
      trapFocus={false}
    >
      <Popover.Target>{span}</Popover.Target>
      <Popover.Dropdown>
        <SampleInfoDropdown
          sampleType={sampleType}
          sampleId={sampleId}
          sampleDefs={sampleDefs}
          onClose={() => setOpened(false)}
        />
      </Popover.Dropdown>
    </Popover>
  );
});

export const SampleHighlighter = memo(function SampleHighlighter({
  text,
  interactive = false,
  availableTypes,
  sampleTypeColors,
  sampleDefs,
  onSampleClick,
}: SampleHighlighterProps) {
  const regex = useMemo(() => buildSamplePattern(availableTypes), [availableTypes]);

  // Memoize the entire parts array. Previously we rebuilt this regex-driven
  // ReactNode list on every parent re-render (i.e. every keystroke), even
  // when none of the inputs that affect highlighting actually changed.
  // Keying on the textual / configurable inputs means we only re-run the
  // tokenizer when one of them moves.
  const parts = useMemo<React.ReactNode[]>(() => {
    if (!regex) return [text];
    const result: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const pattern = new RegExp(regex.source, 'g');
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push(text.slice(lastIndex, match.index));
      }
      const sampleType = match[1];
      const fullMatch = match[0];
      const sampleId = fullMatch.split(/[;|]/)[0];
      const color = sampleTypeColors?.[sampleType] || DEFAULT_CUSTOM_COLOR;

      result.push(
        <SampleToken
          key={match.index}
          fullMatch={fullMatch}
          sampleType={sampleType}
          sampleId={sampleId}
          color={color}
          interactive={interactive}
          sampleDefs={sampleDefs}
          onSampleClick={onSampleClick}
        />
      );

      lastIndex = pattern.lastIndex;
    }
    if (lastIndex < text.length) {
      result.push(text.slice(lastIndex));
    }
    return result;
  }, [text, regex, sampleTypeColors, sampleDefs, interactive, onSampleClick]);

  return <>{parts}</>;
});

export function highlightSampleIds(text: string, availableTypes?: string[]): boolean {
  const pattern = buildSamplePattern(availableTypes);
  if (!pattern) return false;
  return pattern.test(text);
}
