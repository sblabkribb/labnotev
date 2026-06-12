import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MantineProvider } from '@mantine/core';
import { UnitOpAccordion } from '../components/UnitOpAccordion';
import type { UnitOperationBlock } from '../types';

function renderWithMantine(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

function lastArg(mock: ReturnType<typeof vi.fn>): UnitOperationBlock[] {
  const calls = mock.mock.calls;
  return calls[calls.length - 1][0] as UnitOperationBlock[];
}

function makeOp(metaContent: string): UnitOperationBlock {
  return {
    id: 'uo-1',
    opId: 'UHW010',
    opName: 'Test Op',
    opDescription: '',
    opType: 'hw',
    sections: [{ heading: 'Meta', content: metaContent }],
  };
}

const META = [
  '- Experimenter: 홍길동',
  "- Start_date: ''",
  "- End_date: ''",
  "- Duration: '2h'",
].join('\n');

function setup(op: UnitOperationBlock) {
  const onChange = vi.fn();
  renderWithMantine(
    <UnitOpAccordion
      unitOperations={[op]}
      onChange={onChange}
      openedOpIds={[op.id]}
      onOpenedChange={() => {}}
    />,
  );
  return { onChange };
}

describe('UnitOpAccordion Meta custom fields', () => {
  it('renders a custom Meta field (Duration) as an editable input', () => {
    setup(makeOp(META));
    const input = screen.getByLabelText('Duration') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('2h');
  });

  it('edits a custom field and preserves it (plus other fields) in serialized output', () => {
    const { onChange } = setup(makeOp(META));
    const input = screen.getByLabelText('Duration') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '3h' } });

    expect(onChange).toHaveBeenCalled();
    const updated = lastArg(onChange);
    const meta = updated[0].sections[0].content;
    expect(meta).toContain("- Duration: '3h'");
    expect(meta).toContain('- Experimenter:');
  });

  it('adds a new custom field through the add-field form', () => {
    const { onChange } = setup(makeOp(META));

    fireEvent.click(screen.getByRole('button', { name: /필드 추가/ }));
    const nameInput = screen.getByLabelText(/필드 이름/) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Volume' } });
    fireEvent.click(screen.getByRole('button', { name: /^추가$|확인/ }));

    const updated = lastArg(onChange);
    expect(updated[0].sections[0].content).toContain("- Volume: ''");
  });

  it('rejects a duplicate field name', () => {
    const { onChange } = setup(makeOp(META));
    onChange.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /필드 추가/ }));
    const nameInput = screen.getByLabelText(/필드 이름/) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Duration' } });
    fireEvent.click(screen.getByRole('button', { name: /^추가$|확인/ }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/이미 있는|중복/)).toBeInTheDocument();
  });

  it('deletes a custom field, removing its line from serialized output', () => {
    const { onChange } = setup(makeOp(META));

    const deleteBtn = screen.getByRole('button', { name: /Duration 삭제/ });
    fireEvent.click(deleteBtn);

    const updated = lastArg(onChange);
    const meta = updated[0].sections[0].content;
    expect(meta).not.toContain('Duration');
    expect(meta).toContain('- Experimenter:');
  });
});
