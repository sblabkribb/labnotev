import { useState, useEffect, useRef, useMemo } from 'react';
import { Modal, Select, TextInput, Textarea, Group, Button, Stack, Text } from '@mantine/core';

const BUILTIN_TYPES = ['DNA', 'RNA', 'Plasmid', 'Reagent', 'Primer', 'Protein', 'Equip', 'Labware'];
const NEW_TYPE_VALUE = '__new_type__';
const SEARCHABLE_TYPES = ['Reagent', 'Labware'];
// Phase B-1: custom type names must not collide with the sample-id regex used
// by storage/highlight. `-`, whitespace, and regex metachars are rejected so
// downstream regex compilation (buildSampleIdPattern) stays predictable.
const INVALID_TYPE_CHAR_RE = /[\s\-.*+?^${}()|[\]\\/@:;|]/;

interface SampleCreateModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (sampleType: string, alias: string, description: string) => void;
  onSearchProducts?: (sampleType: string) => void;
  productSearchResult?: { alias: string; description: string } | null;
  availableTypes: string[];
  onAddCustomType?: (typeName: string) => void;
  defaultType?: string;
  /** Phase B-1: disables the submit button while the extension is generating the id. */
  submitting?: boolean;
}

export function SampleCreateModal({
  opened, onClose, onSubmit, onSearchProducts, productSearchResult,
  availableTypes,   onAddCustomType, defaultType, submitting,
}: SampleCreateModalProps) {
  const isControlledSubmission = submitting !== undefined;
  const isSubmitting = submitting === true;
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [alias, setAlias] = useState('');
  const [description, setDescription] = useState('');
  const [newTypeName, setNewTypeName] = useState('');
  const [addingNewType, setAddingNewType] = useState(false);
  const typeSelectRef = useRef<HTMLInputElement | null>(null);
  const aliasRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (opened) {
      setSelectedType(defaultType ?? null);
      setAlias('');
      setDescription('');
      setNewTypeName('');
      setAddingNewType(false);
      // Phase B-1: autofocus the type Select when no defaultType is passed,
      // otherwise skip straight to the alias field so the user can start
      // typing immediately without an extra tab.
      const id = window.setTimeout(() => {
        if (defaultType) aliasRef.current?.focus();
        else typeSelectRef.current?.focus();
      }, 50);
      return () => window.clearTimeout(id);
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

  const trimmedNewType = newTypeName.trim();
  const newTypeError = useMemo((): string | null => {
    if (!addingNewType || trimmedNewType.length === 0) return null;
    if (INVALID_TYPE_CHAR_RE.test(trimmedNewType)) {
      return '공백, 하이픈, 특수문자는 사용할 수 없습니다';
    }
    const existing = new Set([
      ...BUILTIN_TYPES.map(t => t.toLowerCase()),
      ...availableTypes.map(t => t.toLowerCase()),
    ]);
    if (existing.has(trimmedNewType.toLowerCase())) {
      return '이미 사용 중인 타입 이름입니다';
    }
    return null;
  }, [addingNewType, trimmedNewType, availableTypes]);

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
    if (!trimmedNewType || newTypeError) return;
    onAddCustomType?.(trimmedNewType);
    setSelectedType(trimmedNewType);
    setAddingNewType(false);
    setNewTypeName('');
  };

  const handleSubmit = () => {
    if (!selectedType || isSubmitting) return;
    onSubmit(selectedType, alias.trim(), description.trim());
    // Phase B-1: only auto-close when the caller is not managing the async
    // round-trip. If `submitting` is provided as a prop, the parent keeps the
    // modal open until the extension responds and flips it back to false.
    if (!isControlledSubmission) onClose();
  };

  // Phase B-1: use a real <form> so browsers/screen readers treat Enter as
  // submit on any focused text input. We stop propagation of Enter inside the
  // Textarea (multi-line) so it still accepts newlines.
  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit();
  };

  const showSearchButton = selectedType && SEARCHABLE_TYPES.includes(selectedType) && onSearchProducts;

  return (
    <Modal opened={opened} onClose={onClose} title="새 샘플 생성" size="sm" centered>
      <form onSubmit={onFormSubmit} noValidate>
        <Stack gap="sm">
          <Select
            ref={typeSelectRef}
            label={<RequiredLabel>샘플 타입</RequiredLabel>}
            placeholder="타입 선택"
            data={selectData}
            value={addingNewType ? NEW_TYPE_VALUE : selectedType}
            onChange={handleTypeChange}
            searchable
            allowDeselect={false}
            required
          />

          {addingNewType && (
            <>
              <Group gap="xs">
                <TextInput
                  flex={1}
                  placeholder="새 타입 이름 (예: Oligo)"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNewType();
                    }
                  }}
                  error={newTypeError || undefined}
                />
                <Button
                  size="xs"
                  onClick={handleAddNewType}
                  disabled={!trimmedNewType || Boolean(newTypeError)}
                  type="button"
                >
                  추가
                </Button>
              </Group>
            </>
          )}

          <Group gap="xs" align="flex-end">
            <TextInput
              ref={aliasRef}
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
                type="button"
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
            <Button variant="default" size="xs" onClick={onClose} type="button" disabled={isSubmitting}>
              취소
            </Button>
            <Button
              size="xs"
              type="submit"
              disabled={!selectedType || isSubmitting}
              loading={isSubmitting}
            >
              생성
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text component="span" size="sm" fw={500}>
      {children}
      <Text component="span" c="red" ml={4} aria-hidden>
        *
      </Text>
    </Text>
  );
}
