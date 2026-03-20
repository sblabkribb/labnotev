import { Accordion, Badge, Group, Text, Stack, Textarea, TextInput, Title, Paper, ActionIcon } from '@mantine/core';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { UnitOperationBlock } from '../types';

interface UnitOpAccordionProps {
  unitOperations: UnitOperationBlock[];
  onChange: (unitOperations: UnitOperationBlock[]) => void;
  onSectionFocus?: (opIndex: number, secIndex: number) => void;
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

interface SortableUnitOpProps {
  op: UnitOperationBlock;
  opIndex: number;
  onUpdateSection: (opIndex: number, secIndex: number, content: string) => void;
  onUpdateAlias: (opIndex: number, alias: string) => void;
  onSectionFocus?: (opIndex: number, secIndex: number) => void;
}

function SortableUnitOp({ op, opIndex, onUpdateSection, onUpdateAlias, onSectionFocus }: SortableUnitOpProps) {
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
          <Group gap="sm">
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
            {op.alias && <Text size="sm" c="dimmed">{op.alias}</Text>}
          </Group>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap="xs">
            <TextInput
              label="별칭 (Alias)"
              placeholder="실험 단계의 간단한 이름 (예: 단백질 정제 1단계)"
              value={op.alias ?? ''}
              onChange={(e) => onUpdateAlias(opIndex, e.currentTarget.value)}
              size="sm"
            />
            {op.opDescription && (
              <Text size="sm" c="dimmed" fs="italic">{op.opDescription}</Text>
            )}
            {op.sections.map((section, secIndex) => (
              <div key={secIndex}>
                <Title order={5}>{section.heading}</Title>
                <Textarea
                  value={section.content}
                  onChange={(e) => onUpdateSection(opIndex, secIndex, e.currentTarget.value)}
                  onFocus={() => onSectionFocus?.(opIndex, secIndex)}
                  autosize
                  minRows={2}
                  styles={{ input: { fontFamily: 'monospace', fontSize: '13px' } }}
                />
              </div>
            ))}
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </div>
  );
}

export function UnitOpAccordion({ unitOperations, onChange, onSectionFocus }: UnitOpAccordionProps) {
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
            />
          ))}
        </Accordion>
      </SortableContext>
    </DndContext>
  );
}
