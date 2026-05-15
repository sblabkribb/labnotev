import type { ReactNode } from 'react';
import { render, fireEvent, act } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { UnitOperationBlock } from '../types';
import { UnitOpAccordion } from '../components/UnitOpAccordion';

function renderWithMantine(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

function makeOp(overrides: Partial<UnitOperationBlock> = {}): UnitOperationBlock {
  return {
    id: 'op-1',
    opId: 'UHW010',
    opName: 'Test Op',
    opDescription: '',
    opType: 'hw',
    sections: [{ heading: 'Input', content: '' }],
    ...overrides,
  };
}

function expandAccordion(container: HTMLElement) {
  const control = container.querySelector('button.mantine-Accordion-control') as HTMLButtonElement;
  expect(control).toBeTruthy();
  act(() => { fireEvent.click(control); });
}

function getDescriptionInput(container: HTMLElement): HTMLTextAreaElement {
  const input = container.querySelector('textarea[placeholder="Add description"]') as HTMLTextAreaElement | null;
  expect(input).toBeTruthy();
  return input!;
}

describe('UnitOpAccordion + opDescription editing', () => {
  it('renders an editable description input with placeholder when opDescription is empty', () => {
    const { container } = renderWithMantine(
      <UnitOpAccordion unitOperations={[makeOp()]} onChange={() => {}} />
    );
    expandAccordion(container);

    const input = getDescriptionInput(container);
    expect(input.value).toBe('');
  });

  it('shows the current opDescription as the input value', () => {
    const op = makeOp({ opDescription: 'Existing description' });
    const { container } = renderWithMantine(
      <UnitOpAccordion unitOperations={[op]} onChange={() => {}} />
    );
    expandAccordion(container);

    const input = getDescriptionInput(container);
    expect(input.value).toBe('Existing description');
  });

  it('invokes onChange with updated opDescription when the user types', () => {
    const onChange = vi.fn();
    const { container } = renderWithMantine(
      <UnitOpAccordion unitOperations={[makeOp()]} onChange={onChange} />
    );
    expandAccordion(container);

    const input = getDescriptionInput(container);
    act(() => { fireEvent.change(input, { target: { value: 'New description' } }); });

    expect(onChange).toHaveBeenCalledTimes(1);
    const [updated] = onChange.mock.calls[0] as [UnitOperationBlock[]];
    expect(updated).toHaveLength(1);
    expect(updated[0].opDescription).toBe('New description');
    expect(updated[0].opId).toBe('UHW010');
  });
});
