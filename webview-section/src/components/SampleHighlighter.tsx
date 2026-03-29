import React, { useMemo } from 'react';
import { Tooltip } from '@mantine/core';
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

function buildSamplePattern(availableTypes?: string[]): RegExp {
  const allTypes = new Set([...BUILTIN_TYPES, ...(availableTypes ?? [])]);
  const typeStr = [...allTypes].map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`\\b(${typeStr})-\\d+(?:[;|][^\\s;|]+)?`, 'g');
}

interface SampleHighlighterProps {
  text: string;
  interactive?: boolean;
  availableTypes?: string[];
}

function handleSampleClick(sampleId: string, sampleType: string) {
  postMessage({ type: 'navigateToSample', data: { sampleId, sampleType } });
}

export function SampleHighlighter({ text, interactive = false, availableTypes }: SampleHighlighterProps) {
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
      ...(interactive ? {
        pointerEvents: 'auto',
        cursor: 'pointer',
        textDecoration: 'underline',
        textDecorationStyle: 'dotted' as const,
      } : {}),
    };

    const span = (
      <span
        key={match.index}
        style={spanStyle}
        onClick={interactive ? (e) => {
          e.stopPropagation();
          handleSampleClick(sampleId, sampleType);
        } : undefined}
      >
        {fullMatch}
      </span>
    );

    if (interactive) {
      parts.push(
        <Tooltip key={`tip-${match.index}`} label={`${sampleType}: ${sampleId} — 클릭하여 정의로 이동`} withArrow>
          {span}
        </Tooltip>
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
