import { useState, useEffect } from 'react';
import { Group, ActionIcon, Text, TextInput, Tooltip } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
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

export function formatTimeInput(raw: string): string {
  if (raw.includes(':')) {
    const [hStr, mStr] = raw.split(':');
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr || '0', 10);
    if (isNaN(h) || h > 23 || isNaN(m) || m > 59) return '';
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.length <= 2) {
    const h = parseInt(digits, 10);
    if (h > 23) return '';
    return `${String(h).padStart(2, '0')}:00`;
  }
  if (digits.length === 3) {
    const h = parseInt(digits[0], 10);
    const m = parseInt(digits.slice(1), 10);
    if (h > 23 || m > 59) return '';
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const h = parseInt(digits.slice(0, 2), 10);
  const m = parseInt(digits.slice(2, 4), 10);
  if (h > 23 || m > 59) return '';
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function DateTimeField({
  label,
  value,
  onChange,
  clearable = true,
  size = 'sm',
}: DateTimeFieldProps) {
  const { date, time } = parseParts(value);
  const [localTime, setLocalTime] = useState(time);

  useEffect(() => {
    setLocalTime(time);
  }, [time]);

  const handleDateChange = (newDate: string | null) => {
    onChange(combine(newDate, time));
  };

  const commitTime = () => {
    const formatted = formatTimeInput(localTime);
    setLocalTime(formatted);
    onChange(combine(date, formatted));
  };

  const handleTimeClear = () => {
    setLocalTime('');
    onChange(combine(date, ''));
  };

  const handleNow = () => {
    const now = dayjs();
    const newDate = date ?? now.format('YYYY-MM-DD');
    const newTime = now.format('HH:mm');
    setLocalTime(newTime);
    onChange(combine(newDate, newTime));
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
        <TextInput
          size={size}
          value={localTime}
          onChange={(e) => setLocalTime(e.currentTarget.value)}
          onBlur={commitTime}
          onKeyDown={(e) => { if (e.key === 'Enter') commitTime(); }}
          placeholder="HH:MM"
          style={{ width: 100 }}
        />
        <Tooltip label="현재 시간" position="bottom" withArrow>
          <ActionIcon
            variant="subtle"
            size="sm"
            onClick={handleNow}
            aria-label="현재 시간"
          >
            <ClockIcon />
          </ActionIcon>
        </Tooltip>
        {localTime && (
          <ActionIcon
            variant="subtle"
            size="xs"
            color="gray"
            onClick={handleTimeClear}
            aria-label="시간 지우기"
          >
            ×
          </ActionIcon>
        )}
      </Group>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6.5" />
      <polyline points="8,4 8,8 11,9.5" />
    </svg>
  );
}
