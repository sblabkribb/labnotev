import { useState, useEffect } from 'react';
import { Modal, Select, TextInput, Textarea, Group, Button, Stack } from '@mantine/core';

const BUILTIN_TYPES = ['DNA', 'RNA', 'Plasmid', 'Reagent', 'Primer', 'Protein', 'Equip', 'Labware'];
const NEW_TYPE_VALUE = '__new_type__';
const SEARCHABLE_TYPES = ['Reagent', 'Labware'];

interface SampleCreateModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (sampleType: string, alias: string, description: string) => void;
  onSearchProducts?: (sampleType: string) => void;
  productSearchResult?: { alias: string; description: string } | null;
  availableTypes: string[];
  onAddCustomType?: (typeName: string) => void;
  defaultType?: string;
}

export function SampleCreateModal({
  opened, onClose, onSubmit, onSearchProducts, productSearchResult,
  availableTypes, onAddCustomType, defaultType,
}: SampleCreateModalProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [alias, setAlias] = useState('');
  const [description, setDescription] = useState('');
  const [newTypeName, setNewTypeName] = useState('');
  const [addingNewType, setAddingNewType] = useState(false);

  useEffect(() => {
    if (opened) {
      setSelectedType(defaultType ?? null);
      setAlias('');
      setDescription('');
      setNewTypeName('');
      setAddingNewType(false);
    }
  }, [opened, defaultType]);

  useEffect(() => {
    if (productSearchResult && opened) {
      if (productSearchResult.alias) setAlias(productSearchResult.alias);
      if (productSearchResult.description) setDescription(productSearchResult.description);
    }
  }, [productSearchResult, opened]);

  const customTypes = availableTypes.filter(t => !BUILTIN_TYPES.includes(t));

  const selectData = [
    { group: '기본 타입', items: BUILTIN_TYPES.map(t => ({ value: t, label: t })) },
    ...(customTypes.length > 0
      ? [{ group: '커스텀 타입', items: customTypes.map(t => ({ value: t, label: t })) }]
      : []),
    { group: '', items: [{ value: NEW_TYPE_VALUE, label: '+ 새 타입 추가' }] },
  ];

  const handleTypeChange = (value: string | null) => {
    if (value === NEW_TYPE_VALUE) {
      setAddingNewType(true);
      setSelectedType(null);
    } else {
      setAddingNewType(false);
      setSelectedType(value);
    }
  };

  const handleAddNewType = () => {
    const name = newTypeName.trim();
    if (!name) return;
    onAddCustomType?.(name);
    setSelectedType(name);
    setAddingNewType(false);
    setNewTypeName('');
  };

  const handleSubmit = () => {
    if (!selectedType) return;
    onSubmit(selectedType, alias.trim(), description.trim());
    onClose();
  };

  const showSearchButton = selectedType && SEARCHABLE_TYPES.includes(selectedType) && onSearchProducts;

  return (
    <Modal opened={opened} onClose={onClose} title="새 샘플 생성" size="sm" centered>
      <Stack gap="sm">
        <Select
          label="샘플 타입"
          placeholder="타입 선택"
          data={selectData}
          value={addingNewType ? NEW_TYPE_VALUE : selectedType}
          onChange={handleTypeChange}
          searchable
          allowDeselect={false}
        />

        {addingNewType && (
          <Group gap="xs">
            <TextInput
              flex={1}
              placeholder="새 타입 이름 (예: Oligo)"
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddNewType(); }}
            />
            <Button size="xs" onClick={handleAddNewType} disabled={!newTypeName.trim()}>
              추가
            </Button>
          </Group>
        )}

        <Group gap="xs" align="flex-end">
          <TextInput
            flex={1}
            label="별칭"
            placeholder="예: Sample-A"
            value={alias}
            onChange={(e) => setAlias(e.currentTarget.value)}
          />
          {showSearchButton && (
            <Button
              size="xs"
              variant="light"
              onClick={() => onSearchProducts!(selectedType!)}
              style={{ marginBottom: 1 }}
            >
              제품 검색
            </Button>
          )}
        </Group>

        <Textarea
          label="설명 (선택)"
          placeholder="예: 실험 1에서 사용된 샘플"
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
          autosize
          minRows={2}
          maxRows={6}
        />

        <Group justify="flex-end" mt="xs">
          <Button variant="default" size="xs" onClick={onClose}>취소</Button>
          <Button size="xs" onClick={handleSubmit} disabled={!selectedType}>생성</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
