import { useState, useEffect, useRef } from 'react';
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

/** Build a masked display string from raw digits (0–4 digits). */
function digitsToDisplay(digits: string): string {
  if (digits.length <= 2) return digits;
  return digits.slice(0, 2) + ':' + digits.slice(2);
}

/** Validate and format 4 digits into HH:MM, or return '' if invalid. */
export function formatTimeInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length < 3) return '';
  const d = digits.length === 3 ? '0' + digits : digits.slice(0, 4);
  const h = parseInt(d.slice(0, 2), 10);
  const m = parseInt(d.slice(2, 4), 10);
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
  const [editing, setEditing] = useState(false);
  const prevTimeRef = useRef(time);

  useEffect(() => {
    if (!editing) setLocalTime(time);
  }, [time, editing]);

  const handleDateChange = (newDate: string | null) => {
    onChange(combine(newDate, time));
  };

  const handleTimeFocus = () => {
    prevTimeRef.current = localTime;
    setEditing(true);
    setLocalTime('');
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.currentTarget.value.replace(/[^0-9]/g, '').slice(0, 4);
    const display = digitsToDisplay(digits);
    setLocalTime(display);

    if (digits.length === 4) {
      const h = parseInt(digits.slice(0, 2), 10);
      const m = parseInt(digits.slice(2, 4), 10);
      if (h <= 23 && m <= 59) {
        const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        onChange(combine(date, formatted));
        setEditing(false);
        e.currentTarget.blur();
      }
    }
  };

  const handleTimeBlur = () => {
    setEditing(false);
    const formatted = formatTimeInput(localTime);
    if (formatted) {
      setLocalTime(formatted);
      onChange(combine(date, formatted));
    } else {
      setLocalTime(prevTimeRef.current);
    }
  };

  const handleTimeClear = () => {
    setLocalTime('');
    setEditing(false);
    onChange(combine(date, ''));
  };

  const handleNow = () => {
    const now = dayjs();
    const newDate = date ?? now.format('YYYY-MM-DD');
    const newTime = now.format('HH:mm');
    setLocalTime(newTime);
    setEditing(false);
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
          onChange={handleTimeChange}
          onFocus={handleTimeFocus}
          onBlur={handleTimeBlur}
          placeholder="HH:MM"
          style={{ width: 100 }}
          maxLength={5}
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
        {localTime && !editing && (
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
