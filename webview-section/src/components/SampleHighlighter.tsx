import React, { useMemo } from 'react';
import { HoverCard, Stack, Text, Button } from '@mantine/core';
import type { SampleDefMap } from '../types';
import { postMessage } from '../vscodeApi';

// NOTE: Single source of truth for sample types and colors now lives in
// extension `src/lib/sampleUtils.ts`. The webview MUST receive both via the
// init message (availableTypes + sampleTypeColors props). This component no
// longer embeds its own hard-coded BUILTIN_TYPES or SAMPLE_COLORS so the
// document decoration and webview overlay cannot drift out of sync.

const DEFAULT_CUSTOM_COLOR = '#607D8B';

/** Vitest에서 HoverCard가 바로 열리도록 (fake timers와 호환). */
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
  // Phase B-3: "정의로 이동" is only meaningful when the document actually
  // contains this sample's definition. If `sampleDefs` does not know about
  // the id, clicking the button used to silently do nothing — which was
  // indistinguishable from the navigation failing. Disable it instead and
  // surface the reason through a native tooltip.
  const canNavigate = def !== undefined;
  const navTitle = canNavigate
    ? '이 샘플의 정의(@type;id;...)가 있는 위치로 이동합니다'
    : '이 문서에서 아직 정의되지 않은 샘플입니다';

  return (
    <Stack gap="xs">
      <Text size="sm" fw={600}>
        {sampleType} {sampleId}
      </Text>
      {def === undefined ? (
        <Text size="sm" c="dimmed">
          정의 정보 없음
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
          등록된 별칭·설명 없음
        </Text>
      )}
      <Button
        size="xs"
        variant="light"
        disabled={!canNavigate}
        title={navTitle}
        onClick={() => navigateSampleToDefinition(sampleId, sampleType)}
      >
        정의로 이동
      </Button>
    </Stack>
  );
}

export function SampleHighlighter({
  text,
  interactive = false,
  availableTypes,
  sampleTypeColors,
  sampleDefs,
  onSampleClick,
}: SampleHighlighterProps) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const regex = useMemo(() => buildSamplePattern(availableTypes), [availableTypes]);

  if (!regex) {
    return <>{text}</>;
  }

  const pattern = new RegExp(regex.source, 'g');
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const sampleType = match[1];
    const fullMatch = match[0];
    const sampleId = fullMatch.split(/[;|]/)[0];
    const color = sampleTypeColors?.[sampleType] || DEFAULT_CUSTOM_COLOR;

    const spanStyle: React.CSSProperties = {
      color,
      fontWeight: 600,
      backgroundColor: `${color}15`,
      padding: '0 2px',
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
      parts.push(
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
      parts.push(span);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}

export function highlightSampleIds(text: string, availableTypes?: string[]): boolean {
  const pattern = buildSamplePattern(availableTypes);
  if (!pattern) return false;
  return pattern.test(text);
}
