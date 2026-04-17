import React, { useMemo } from 'react';
import { HoverCard, Stack, Text, Button } from '@mantine/core';
import type { SampleDefMap } from '../types';
import { postMessage } from '../vscodeApi';

const BUILTIN_TYPES = [
  'DNA', 'RNA', 'Plasmid', 'Protein', 'Cell', 'Media',
  'Reagent', 'Labware', 'Enzyme', 'Buffer', 'Kit', 'Standard',
  'Primer', 'Vector', 'Antibody', 'Strain', 'Equip',
];

const SAMPLE_COLORS: Record<string, string> = {
  DNA: '#e74c3c',
  RNA: '#3498db',
  Plasmid: '#9b59b6',
  Protein: '#e67e22',
  Cell: '#2ecc71',
  Media: '#1abc9c',
  Reagent: '#f39c12',
  Labware: '#95a5a6',
  Enzyme: '#d35400',
  Buffer: '#16a085',
  Kit: '#8e44ad',
  Standard: '#2c3e50',
  Primer: '#c0392b',
  Vector: '#7f8c8d',
  Antibody: '#27ae60',
  Strain: '#2980b9',
  Equip: '#7f8c8d',
};

const DEFAULT_CUSTOM_COLOR = '#607D8B';

/** Vitest에서 HoverCard가 바로 열리도록 (fake timers와 호환). */
const HOVER_OPEN_DELAY = import.meta.env.MODE === 'test' ? 0 : 250;
const HOVER_CLOSE_DELAY = import.meta.env.MODE === 'test' ? 0 : 150;

function buildSamplePattern(availableTypes?: string[]): RegExp {
  const allTypes = new Set([...BUILTIN_TYPES, ...(availableTypes ?? [])]);
  const typeStr = [...allTypes].map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`\\b(${typeStr})-\\d+(?:[;|][^\\s;|]+)?`, 'g');
}

interface SampleHighlighterProps {
  text: string;
  /** When true, hover shows definition HoverCard (overlay mode). */
  interactive?: boolean;
  availableTypes?: string[];
  sampleDefs?: SampleDefMap;
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
        onClick={() => navigateSampleToDefinition(sampleId, sampleType)}
      >
        정의로 이동
      </Button>
    </Stack>
  );
}

export function SampleHighlighter({ text, interactive = false, availableTypes, sampleDefs }: SampleHighlighterProps) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const regex = useMemo(() => buildSamplePattern(availableTypes), [availableTypes]);
  const pattern = new RegExp(regex.source, 'g');
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const sampleType = match[1];
    const fullMatch = match[0];
    const sampleId = fullMatch.split(/[;|]/)[0];
    const color = SAMPLE_COLORS[sampleType] || DEFAULT_CUSTOM_COLOR;

    const spanStyle: React.CSSProperties = {
      color,
      fontWeight: 600,
      backgroundColor: `${color}15`,
      padding: '0 2px',
      borderRadius: '2px',
      ...(interactive ? { pointerEvents: 'auto' as const } : {}),
    };

    const span = (
      <span key={match.index} style={spanStyle}>
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
  return buildSamplePattern(availableTypes).test(text);
}
