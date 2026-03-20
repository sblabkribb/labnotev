import { TextInput, Switch, Group, Stack } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import dayjs from 'dayjs';
import '@mantine/dates/styles.css';

interface FrontMatterFormProps {
  data: Record<string, unknown>;
  fields: { key: string; label: string; type?: 'text' | 'boolean' | 'readonly' | 'datetime' }[];
  onChange: (key: string, value: unknown) => void;
}

function parseDateTimeString(value: unknown): Date | null {
  if (!value || String(value).trim() === '') return null;
  const parsed = dayjs(String(value), 'YYYY-MM-DD HH:mm');
  if (parsed.isValid()) return parsed.toDate();
  const dateOnly = dayjs(String(value), 'YYYY-MM-DD');
  if (dateOnly.isValid()) return dateOnly.toDate();
  return null;
}

function formatDateTime(date: Date | null): string {
  if (!date) return '';
  return dayjs(date).format('YYYY-MM-DD HH:mm');
}

export function FrontMatterForm({ data, fields, onChange }: FrontMatterFormProps) {
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
            <DateTimePicker
              key={field.key}
              label={field.label}
              value={parseDateTimeString(value)}
              onChange={(date) => onChange(field.key, formatDateTime(date))}
              valueFormat="YYYY-MM-DD HH:mm"
              clearable
              placeholder="날짜와 시간을 선택하세요"
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
          />
        );
      })}
    </Stack>
  );
}
