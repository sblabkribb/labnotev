import { useState } from 'react';
import { Modal, NumberInput, Group, Button, Stack, Text } from '@mantine/core';
import { generateTableTemplate } from '../utils/markdownTable';

interface TableInsertModalProps {
  opened: boolean;
  onClose: () => void;
  onInsert: (tableMarkdown: string) => void;
}

export function TableInsertModal({ opened, onClose, onInsert }: TableInsertModalProps) {
  const [rows, setRows] = useState<number>(3);
  const [cols, setCols] = useState<number>(3);

  const handleInsert = () => {
    const table = generateTableTemplate(Math.max(1, rows), Math.max(1, cols));
    onInsert(table);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInsert();
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Insert table"
      size="xs"
      centered
    >
      <Stack gap="sm" onKeyDown={handleKeyDown}>
        <NumberInput
          label="Columns"
          value={cols}
          onChange={(v) => setCols(typeof v === 'number' ? v : 3)}
          min={1}
          max={20}
        />
        <NumberInput
          label="Data rows"
          value={rows}
          onChange={(v) => setRows(typeof v === 'number' ? v : 3)}
          min={1}
          max={50}
        />
        <Text size="xs" c="dimmed">
          The header row and separator are added automatically.
        </Text>
        <Group justify="flex-end" mt="xs">
          <Button variant="default" size="xs" onClick={onClose}>Cancel</Button>
          <Button size="xs" onClick={handleInsert}>Insert</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
