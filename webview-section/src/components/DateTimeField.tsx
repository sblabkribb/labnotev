import { useRef } from 'react';
import { Group, ActionIcon, Text } from '@mantine/core';
import { DatePickerInput, TimeInput } from '@mantine/dates';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

interface DateTimeFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  clearable?: boolean;
  size?: string;
  placeholder?: string;
}

function parseParts(value: string): { date: string | null; time: string } {
  if (!value || value.trim() === '') return { date: null, time: '' };
  const trimmed = value.trim().replace(/^'|'$/g, '');
  const parts = trimmed.split(/\s+/);
  const datePart = parts[0] || null;
  const timePart = parts[1] || '';
  if (datePart && dayjs(datePart, 'YYYY-MM-DD', true).isValid()) {
    return { date: datePart, time: timePart };
  }
  return { date: null, time: '' };
}

function combine(date: string | null, time: string): string {
  if (!date) return '';
  if (time) return `${date} ${time}`;
  return date;
}

export function DateTimeField({
  label,
  value,
  onChange,
  clearable = true,
  size = 'sm',
}: DateTimeFieldProps) {
  const timeRef = useRef<HTMLInputElement>(null);
  const { date, time } = parseParts(value);

  const handleDateChange = (newDate: string | null) => {
    onChange(combine(newDate, time));
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(combine(date, e.currentTarget.value));
  };

  const handleTimeClear = () => {
    onChange(combine(date, ''));
  };

  return (
    <div>
      <Text size="sm" fw={500} mb={2}>{label}</Text>
      <Group gap="xs" align="flex-end" wrap="nowrap">
        <DatePickerInput
          size={size}
          value={date}
          onChange={handleDateChange}
          valueFormat="YYYY-MM-DD"
          clearable={clearable}
          placeholder="날짜 선택"
          style={{ flex: 1 }}
        />
        <TimeInput
          ref={timeRef}
          size={size}
          value={time}
          onChange={handleTimeChange}
          placeholder="--:--"
          rightSection={
            time ? (
              <ActionIcon
                variant="subtle"
                size="xs"
                color="gray"
                onClick={handleTimeClear}
                aria-label="시간 지우기"
              >
                ×
              </ActionIcon>
            ) : undefined
          }
          style={{ width: 110 }}
        />
      </Group>
    </div>
  );
}
