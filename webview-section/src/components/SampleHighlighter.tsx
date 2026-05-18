import React, { memo, useMemo } from 'react';
import { HoverCard, Stack, Text, Button } from '@mantine/core';
import type { SampleDefMap } from '../types';
import { postMessage } from '../vscodeApi';

// NOTE: Single source of truth for sample types and colors now lives in
// extension `src/lib/sampleUtils.ts`. The webview MUST receive both via the
// init message (availableTypes + sampleTypeColors props). This component no
// longer embeds its own hard-coded BUILTIN_TYPES or SAMPLE_COLORS so the
// document decoration and webview overlay cannot drift out of sync.

const DEFAULT_CUSTOM_COLOR = '#607D8B';

/** Open the HoverCard immediately in Vitest (compatible with fake timers). */
const HOVER_OPEN_DELAY = import.meta.env.MODE === 'test' ? 0 : 250;
const HOVER_CLOSE_DELAY = import.meta.env.MODE === 'test' ? 0 : 150;

function escapeRegExpForType(t: string): string {
  return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSamplePattern(availableTypes?: string[]): RegExp | null {
  const types = availableTypes && availableTypes.length > 0 ? availableTypes : [];
  if (types.length === 0) {
    return null;
  }
  const typeStr = types.map(escapeRegExpForType).join('|');
  return new RegExp(`\\b(${typeStr})-\\d+(?:-\\d+)*(?:[;|][^\\s;|]+)?`, 'g');
}

interface SampleHighlighterProps {
  text: string;
  /** When true, hover shows definition HoverCard (overlay mode). */
  interactive?: boolean;
  availableTypes?: string[];
  /** Injected via init message; keys match SAMPLE_TYPES + customSampleTypes. */
  sampleTypeColors?: Record<string, string>;
  sampleDefs?: SampleDefMap;
  /**
   * Phase B-2: Clicks on sample tokens should still move the caret in the
   * underlying textarea instead of being swallowed by the HoverCard target.
   * The parent (HighlightedTextarea) supplies this callback and translates
   * mouse coordinates into a character offset inside the textarea value.
   */
  onSampleClick?: (event: React.MouseEvent<HTMLSpanElement>) => void;
}

export function navigateSampleToDefinition(sampleId: string, sampleType: string) {
  postMessage({ type: 'navigateToSample', data: { sampleId, sampleType } });
}

function SampleHoverDropdown({
  sampleType,
  sampleId,
  sampleDefs,
}: {
  sampleType: string;
  sampleId: string;
  sampleDefs?: SampleDefMap;
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
      <Text size="sm" fw={600}>
        {sampleType} {sampleId}
      </Text>
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

      // No horizontal padding: any extra inline width on these spans would
      // diverge from the underlying textarea's character grid and shift wrap
      // positions, making the caret appear one visual line off. The slightly
      // stronger background alpha (22 vs 15) keeps the token visually
      // recognisable without claiming any extra layout width.
      const spanStyle: React.CSSProperties = {
        color,
        fontWeight: 600,
        backgroundColor: `${color}22`,
        borderRadius: '2px',
        ...(interactive ? { pointerEvents: 'auto' as const } : {}),
      };

      const span = (
        <span
          key={match.index}
          style={spanStyle}
          onMouseDown={onSampleClick}
        >
          {fullMatch}
        </span>
      );

      if (interactive) {
        result.push(
          <HoverCard
            key={`hc-${match.index}`}
            width={300}
            shadow="md"
            withArrow
            openDelay={HOVER_OPEN_DELAY}
            closeDelay={HOVER_CLOSE_DELAY}
            withinPortal
          >
            <HoverCard.Target>{span}</HoverCard.Target>
            <HoverCard.Dropdown>
              <SampleHoverDropdown sampleType={sampleType} sampleId={sampleId} sampleDefs={sampleDefs} />
            </HoverCard.Dropdown>
          </HoverCard>
        );
      } else {
        result.push(span);
      }

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
