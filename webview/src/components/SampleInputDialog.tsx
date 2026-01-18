import React, { useState, useEffect } from 'react';
import { Modal, TextInput, Button, Group, Stack, Text, Badge } from '@mantine/core';

export interface SampleInputResult {
  alias: string | null;
  description: string | null;
  skipSave?: boolean;
}

export interface SampleInputDialogProps {
  isOpen: boolean;
  sampleType: string;
  sampleId: string;
  onConfirm: (result: SampleInputResult) => void;
  onCancel: () => void;
}

export const SampleInputDialog: React.FC<SampleInputDialogProps> = ({
  isOpen,
  sampleType,
  sampleId,
  onConfirm,
  onCancel,
}) => {
  const [alias, setAlias] = useState('');
  const [description, setDescription] = useState('');

  // Reset fields when dialog opens with new sample
  useEffect(() => {
    if (isOpen) {
      setAlias('');
      setDescription('');
    }
  }, [isOpen, sampleId]);

  const handleConfirm = () => {
    onConfirm({
      alias: alias.trim() || null,
      description: description.trim() || null,
    });
  };

  const handleSkip = () => {
    onConfirm({
      alias: null,
      description: null,
      skipSave: true,
    });
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onCancel}
      title="샘플 정보 입력"
      centered
      size="md"
    >
      <Stack gap="md">
        <Group gap="sm">
          <Badge color="blue" variant="light" size="lg">
            {sampleType}
          </Badge>
          <Text size="sm" c="dimmed">
            {sampleId}
          </Text>
        </Group>

        <TextInput
          label="별칭"
          placeholder="샘플 별칭을 입력하세요 (선택사항)"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
        />

        <TextInput
          label="설명"
          placeholder="샘플에 대한 설명을 입력하세요 (선택사항)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <Group justify="space-between" mt="md">
          <Button variant="subtle" color="gray" onClick={handleSkip}>
            ID만 삽입
          </Button>
          <Group>
            <Button variant="outline" onClick={onCancel}>
              취소
            </Button>
            <Button onClick={handleConfirm}>
              확인
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
};
