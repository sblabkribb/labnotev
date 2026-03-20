import { Checkbox, Stack, Group, Text, Paper, Title } from '@mantine/core';
import type { WorkflowReference } from '../types';

interface WorkflowChecklistProps {
  items: WorkflowReference[];
  onChange: (items: WorkflowReference[]) => void;
}

export function WorkflowChecklist({ items, onChange }: WorkflowChecklistProps) {
  const toggleItem = (index: number) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, checked: !item.checked } : item
    );
    onChange(updated);
  };

  return (
    <Paper p="sm" withBorder>
      <Stack gap="xs">
        <Title order={3}>🗂️ Related Workflows</Title>
        {items.length === 0 && (
          <Text c="dimmed" size="sm">워크플로가 없습니다. F1 → "Add Workflow" 명령으로 추가하세요.</Text>
        )}
        {items.map((item, index) => (
          <Group key={index} gap="xs">
            <Checkbox
              checked={item.checked}
              onChange={() => toggleItem(index)}
              label={item.title}
            />
            <Text size="xs" c="dimmed">({item.link})</Text>
          </Group>
        ))}
      </Stack>
    </Paper>
  );
}
