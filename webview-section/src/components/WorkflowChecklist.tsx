import { Checkbox, Stack, Group, Text, Paper, Title, Anchor } from '@mantine/core';
import type { WorkflowReference } from '../types';
import { postMessage } from '../vscodeApi';

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

  const handleOpenWorkflow = (link: string) => {
    postMessage({ type: 'openWorkflow', data: { link } });
  };

  return (
    <Paper p="sm" withBorder>
      <Stack gap="xs">
        <Title order={3}>🗂️ Related Workflows</Title>
        {items.length === 0 && (
          <Text c="dimmed" size="sm">No workflows yet. Use F1 → "Add Workflow" or pick one from the TreeView menu.</Text>
        )}
        {items.map((item, index) => (
          <Group key={index} gap="xs">
            <Checkbox
              checked={item.checked}
              onChange={() => toggleItem(index)}
            />
            <Anchor
              size="sm"
              onClick={() => handleOpenWorkflow(item.link)}
              style={{ cursor: 'pointer' }}
            >
              {item.title}
            </Anchor>
            <Text size="xs" c="dimmed">({item.link})</Text>
          </Group>
        ))}
      </Stack>
    </Paper>
  );
}
