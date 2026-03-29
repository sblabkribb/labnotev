import { useRef, useEffect, useState } from 'react';
import { Accordion, Badge, Group, Text, Stack, TextInput, Title, Paper, ActionIcon, Tooltip } from '@mantine/core';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { UnitOperationBlock } from '../types';
import { ImageThumbnails } from './ImageThumbnails';
import { SampleHighlighter, highlightSampleIds } from './SampleHighlighter';
import { DateTimeField } from './DateTimeField';
import { TableInsertModal } from './TableInsertModal';
import { SampleCreateModal } from './SampleCreateModal';
import { useTableEditing } from '../hooks/useTableEditing';

function parseMetaContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const match = line.match(/^-\s*(\w+):\s*'?([^']*)'?$/);
    if (match) result[match[1]] = match[2].trim();
  }
  return result;
}

function serializeMetaContent(fields: Record<string, string>): string {
  return Object.entries(fields)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `- ${k}: '${v}'`)
    .join('\n');
}

const SECTION_HAS_SAMPLES: Record<string, boolean> = {
  'Input': true,
  'Reagent': true,
  'Consumables': true,
  'Equipment': true,
};

interface UnitOpAccordionProps {
  unitOperations: UnitOperationBlock[];
  onChange: (unitOperations: UnitOperationBlock[]) => void;
  onSectionFocus?: (opIndex: number, secIndex: number) => void;
  onCursorActivity?: (pos: number) => void;
  onCreateSample?: (opIndex: number, secIndex: number, sampleType: string, alias: string, description: string) => void;
  onSearchProducts?: (sampleType: string) => void;
  productSearchResult?: { alias: string; description: string } | null;
  availableTypes?: string[];
  onAddCustomType?: (typeName: string) => void;
  docBaseUri?: string;
  getCursorForSection?: (opIndex: number, secIndex: number) => { pos: number; tick: number } | null | undefined;
}

function GripIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.5 }}>
      <circle cx="5" cy="3" r="1.5" />
      <circle cx="11" cy="3" r="1.5" />
      <circle cx="5" cy="8" r="1.5" />
      <circle cx="11" cy="8" r="1.5" />
      <circle cx="5" cy="13" r="1.5" />
      <circle cx="11" cy="13" r="1.5" />
    </svg>
  );
}

interface UnitOpSectionTextareaProps {
  heading: string;
  content: string;
  showSampleButton?: boolean;
  onChange: (content: string) => void;
  onFocus?: () => void;
  onCursorActivity?: (pos: number) => void;
  onCreateSample?: (sampleType: string, alias: string, description: string) => void;
  onSearchProducts?: (sampleType: string) => void;
  productSearchResult?: { alias: string; description: string } | null;
  availableTypes?: string[];
  onAddCustomType?: (typeName: string) => void;
  docBaseUri?: string;
  requestFocusAt?: { pos: number; tick: number } | null;
}

function UnitOpSectionTextarea({
  heading, content, showSampleButton, onChange, onFocus, onCursorActivity,
  onCreateSample, onSearchProducts, productSearchResult, availableTypes, onAddCustomType, docBaseUri,
  requestFocusAt,
}: UnitOpSectionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [sampleModalOpen, setSampleModalOpen] = useState(false);
  const [hasSamples, setHasSamples] = useState(false);

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

  useEffect(() => {
    if (!requestFocusAt) return;
    const ta = textareaRef.current;
    if (!ta) return;
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = requestFocusAt.pos;
      reportCursor();
    });
  }, [requestFocusAt?.tick]);

  useEffect(() => {
    setHasSamples(highlightSampleIds(content, availableTypes));
  }, [content, availableTypes]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }, [content]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const resize = () => {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    };
    const observer = new ResizeObserver(resize);
    observer.observe(ta);
    return () => observer.disconnect();
  }, []);

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
    resize: 'none',
    overflow: 'hidden',
    minHeight: `${2 * 1.55 * 13 + 16}px`,
    background: hasSamples ? 'transparent' : 'var(--mantine-color-body)',
    color: hasSamples ? 'transparent' : 'var(--mantine-color-text)',
    caretColor: 'var(--mantine-color-text)',
    position: hasSamples ? 'relative' : undefined,
    zIndex: hasSamples ? 2 : undefined,
  };

  const overlayStyle: React.CSSProperties = {
    fontFamily: 'monospace',
    fontSize: '13px',
    lineHeight: '1.55',
    padding: '8px',
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    pointerEvents: 'none',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    overflow: 'hidden',
    zIndex: 1,
    color: 'var(--mantine-color-text)',
  };

  return (
    <div>
      <Group gap="xs" mb={4} justify="space-between">
        <Title order={5}>{heading}</Title>
        <Group gap={4}>
          {showSampleButton && onCreateSample && (
            <Tooltip label="샘플 추가" position="bottom" withArrow>
              <ActionIcon variant="subtle" size="xs" onClick={() => setSampleModalOpen(true)} aria-label="샘플 추가">
                <SampleIcon />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label="테이블 삽입" position="bottom" withArrow>
            <ActionIcon variant="subtle" size="xs" onClick={() => setTableModalOpen(true)} aria-label="테이블 삽입">
              <TableIcon />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="테이블 정렬" position="bottom" withArrow>
            <ActionIcon variant="subtle" size="xs" onClick={handleAlignTable} disabled={!cursorInTable} aria-label="테이블 정렬">
              <AlignIcon />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <div style={{ position: 'relative' }}>
        {hasSamples && (
          <div ref={overlayRef} style={overlayStyle}>
            <SampleHighlighter text={content} interactive availableTypes={availableTypes} />
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => { onChange(e.currentTarget.value); reportCursor(); }}
          onFocus={() => { onFocus?.(); reportCursor(); }}
          onClick={reportCursor}
          onKeyUp={reportCursor}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onScroll={syncScroll}
          style={textareaStyle}
        />
      </div>
      {docBaseUri && <ImageThumbnails content={content} docBaseUri={docBaseUri} />}
      <TableInsertModal
        opened={tableModalOpen}
        onClose={() => setTableModalOpen(false)}
        onInsert={handleTableInsert}
      />
      {showSampleButton && onCreateSample && (
        <SampleCreateModal
          opened={sampleModalOpen}
          onClose={() => setSampleModalOpen(false)}
          onSubmit={onCreateSample}
          onSearchProducts={onSearchProducts}
          productSearchResult={productSearchResult}
          availableTypes={availableTypes ?? []}
          onAddCustomType={onAddCustomType}
        />
      )}
    </div>
  );
}

function SampleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2v5l-3 5.5a1 1 0 00.9 1.5h8.2a1 1 0 00.9-1.5L10 7V2" />
      <line x1="5" y1="2" x2="11" y2="2" />
      <line x1="5" y1="9" x2="11" y2="9" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
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
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="4" x2="14" y2="4" />
      <line x1="2" y1="8" x2="14" y2="8" />
      <line x1="2" y1="12" x2="10" y2="12" />
    </svg>
  );
}

interface SortableUnitOpProps {
  op: UnitOperationBlock;
  opIndex: number;
  onUpdateSection: (opIndex: number, secIndex: number, content: string) => void;
  onUpdateAlias: (opIndex: number, alias: string) => void;
  onSectionFocus?: (opIndex: number, secIndex: number) => void;
  onCursorActivity?: (pos: number) => void;
  onCreateSample?: (opIndex: number, secIndex: number, sampleType: string, alias: string, description: string) => void;
  onSearchProducts?: (sampleType: string) => void;
  productSearchResult?: { alias: string; description: string } | null;
  availableTypes?: string[];
  onAddCustomType?: (typeName: string) => void;
  docBaseUri?: string;
  getCursorForSection?: (opIndex: number, secIndex: number) => { pos: number; tick: number } | null | undefined;
}

function SortableUnitOp({ op, opIndex, onUpdateSection, onUpdateAlias, onSectionFocus, onCursorActivity, onCreateSample, onSearchProducts, productSearchResult, availableTypes, onAddCustomType, docBaseUri, getCursorForSection }: SortableUnitOpProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: op.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Accordion.Item value={op.id}>
        <Accordion.Control>
          <Group gap="sm" wrap="nowrap">
            <ActionIcon
              variant="subtle"
              size="sm"
              color="gray"
              style={{ cursor: 'grab', touchAction: 'none' }}
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
            >
              <GripIcon />
            </ActionIcon>
            <Badge
              color={op.opType === 'hw' ? 'blue' : 'green'}
              variant="light"
              size="sm"
            >
              {op.opType.toUpperCase()}
            </Badge>
            <Text fw={600}>[{op.opId} {op.opName}]</Text>
            <TextInput
              size="xs"
              variant="unstyled"
              placeholder="Add a short description here"
              value={op.alias ?? ''}
              onChange={(e) => onUpdateAlias(opIndex, e.currentTarget.value)}
              onClick={(e) => e.stopPropagation()}
              styles={{ input: { fontSize: '13px', color: op.alias ? 'var(--mantine-color-text)' : 'var(--mantine-color-dimmed)' } }}
              style={{ flex: 1 }}
            />
          </Group>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap="xs">
            {op.opDescription && (
              <Text size="sm" c="dimmed" fs="italic">{op.opDescription}</Text>
            )}
            {op.sections.map((section, secIndex) => {
              if (section.heading === 'Meta') {
                const metaFields = parseMetaContent(section.content);
                const updateMetaField = (key: string, value: string) => {
                  const updated = { ...metaFields, [key]: value };
                  onUpdateSection(opIndex, secIndex, serializeMetaContent(updated));
                };
                return (
                  <div key={secIndex}>
                    <Title order={5} mb={4}>Meta</Title>
                    <Stack gap="xs">
                      <TextInput
                        label="Experimenter"
                        size="sm"
                        value={metaFields['Experimenter'] ?? ''}
                        onChange={(e) => updateMetaField('Experimenter', e.currentTarget.value)}
                      />
                      <DateTimeField
                        label="Start Date"
                        size="sm"
                        value={metaFields['Start_date'] ?? ''}
                        onChange={(v) => updateMetaField('Start_date', v)}
                      />
                      <DateTimeField
                        label="End Date"
                        size="sm"
                        value={metaFields['End_date'] ?? ''}
                        onChange={(v) => updateMetaField('End_date', v)}
                      />
                      {op.opType === 'sw' && metaFields['Software'] !== undefined && (
                        <TextInput
                          label="Software"
                          size="sm"
                          value={metaFields['Software'] ?? ''}
                          onChange={(e) => updateMetaField('Software', e.currentTarget.value)}
                        />
                      )}
                    </Stack>
                  </div>
                );
              }

              const hasSamples = SECTION_HAS_SAMPLES[section.heading] ?? false;
              return (
                <UnitOpSectionTextarea
                  key={secIndex}
                  heading={section.heading}
                  content={section.content}
                  showSampleButton={hasSamples}
                  onChange={(c) => onUpdateSection(opIndex, secIndex, c)}
                  onFocus={() => onSectionFocus?.(opIndex, secIndex)}
                  onCursorActivity={onCursorActivity}
                  onCreateSample={onCreateSample ? (type: string, alias: string, desc: string) => onCreateSample(opIndex, secIndex, type, alias, desc) : undefined}
                  onSearchProducts={onSearchProducts}
                  productSearchResult={productSearchResult}
                  availableTypes={availableTypes}
                  onAddCustomType={onAddCustomType}
                  docBaseUri={docBaseUri}
                  requestFocusAt={getCursorForSection?.(opIndex, secIndex)}
                />
              );
            })}
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </div>
  );
}

export function UnitOpAccordion({ unitOperations, onChange, onSectionFocus, onCursorActivity, onCreateSample, onSearchProducts, productSearchResult, availableTypes, onAddCustomType, docBaseUri, getCursorForSection }: UnitOpAccordionProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const updateSection = (opIndex: number, secIndex: number, content: string) => {
    const updated = unitOperations.map((op, oi) => {
      if (oi !== opIndex) return op;
      return {
        ...op,
        sections: op.sections.map((sec, si) =>
          si === secIndex ? { ...sec, content } : sec
        ),
      };
    });
    onChange(updated);
  };

  const updateAlias = (opIndex: number, alias: string) => {
    const updated = unitOperations.map((op, oi) => {
      if (oi !== opIndex) return op;
      return { ...op, alias: alias || undefined };
    });
    onChange(updated);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = unitOperations.findIndex(op => op.id === active.id);
    const newIndex = unitOperations.findIndex(op => op.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(unitOperations, oldIndex, newIndex));
  };

  if (unitOperations.length === 0) {
    return (
      <Paper p="sm" withBorder>
        <Text c="dimmed" size="sm">
          유닛 오퍼레이션이 없습니다. TreeView에서 추가하세요.
        </Text>
      </Paper>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={unitOperations.map(op => op.id)} strategy={verticalListSortingStrategy}>
        <Accordion variant="separated">
          {unitOperations.map((op, opIndex) => (
            <SortableUnitOp
              key={op.id}
              op={op}
              opIndex={opIndex}
              onUpdateSection={updateSection}
              onUpdateAlias={updateAlias}
              onSectionFocus={onSectionFocus}
              onCursorActivity={onCursorActivity}
              onCreateSample={onCreateSample}
              onSearchProducts={onSearchProducts}
              productSearchResult={productSearchResult}
              availableTypes={availableTypes}
              onAddCustomType={onAddCustomType}
              docBaseUri={docBaseUri}
              getCursorForSection={getCursorForSection}
            />
          ))}
        </Accordion>
      </SortableContext>
    </DndContext>
  );
}
