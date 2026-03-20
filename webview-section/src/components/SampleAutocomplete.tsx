import { useState, useEffect, useCallback, useRef } from 'react';
import { Paper, Text, Stack, Group, Badge, UnstyledButton, Loader, ScrollArea } from '@mantine/core';
import type { SampleItem } from '../types';
import { postMessage } from '../vscodeApi';

const SAMPLE_TYPES = ['DNA', 'RNA', 'Plasmid', 'Reagent', 'Primer', 'Protein', 'Equip', 'Labware'] as const;

const SAMPLE_COLORS: Record<string, string> = {
  DNA: '#e74c3c',
  RNA: '#3498db',
  Plasmid: '#9b59b6',
  Reagent: '#f39c12',
  Primer: '#c0392b',
  Protein: '#e67e22',
  Equip: '#95a5a6',
  Labware: '#7f8c8d',
};

interface SampleAutocompleteProps {
  position: { top: number; left: number };
  onSelect: (text: string) => void;
  onClose: () => void;
}

type Stage = 'type-select' | 'sample-list';

export function SampleAutocomplete({ position, onSelect, onClose }: SampleAutocompleteProps) {
  const [stage, setStage] = useState<Stage>('type-select');
  const [selectedType, setSelectedType] = useState<string>('');
  const [samples, setSamples] = useState<SampleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'samplesLoaded' && msg.data?.sampleType === selectedType) {
        setSamples(msg.data.samples || []);
        setLoading(false);
      }
      if (msg.type === 'sampleIdGenerated' && msg.data?.type === selectedType) {
        onSelect(msg.data.id);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [selectedType, onSelect]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleTypeSelect = useCallback((type: string) => {
    setSelectedType(type);
    setStage('sample-list');
    setLoading(true);
    postMessage({ type: 'requestSamples', data: { sampleType: type } });
  }, []);

  const handleSampleSelect = useCallback((sample: SampleItem) => {
    const text = sample.alias ? `${sample.id}|${sample.alias}` : sample.id;
    onSelect(text);
  }, [onSelect]);

  const handleNewId = useCallback(() => {
    postMessage({ type: 'generateSampleId', data: { type: selectedType } });
  }, [selectedType]);

  const filteredSamples = filter
    ? samples.filter(s =>
        s.id.toLowerCase().includes(filter.toLowerCase()) ||
        (s.alias && s.alias.toLowerCase().includes(filter.toLowerCase()))
      )
    : samples;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        zIndex: 1000,
        minWidth: 240,
        maxWidth: 360,
      }}
    >
      <Paper shadow="md" p="xs" withBorder>
        {stage === 'type-select' && (
          <Stack gap={4}>
            <Text size="xs" fw={600} c="dimmed" mb={4}>샘플 타입 선택</Text>
            {SAMPLE_TYPES.map(type => (
              <UnstyledButton
                key={type}
                onClick={() => handleTypeSelect(type)}
                style={{ padding: '4px 8px', borderRadius: 4 }}
                className="sample-type-btn"
              >
                <Group gap="xs">
                  <Badge size="xs" color={SAMPLE_COLORS[type] ? undefined : 'gray'} variant="light"
                    styles={{ root: { backgroundColor: `${SAMPLE_COLORS[type]}20`, color: SAMPLE_COLORS[type] } }}
                  >
                    {type}
                  </Badge>
                  <Text size="sm">{type}</Text>
                </Group>
              </UnstyledButton>
            ))}
          </Stack>
        )}

        {stage === 'sample-list' && (
          <Stack gap={4}>
            <Group gap="xs" justify="space-between">
              <Text size="xs" fw={600} c="dimmed">
                {selectedType} 샘플
              </Text>
              <UnstyledButton onClick={() => { setStage('type-select'); setFilter(''); }}>
                <Text size="xs" c="blue">← 돌아가기</Text>
              </UnstyledButton>
            </Group>

            <input
              type="text"
              placeholder="검색..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              autoFocus
              style={{
                border: '1px solid var(--mantine-color-default-border)',
                borderRadius: 4,
                padding: '4px 8px',
                fontSize: '13px',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
              }}
            />

            {loading ? (
              <Group justify="center" p="sm"><Loader size="sm" /></Group>
            ) : (
              <ScrollArea.Autosize mah={200}>
                <Stack gap={2}>
                  <UnstyledButton
                    onClick={handleNewId}
                    style={{ padding: '4px 8px', borderRadius: 4 }}
                    className="sample-type-btn"
                  >
                    <Text size="sm" fw={600} c="blue">+ 새 {selectedType} ID 생성</Text>
                  </UnstyledButton>

                  {filteredSamples.map(sample => (
                    <UnstyledButton
                      key={sample.id}
                      onClick={() => handleSampleSelect(sample)}
                      style={{ padding: '4px 8px', borderRadius: 4 }}
                      className="sample-type-btn"
                    >
                      <Group gap="xs">
                        <Text size="sm" ff="monospace">{sample.id}</Text>
                        {sample.alias && <Text size="xs" c="dimmed">| {sample.alias}</Text>}
                      </Group>
                    </UnstyledButton>
                  ))}

                  {!loading && filteredSamples.length === 0 && (
                    <Text size="xs" c="dimmed" p="xs">등록된 샘플이 없습니다</Text>
                  )}
                </Stack>
              </ScrollArea.Autosize>
            )}
          </Stack>
        )}
      </Paper>
    </div>
  );
}
