import { memo } from 'react';
import { Checkbox, Stack, Group, Text, Paper, Title, Anchor, ActionIcon, Tooltip } from '@mantine/core';
import type { WorkflowReference } from '../types';
import { postMessage } from '../vscodeApi';

interface WorkflowChecklistProps {
  items: WorkflowReference[];
  onChange: (items: WorkflowReference[]) => void;
}

/**
 * Return a new array with the item at `index` swapped with its neighbour in the
 * given direction. Out-of-range moves (first item up / last item down) return a
 * shallow copy with the original order. Does not mutate the input.
 */
export function moveWorkflowItem(
  items: WorkflowReference[],
  index: number,
  dir: 'up' | 'down'
): WorkflowReference[] {
  const target = dir === 'up' ? index - 1 : index + 1;
  const next = [...items];
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export const WorkflowChecklist = memo(function WorkflowChecklist({ items, onChange }: WorkflowChecklistProps) {
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
          <Group key={`${item.link}-${index}`} gap="xs" wrap="nowrap">
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
            <Group gap={2} ml="auto" wrap="nowrap">
              <Tooltip label="Move up" position="top" withArrow>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="gray"
                  aria-label="Move workflow up"
                  disabled={index === 0}
                  onClick={() => onChange(moveWorkflowItem(items, index, 'up'))}
                >
                  <ChevronUpIcon />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Move down" position="top" withArrow>
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  color="gray"
                  aria-label="Move workflow down"
                  disabled={index === items.length - 1}
                  onClick={() => onChange(moveWorkflowItem(items, index, 'down'))}
                >
                  <ChevronDownIcon />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        ))}
      </Stack>
    </Paper>
  );
});

function ChevronUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M4 10l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
