import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { FrontMatterForm } from '../components/FrontMatterForm';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MantineProvider>{children}</MantineProvider>
);

describe('FrontMatterForm', () => {
  const sampleData = {
    title: 'Test Title',
    author: '홍길동',
    sample_tracking: true,
    created_date: '2026-01-15',
  };

  const fields = [
    { key: 'title', label: 'Title' },
    { key: 'author', label: 'Author' },
    { key: 'sample_tracking', label: 'Sample Tracking', type: 'boolean' as const },
    { key: 'created_date', label: 'Created Date', type: 'readonly' as const },
  ];

  it('should render all fields', () => {
    render(
      <FrontMatterForm data={sampleData} fields={fields} onChange={vi.fn()} />,
      { wrapper }
    );
    expect(screen.getByDisplayValue('Test Title')).toBeInTheDocument();
    expect(screen.getByDisplayValue('홍길동')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-01-15')).toBeInTheDocument();
  });

  it('should call onChange when text field changes', () => {
    const onChange = vi.fn();
    render(
      <FrontMatterForm data={sampleData} fields={fields} onChange={onChange} />,
      { wrapper }
    );
    const titleInput = screen.getByDisplayValue('Test Title');
    fireEvent.change(titleInput, { target: { value: 'New Title' } });
    expect(onChange).toHaveBeenCalledWith('title', 'New Title');
  });

  it('should render boolean fields as switches', () => {
    render(
      <FrontMatterForm data={sampleData} fields={fields} onChange={vi.fn()} />,
      { wrapper }
    );
    expect(screen.getByText('Sample Tracking')).toBeInTheDocument();
  });
});
