import { memo } from 'react';
import { TextInput, Switch, Group, Stack } from '@mantine/core';
import { DateTimeField } from './DateTimeField';
import '@mantine/dates/styles.css';

interface FrontMatterFormProps {
  data: Record<string, unknown>;
  fields: { key: string; label: string; type?: 'text' | 'boolean' | 'readonly' | 'datetime' }[];
  onChange: (key: string, value: unknown) => void;
}

export const FrontMatterForm = memo(function FrontMatterForm({ data, fields, onChange }: FrontMatterFormProps) {
  return (
    <Stack gap="xs">
      {fields.map((field) => {
        const value = data[field.key];
        if (field.type === 'boolean') {
          return (
            <Group key={field.key} gap="xs">
              <Switch
                label={field.label}
                checked={!!value}
                onChange={(e) => onChange(field.key, e.currentTarget.checked)}
              />
            </Group>
          );
        }
        if (field.type === 'datetime') {
          return (
            <DateTimeField
              key={field.key}
              label={field.label}
              value={String(value ?? '')}
              onChange={(v) => onChange(field.key, v)}
            />
          );
        }
        return (
          <TextInput
            key={field.key}
            label={field.label}
            value={String(value ?? '')}
            onChange={(e) => onChange(field.key, e.currentTarget.value)}
            readOnly={field.type === 'readonly'}
            // Read-only fields (e.g. Experiment Type) are not editable, so
            // exclude them from editor-mode find (#30).
            {...(field.type === 'readonly' ? { 'data-find-skip': '' } : {})}
          />
        );
      })}
    </Stack>
  );
});
