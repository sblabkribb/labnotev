import type { ReactNode } from 'react';
import { render, fireEvent, act, waitFor, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { UnitOperationBlock } from '../types';
import { UnitOpAccordion } from '../components/UnitOpAccordion';

function renderWithMantine(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

const sampleOp: UnitOperationBlock = {
  id: 'op-1',
  opId: 'UHW010',
  opName: 'Test Op',
  opDescription: '',
  opType: 'hw',
  sections: [
    { heading: 'Input', content: 'hello world' },
  ],
};

const DEFAULT_TYPES: string[] = [
  'DNA', 'RNA', 'Plasmid', 'Reagent', 'Primer', 'Protein', 'Equip', 'Labware',
];

function makeOp(heading: string): UnitOperationBlock {
  return {
    id: 'op-1',
    opId: 'UHW010',
    opName: 'Test Op',
    opDescription: '',
    opType: 'hw',
    sections: [{ heading, content: '' }],
  };
}

/**
 * Mount the accordion with a single section using `heading`, expand it, and
 * click the +Sample button so the SampleCreateModal opens. Returns the
 * `onCreateSample` mock for assertion. The modal renders through a Mantine
 * portal to document.body, so callers query inputs/buttons from there.
 */
function openSampleModalForHeading(heading: string) {
  const onCreateSample = vi.fn();
  const { container } = renderWithMantine(
    <UnitOpAccordion
      unitOperations={[makeOp(heading)]}
      onChange={() => {}}
      onCreateSample={onCreateSample}
      availableTypes={DEFAULT_TYPES}
    />
  );
  const control = container.querySelector('button.mantine-Accordion-control') as HTMLButtonElement;
  act(() => { fireEvent.click(control); });

  const sampleButton = container.querySelector('button[aria-label="Add sample"]') as HTMLButtonElement | null;
  expect(sampleButton).toBeTruthy();
  act(() => { fireEvent.click(sampleButton!); });

  return { container, onCreateSample };
}

async function getModalInputs() {
  // Modal is rendered through a Mantine portal at document.body, so the
  // placeholders are unique enough to query directly.
  return waitFor(() => {
    const typeInput = document.body.querySelector('input[placeholder="Select type"]') as HTMLInputElement | null;
    const aliasInput = document.body.querySelector('input[placeholder="e.g. Sample-A"]') as HTMLInputElement | null;
    if (!typeInput || !aliasInput) throw new Error('modal inputs not mounted yet');
    return { typeInput, aliasInput };
  });
}

describe('UnitOpAccordion + Sample button', () => {
  it('reports focus + cursor activity (with opId/secHeading) before opening modal', () => {
    const onSectionFocus = vi.fn();
    const onCursorActivity = vi.fn();
    const onCreateSample = vi.fn();

    const { container } = renderWithMantine(
      <UnitOpAccordion
        unitOperations={[sampleOp]}
        onChange={() => {}}
        onSectionFocus={onSectionFocus}
        onCursorActivity={onCursorActivity}
        onCreateSample={onCreateSample}
        availableTypes={['DNA', 'RNA']}
      />
    );

    // Expand the accordion so the section textarea + +Sample button mount.
    const control = container.querySelector('button.mantine-Accordion-control') as HTMLButtonElement;
    expect(control).toBeTruthy();
    act(() => { fireEvent.click(control); });

    const sampleButton = container.querySelector('button[aria-label="Add sample"]') as HTMLButtonElement | null;
    expect(sampleButton).toBeTruthy();

    act(() => { fireEvent.click(sampleButton!); });

    // Focus + cursor must be reported so activeSectionRef is synced BEFORE the
    // modal dispatches sampleDefinitionCreated back to the webview.
    expect(onSectionFocus).toHaveBeenCalledWith(0, 0, 'UHW010', 'Input');
    expect(onCursorActivity).toHaveBeenCalled();

    // Both calls must happen BEFORE (or at worst simultaneously with) the
    // modal opening. We assert the focus-sync calls fired at least once.
    const focusOrder = onSectionFocus.mock.invocationCallOrder[0];
    const cursorOrder = onCursorActivity.mock.invocationCallOrder[0];
    expect(focusOrder).toBeGreaterThan(0);
    expect(cursorOrder).toBeGreaterThan(0);
  });

  it('locks the modal type Select to "Reagent" when opened from a Reagent section', async () => {
    const { onCreateSample } = openSampleModalForHeading('Reagent');
    const { typeInput, aliasInput } = await getModalInputs();

    expect(typeInput.disabled).toBe(true);
    expect(typeInput.value).toBe('Reagent');

    fireEvent.change(aliasInput, { target: { value: 'Buffer-A' } });
    act(() => { fireEvent.click(within(document.body).getByRole('button', { name: 'Create' })); });

    await waitFor(() => {
      expect(onCreateSample).toHaveBeenCalledWith(0, 0, 'Reagent', 'Buffer-A', '');
    });
  });

  it('locks the modal type Select to "Labware" when opened from a Labware and Consumables section', async () => {
    const { onCreateSample } = openSampleModalForHeading('Labware and Consumables');
    const { typeInput, aliasInput } = await getModalInputs();

    expect(typeInput.disabled).toBe(true);
    expect(typeInput.value).toBe('Labware');

    fireEvent.change(aliasInput, { target: { value: 'Tip-200' } });
    act(() => { fireEvent.click(within(document.body).getByRole('button', { name: 'Create' })); });

    await waitFor(() => {
      expect(onCreateSample).toHaveBeenCalledWith(0, 0, 'Labware', 'Tip-200', '');
    });
  });

  it('treats the legacy "Consumables" heading the same as "Labware and Consumables"', async () => {
    // Verifies that the normalizer-backed lookup also handles pre-v0.54.8
    // notebooks whose markdown still has `#### Consumables`.
    const { onCreateSample } = openSampleModalForHeading('Consumables');
    const { typeInput, aliasInput } = await getModalInputs();

    expect(typeInput.disabled).toBe(true);
    expect(typeInput.value).toBe('Labware');

    fireEvent.change(aliasInput, { target: { value: 'Plate-96' } });
    act(() => { fireEvent.click(within(document.body).getByRole('button', { name: 'Create' })); });

    await waitFor(() => {
      expect(onCreateSample).toHaveBeenCalledWith(0, 0, 'Labware', 'Plate-96', '');
    });
  });

  it('locks the modal type Select to "Equip" when opened from an Equipment section', async () => {
    const { onCreateSample } = openSampleModalForHeading('Equipment');
    const { typeInput, aliasInput } = await getModalInputs();

    expect(typeInput.disabled).toBe(true);
    expect(typeInput.value).toBe('Equip');

    fireEvent.change(aliasInput, { target: { value: 'Centrifuge-1' } });
    act(() => { fireEvent.click(within(document.body).getByRole('button', { name: 'Create' })); });

    await waitFor(() => {
      expect(onCreateSample).toHaveBeenCalledWith(0, 0, 'Equip', 'Centrifuge-1', '');
    });
  });

  it('does not lock the type Select for free-choice sections (Output)', async () => {
    await openSampleModalForHeading('Output');
    const { typeInput } = await getModalInputs();

    // Free-choice section: Select stays enabled and starts empty so the user
    // can pick any built-in or custom type.
    expect(typeInput.disabled).toBe(false);
    expect(typeInput.value).toBe('');
  });
});
