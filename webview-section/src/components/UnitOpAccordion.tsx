import { useRef, useState } from 'react';
import { Accordion, Badge, Group, Text, Stack, TextInput, Textarea, Title, Paper, ActionIcon, Tooltip, Menu, Modal, Button } from '@mantine/core';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { UnitOperationBlock, SampleDefMap } from '../types';
import { ImageThumbnails } from './ImageThumbnails';
import { AttachmentLinks } from './AttachmentLinks';
import { HighlightedTextarea } from './HighlightedTextarea';
import { DateTimeField } from './DateTimeField';
import { TableInsertModal } from './TableInsertModal';
import { SampleCreateModal } from './SampleCreateModal';
import { useTableEditing } from '../hooks/useTableEditing';
import { normalizeUnitOpSectionHeading, unitOpSectionAllowsSampleButton, getSectionTypeLock } from '../utils/unitOpSectionHeading';

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

interface UnitOpAccordionProps {
  unitOperations: UnitOperationBlock[];
  onChange: (unitOperations: UnitOperationBlock[]) => void;
  onSectionFocus?: (opIndex: number, secIndex: number, opId: string, secHeading: string) => void;
  onCursorActivity?: (pos: number) => void;
  onCreateSample?: (opIndex: number, secIndex: number, sampleType: string, alias: string, description: string) => void;
  onSearchProducts?: (sampleType: string) => void;
  productSearchResult?: { alias: string; description: string } | null;
  availableTypes?: string[];
  sampleTypeColors?: Record<string, string>;
  sampleDefs?: SampleDefMap;
  onAddCustomType?: (typeName: string) => void;
  docBaseUri?: string;
  getCursorForSection?: (opIndex: number, secIndex: number) => { pos: number; tick: number; scroll?: 'none' | 'nearest' | 'center' } | null | undefined;
  onAttachFile?: (opIndex: number, secIndex: number) => void;
  /** Controlled list of currently-opened Accordion item IDs (op.id values).
   * When omitted, the Accordion falls back to its internal uncontrolled
   * state so existing callers keep working unchanged. */
  openedOpIds?: string[];
  onOpenedChange?: (ids: string[]) => void;
  /** Copy the UnitOp at `opIndex` to the system clipboard. */
  onCopy?: (opIndex: number) => void;
  /** Request a Paste below the UnitOp at `opIndex`. Use `-1` to paste at the start. */
  onPasteBelow?: (opIndex: number) => void;
  /** Whether the system clipboard currently holds a valid labnotev UnitOp
   *  envelope. When `false`, Paste below items and the empty-state Paste
   *  button render as `disabled`. */
  clipboardHasUnitOp?: boolean;
  /** Fired whenever the actions Menu opens, so callers can refresh
   *  `clipboardHasUnitOp` (the system clipboard has no change event). */
  onMenuOpen?: () => void;
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
  sampleTypeColors?: Record<string, string>;
  sampleDefs?: SampleDefMap;
  onAddCustomType?: (typeName: string) => void;
  docBaseUri?: string;
  requestFocusAt?: { pos: number; tick: number; scroll?: 'none' | 'nearest' | 'center' } | null;
  onAttachFile?: () => void;
  minRows?: number;
}

function UnitOpSectionTextarea({
  heading, content, showSampleButton, onChange, onFocus, onCursorActivity,
  onCreateSample, onSearchProducts, productSearchResult, availableTypes, sampleTypeColors, sampleDefs, onAddCustomType, docBaseUri,
  requestFocusAt,
  onAttachFile,
  minRows = 2,
}: UnitOpSectionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [sampleModalOpen, setSampleModalOpen] = useState(false);

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

  return (
    <div>
      <Group gap="xs" mb={4} justify="space-between">
        <Title order={5}>{heading}</Title>
        <Group gap={4}>
          {showSampleButton && onCreateSample && (
            <Tooltip label="Add sample" position="bottom" withArrow>
              <ActionIcon
                variant="subtle"
                size="xs"
                onClick={() => {
                  // Sync activeSectionRef/cursorPos to this textarea BEFORE the
                  // modal opens so `sampleDefinitionCreated` can splice at the
                  // caret the user currently sees. Without this, clicking the
                  // +Sample button in section B while the caret was last in
                  // section A would apply A's caret offset to B.
                  const ta = textareaRef.current;
                  if (ta) {
                    ta.focus({ preventScroll: true });
                    onFocus?.();
                    onCursorActivity?.(ta.selectionStart);
                  }
                  setSampleModalOpen(true);
                }}
                aria-label="Add sample"
              >
                <SampleIcon />
              </ActionIcon>
            </Tooltip>
          )}
          {onAttachFile && (
            <Tooltip label="Attach file" position="bottom" withArrow>
              <ActionIcon variant="subtle" size="xs" onClick={onAttachFile} aria-label="Attach file">
                <AttachIcon />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label="Insert table" position="bottom" withArrow>
            <ActionIcon variant="subtle" size="xs" onClick={() => setTableModalOpen(true)} aria-label="Insert table">
              <TableIcon />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Align table" position="bottom" withArrow>
            <ActionIcon variant="subtle" size="xs" onClick={handleAlignTable} disabled={!cursorInTable} aria-label="Align table">
              <AlignIcon />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <HighlightedTextarea
        ref={textareaRef}
        value={content}
        onChange={onChange}
        onFocus={onFocus}
        onCursorChange={onCursorActivity}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        minRows={minRows}
        availableTypes={availableTypes}
        sampleTypeColors={sampleTypeColors}
        sampleDefs={sampleDefs}
        requestFocusAt={requestFocusAt}
      />
      {docBaseUri && <ImageThumbnails content={content} docBaseUri={docBaseUri} />}
      <AttachmentLinks content={content} />
      <TableInsertModal
        opened={tableModalOpen}
        onClose={() => setTableModalOpen(false)}
        onInsert={handleTableInsert}
      />
      {showSampleButton && onCreateSample && (() => {
        // `heading` is already the normalized displayHeading from
        // `normalizeUnitOpSectionHeading`, so the lookup directly returns the
        // built-in type (or undefined for Input/Output → free choice).
        const lockType = getSectionTypeLock(heading);
        return (
          <SampleCreateModal
            opened={sampleModalOpen}
            onClose={() => setSampleModalOpen(false)}
            onSubmit={onCreateSample}
            onSearchProducts={onSearchProducts}
            productSearchResult={productSearchResult}
            availableTypes={availableTypes ?? []}
            onAddCustomType={onAddCustomType}
            defaultType={lockType}
            lockedType={!!lockType}
          />
        );
      })()}
    </div>
  );
}

function AttachIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 4.5L4.5 9.5a2 2 0 102.8 2.8l5.8-5.8a2.5 2.5 0 00-3.5-3.5L3.8 8.3" />
    </svg>
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

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="8" cy="3" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="8" cy="13" r="1.5" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="9" height="9" rx="1" />
      <path d="M2 11V3a1 1 0 011-1h8" />
    </svg>
  );
}

function PasteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2.5h6M5 2.5a1 1 0 00-1 1V4H3a1 1 0 00-1 1v9a1 1 0 001 1h10a1 1 0 001-1V5a1 1 0 00-1-1h-1v-.5a1 1 0 00-1-1" />
      <rect x="5" y="1.5" width="6" height="2" rx="0.5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4h10" />
      <path d="M5.5 4V3a1 1 0 011-1h3a1 1 0 011 1v1" />
      <path d="M4.5 4l.6 9a1 1 0 001 .9h3.8a1 1 0 001-.9l.6-9" />
      <path d="M7 7v4M9 7v4" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,10 8,5 13,10" />
    </svg>
  );
}

interface SortableUnitOpProps {
  op: UnitOperationBlock;
  opIndex: number;
  onUpdateSection: (opIndex: number, secIndex: number, content: string) => void;
  onUpdateAlias: (opIndex: number, alias: string) => void;
  onUpdateDescription?: (opIndex: number, opDescription: string) => void;
  onSectionFocus?: (opIndex: number, secIndex: number, opId: string, secHeading: string) => void;
  onCursorActivity?: (pos: number) => void;
  onCreateSample?: (opIndex: number, secIndex: number, sampleType: string, alias: string, description: string) => void;
  onSearchProducts?: (sampleType: string) => void;
  productSearchResult?: { alias: string; description: string } | null;
  availableTypes?: string[];
  sampleTypeColors?: Record<string, string>;
  sampleDefs?: SampleDefMap;
  onAddCustomType?: (typeName: string) => void;
  docBaseUri?: string;
  getCursorForSection?: (opIndex: number, secIndex: number) => { pos: number; tick: number; scroll?: 'none' | 'nearest' | 'center' } | null | undefined;
  onAttachFile?: (opIndex: number, secIndex: number) => void;
  onCopy?: (opIndex: number) => void;
  onPasteBelow?: (opIndex: number) => void;
  onDelete: (opIndex: number) => void;
  /** Collapse this UnitOp (only effective in controlled mode). */
  onCollapse?: (opIndex: number) => void;
  clipboardHasUnitOp?: boolean;
  onMenuOpen?: () => void;
}

function SortableUnitOp({ op, opIndex, onUpdateSection, onUpdateAlias, onUpdateDescription, onSectionFocus, onCursorActivity, onCreateSample, onSearchProducts, productSearchResult, availableTypes, sampleTypeColors, sampleDefs, onAddCustomType, docBaseUri, getCursorForSection, onAttachFile, onCopy, onPasteBelow, onDelete, onCollapse, clipboardHasUnitOp, onMenuOpen }: SortableUnitOpProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: op.id });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const opLabel = op.alias ? `[${op.opId} ${op.opName}] ${op.alias}` : `[${op.opId} ${op.opName}]`;

  return (
    <div
      ref={(el) => { setNodeRef(el); wrapperRef.current = el; }}
      style={style}
    >
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
              placeholder="Add a short alias"
              value={op.alias ?? ''}
              onChange={(e) => onUpdateAlias(opIndex, e.currentTarget.value)}
              onClick={(e) => e.stopPropagation()}
              styles={{ input: { fontSize: '13px', color: op.alias ? 'var(--mantine-color-text)' : 'var(--mantine-color-dimmed)' } }}
              style={{ flex: 1 }}
            />
            <Menu
              position="bottom-end"
              shadow="md"
              withinPortal
              closeOnItemClick
              onChange={(opened) => { if (opened) onMenuOpen?.(); }}
            >
              <Menu.Target>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="gray"
                  aria-label="Unit Operation actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreIcon />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<CopyIcon />}
                  onClick={(e) => { e.stopPropagation(); onCopy?.(opIndex); }}
                >
                  Copy
                </Menu.Item>
                <Menu.Item
                  leftSection={<PasteIcon />}
                  disabled={!clipboardHasUnitOp}
                  onClick={(e) => { e.stopPropagation(); onPasteBelow?.(opIndex); }}
                >
                  Paste below
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  leftSection={<TrashIcon />}
                  onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
                >
                  Delete...
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap="xs">
            <Textarea
              size="xs"
              variant="unstyled"
              placeholder="Add description"
              value={op.opDescription ?? ''}
              onChange={(e) => onUpdateDescription?.(opIndex, e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.preventDefault(); }}
              autosize
              minRows={1}
              styles={{ input: { fontSize: '13px', fontStyle: 'italic', color: 'var(--mantine-color-dimmed)' } }}
            />
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

              const displayHeading = normalizeUnitOpSectionHeading(section.heading);
              const hasSamples = unitOpSectionAllowsSampleButton(section.heading);
              return (
                <UnitOpSectionTextarea
                  key={secIndex}
                  heading={displayHeading}
                  content={section.content}
                  showSampleButton={hasSamples}
                  onChange={(c) => onUpdateSection(opIndex, secIndex, c)}
                  onFocus={() => onSectionFocus?.(opIndex, secIndex, op.opId, section.heading)}
                  onCursorActivity={onCursorActivity}
                  onCreateSample={onCreateSample ? (type: string, alias: string, desc: string) => onCreateSample(opIndex, secIndex, type, alias, desc) : undefined}
                  onSearchProducts={onSearchProducts}
                  productSearchResult={productSearchResult}
                  availableTypes={availableTypes}
                  sampleTypeColors={sampleTypeColors}
                  sampleDefs={sampleDefs}
                  onAddCustomType={onAddCustomType}
                  docBaseUri={docBaseUri}
                  requestFocusAt={getCursorForSection?.(opIndex, secIndex)}
                  onAttachFile={onAttachFile ? () => onAttachFile(opIndex, secIndex) : undefined}
                />
              );
            })}
            <Group justify="flex-end" mt="xs">
              <Tooltip label="Collapse" position="top" withArrow>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="gray"
                  aria-label="Collapse unit operation"
                  onClick={() => {
                    onCollapse?.(opIndex);
                    requestAnimationFrame(() =>
                      requestAnimationFrame(() =>
                        wrapperRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
                      )
                    );
                  }}
                >
                  <ChevronUpIcon />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
      <Modal
        opened={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Delete Unit Operation?"
        size="sm"
        centered
      >
        <Stack gap="sm">
          <Text size="sm">{opLabel}</Text>
          <Text size="xs" c="dimmed">This action cannot be undone.</Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" size="xs" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              color="red"
              size="xs"
              onClick={() => {
                onDelete(opIndex);
                setConfirmOpen(false);
              }}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}

export function UnitOpAccordion({ unitOperations, onChange, onSectionFocus, onCursorActivity, onCreateSample, onSearchProducts, productSearchResult, availableTypes, sampleTypeColors, sampleDefs, onAddCustomType, docBaseUri, getCursorForSection, onAttachFile, openedOpIds, onOpenedChange, onCopy, onPasteBelow, clipboardHasUnitOp, onMenuOpen }: UnitOpAccordionProps) {
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

  const updateDescription = (opIndex: number, opDescription: string) => {
    const updated = unitOperations.map((op, oi) =>
      oi === opIndex ? { ...op, opDescription } : op
    );
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

  const deleteOp = (opIndex: number) => {
    onChange(unitOperations.filter((_, oi) => oi !== opIndex));
  };

  if (unitOperations.length === 0) {
    return (
      <Paper p="sm" withBorder>
        <Group justify="space-between" wrap="nowrap">
          <Text c="dimmed" size="sm">
            No unit operations yet. Add one from the TreeView.
          </Text>
          {onPasteBelow && (
            <Button
              size="xs"
              variant="light"
              disabled={!clipboardHasUnitOp}
              onClick={() => onPasteBelow(-1)}
            >
              Paste Unit Operation
            </Button>
          )}
        </Group>
      </Paper>
    );
  }

  // Fall back to uncontrolled behaviour when the caller doesn't provide
  // `openedOpIds` / `onOpenedChange`. This keeps older call sites working
  // while giving the Section Editor a way to programmatically expand the
  // target UnitOp from "Go to definition".
  const controlled = openedOpIds !== undefined;

  // Footer "Collapse" button: in controlled mode, drop this op.id from the
  // opened list so the Accordion closes. Uncontrolled callers fall through
  // (the panel's footer icon becomes a no-op for them).
  const handleCollapse = (opIndex: number) => {
    if (!controlled) return;
    const id = unitOperations[opIndex]?.id;
    if (!id) return;
    onOpenedChange?.((openedOpIds ?? []).filter((v) => v !== id));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={unitOperations.map(op => op.id)} strategy={verticalListSortingStrategy}>
        <Accordion
          multiple
          variant="separated"
          {...(controlled
            ? { value: openedOpIds ?? [], onChange: (v: string[]) => onOpenedChange?.(v) }
            : {})}
        >
          {unitOperations.map((op, opIndex) => (
            <SortableUnitOp
              key={op.id}
              op={op}
              opIndex={opIndex}
              onUpdateSection={updateSection}
              onUpdateAlias={updateAlias}
              onUpdateDescription={updateDescription}
              onSectionFocus={onSectionFocus}
              onCursorActivity={onCursorActivity}
              onCreateSample={onCreateSample}
              onSearchProducts={onSearchProducts}
              productSearchResult={productSearchResult}
              availableTypes={availableTypes}
              sampleTypeColors={sampleTypeColors}
              sampleDefs={sampleDefs}
              onAddCustomType={onAddCustomType}
              docBaseUri={docBaseUri}
              getCursorForSection={getCursorForSection}
              onAttachFile={onAttachFile}
              onCopy={onCopy}
              onPasteBelow={onPasteBelow}
              onDelete={deleteOp}
              onCollapse={handleCollapse}
              clipboardHasUnitOp={clipboardHasUnitOp}
              onMenuOpen={onMenuOpen}
            />
          ))}
        </Accordion>
      </SortableContext>
    </DndContext>
  );
}
