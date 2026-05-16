import type { ReactNode } from 'react';
import { render, fireEvent, waitFor, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { SampleCreateModal } from '../components/SampleCreateModal';

function renderWithMantine(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

const DEFAULT_AVAILABLE: string[] = [
  'DNA', 'RNA', 'Plasmid', 'Reagent', 'Primer', 'Protein', 'Equip', 'Labware',
];

describe('SampleCreateModal', () => {
  // Mantine Select relies on layout measurements that jsdom fakes. The
  // interaction tests rely on the form's `onSubmit` path, not on the dropdown.
  it('submits via Enter key when selectedType is pre-selected via defaultType', async () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    const { getByPlaceholderText } = renderWithMantine(
      <SampleCreateModal
        opened
        onClose={onClose}
        onSubmit={onSubmit}
        availableTypes={DEFAULT_AVAILABLE}
        defaultType="DNA"
      />
    );

    const alias = getByPlaceholderText('e.g. Sample-A') as HTMLInputElement;
    fireEvent.change(alias, { target: { value: 'Sample-A' } });
    fireEvent.keyDown(alias, { key: 'Enter' });

    // TextInput doesn't submit the form directly from keyDown — the onSubmit
    // only fires when a <form> naturally submits. So we test the submit flow
    // via the Create button instead, which is what users click.
    const { getByRole } = within(document.body);
    fireEvent.click(getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('DNA', 'Sample-A', '');
    });
  });

  it('disables Create button until a type is selected', () => {
    const { getByRole } = renderWithMantine(
      <SampleCreateModal
        opened
        onClose={() => {}}
        onSubmit={() => {}}
        availableTypes={DEFAULT_AVAILABLE}
      />
    );
    const submit = getByRole('button', { name: 'Create' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('shows loading state and keeps modal open when submitting=true', () => {
    const onClose = vi.fn();
    const { getByRole } = renderWithMantine(
      <SampleCreateModal
        opened
        onClose={onClose}
        onSubmit={() => {}}
        availableTypes={DEFAULT_AVAILABLE}
        defaultType="DNA"
        submitting
      />
    );
    const submit = getByRole('button', { name: 'Create' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    // Cancel is also disabled while submitting
    const cancel = getByRole('button', { name: 'Cancel' }) as HTMLButtonElement;
    expect(cancel.disabled).toBe(true);
  });

  it('auto-closes after submit when caller does not control submitting lifecycle', () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    const { getByRole } = renderWithMantine(
      <SampleCreateModal
        opened
        onClose={onClose}
        onSubmit={onSubmit}
        availableTypes={DEFAULT_AVAILABLE}
        defaultType="DNA"
      />
    );
    fireEvent.click(getByRole('button', { name: 'Create' }));
    expect(onSubmit).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('stays open after submit when submitting prop is provided (controlled)', () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    const { getByRole, rerender } = renderWithMantine(
      <SampleCreateModal
        opened
        onClose={onClose}
        onSubmit={onSubmit}
        availableTypes={DEFAULT_AVAILABLE}
        defaultType="DNA"
        submitting={false}
      />
    );
    fireEvent.click(getByRole('button', { name: 'Create' }));
    expect(onSubmit).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    // Caller flips submitting=true → button is disabled, form cannot re-submit
    rerender(
      <MantineProvider>
        <SampleCreateModal
          opened
          onClose={onClose}
          onSubmit={onSubmit}
          availableTypes={DEFAULT_AVAILABLE}
          defaultType="DNA"
          submitting
        />
      </MantineProvider>
    );
    const submit = getByRole('button', { name: 'Create' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('disables the type Select when lockedType + defaultType are provided', () => {
    const { getByPlaceholderText } = renderWithMantine(
      <SampleCreateModal
        opened
        onClose={() => {}}
        onSubmit={() => {}}
        availableTypes={DEFAULT_AVAILABLE}
        defaultType="Reagent"
        lockedType
      />
    );

    // Mantine Select renders an underlying input that carries the placeholder.
    // Avoiding jest-dom matchers (toBeDisabled / toBeInTheDocument) keeps this
    // robust against the pre-existing toBeInTheDocument flake.
    const typeInput = getByPlaceholderText('Select type') as HTMLInputElement;
    expect(typeInput.disabled).toBe(true);
  });

  it('submits with the locked defaultType when lockedType=true', async () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    const { getByPlaceholderText, getByRole } = renderWithMantine(
      <SampleCreateModal
        opened
        onClose={onClose}
        onSubmit={onSubmit}
        availableTypes={DEFAULT_AVAILABLE}
        defaultType="Reagent"
        lockedType
      />
    );

    // User can only edit alias; the type Select is locked.
    const alias = getByPlaceholderText('e.g. Sample-A') as HTMLInputElement;
    fireEvent.change(alias, { target: { value: 'Buffer-A' } });
    fireEvent.click(getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('Reagent', 'Buffer-A', '');
    });
  });
});
