import type { ReactNode } from 'react';
import { render, fireEvent, act, within, waitFor } from '@testing-library/react';
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

function getActionsTrigger(container: HTMLElement, opIndex = 0): HTMLButtonElement {
  const triggers = container.querySelectorAll('button[aria-label="Unit Operation actions"]');
  expect(triggers.length).toBeGreaterThan(opIndex);
  return triggers[opIndex] as HTMLButtonElement;
}

// Mantine Menu mounts its dropdown asynchronously, so we wait until the
// menuitem role appears in the DOM (the portal lives at document.body).
async function openActionsMenu(container: HTMLElement, opIndex = 0): Promise<HTMLElement[]> {
  const trigger = getActionsTrigger(container, opIndex);
  act(() => { fireEvent.click(trigger); });
  return waitFor(() => {
    const items = Array.from(document.body.querySelectorAll('[role="menuitem"]')) as HTMLElement[];
    if (items.length === 0) throw new Error('menu items not rendered yet');
    return items;
  });
}

function findMenuItem(items: HTMLElement[], label: string): HTMLElement {
  const match = items.find((el) => (el.textContent ?? '').includes(label));
  expect(match).toBeTruthy();
  return match!;
}

describe('UnitOpAccordion + actions menu', () => {
  it('opens the actions menu without toggling the Accordion (stopPropagation)', async () => {
    const { container } = renderWithMantine(
      <UnitOpAccordion
        unitOperations={[makeOp()]}
        onChange={() => {}}
        onCopy={() => {}}
        onPasteBelow={() => {}}
      />
    );

    const control = container.querySelector('button.mantine-Accordion-control') as HTMLButtonElement;
    const expandedBefore = control.getAttribute('aria-expanded');

    const items = await openActionsMenu(container);

    expect(control.getAttribute('aria-expanded')).toBe(expandedBefore);
    expect(items.length).toBe(3);
    expect(findMenuItem(items, 'Copy')).toBeTruthy();
    expect(findMenuItem(items, 'Paste below')).toBeTruthy();
    expect(findMenuItem(items, 'Delete')).toBeTruthy();
  });

  it('invokes onCopy(opIndex) when the Copy menu item is clicked', async () => {
    const onCopy = vi.fn();
    const { container } = renderWithMantine(
      <UnitOpAccordion
        unitOperations={[makeOp(), makeOp({ id: 'op-2', opId: 'UHW020', opName: 'Other' })]}
        onChange={() => {}}
        onCopy={onCopy}
        onPasteBelow={() => {}}
      />
    );
    const items = await openActionsMenu(container, 1);

    act(() => { fireEvent.click(findMenuItem(items, 'Copy')); });

    expect(onCopy).toHaveBeenCalledWith(1);
  });

  it('invokes onPasteBelow(opIndex) when the Paste below menu item is clicked', async () => {
    const onPasteBelow = vi.fn();
    const { container } = renderWithMantine(
      <UnitOpAccordion
        unitOperations={[makeOp(), makeOp({ id: 'op-2', opId: 'UHW020', opName: 'Other' })]}
        onChange={() => {}}
        onCopy={() => {}}
        onPasteBelow={onPasteBelow}
        clipboardHasUnitOp
      />
    );
    const items = await openActionsMenu(container, 0);

    act(() => { fireEvent.click(findMenuItem(items, 'Paste below')); });

    expect(onPasteBelow).toHaveBeenCalledWith(0);
  });

  it('confirms delete: clicking Delete in the modal calls onChange with the op removed', async () => {
    const onChange = vi.fn();
    const first = makeOp();
    const second = makeOp({ id: 'op-2', opId: 'UHW020', opName: 'Other' });
    const { container } = renderWithMantine(
      <UnitOpAccordion
        unitOperations={[first, second]}
        onChange={onChange}
        onCopy={() => {}}
        onPasteBelow={() => {}}
      />
    );

    const items = await openActionsMenu(container, 0);
    act(() => { fireEvent.click(findMenuItem(items, 'Delete')); });

    const confirmBtn = await waitFor(() =>
      within(document.body).getByRole('button', { name: 'Delete' })
    );
    act(() => { fireEvent.click(confirmBtn); });

    expect(onChange).toHaveBeenCalledTimes(1);
    const [updated] = onChange.mock.calls[0] as [UnitOperationBlock[]];
    expect(updated.map(o => o.id)).toEqual(['op-2']);
  });

  it('cancels delete: clicking Cancel keeps onChange untouched', async () => {
    const onChange = vi.fn();
    const { container } = renderWithMantine(
      <UnitOpAccordion
        unitOperations={[makeOp()]}
        onChange={onChange}
        onCopy={() => {}}
        onPasteBelow={() => {}}
      />
    );

    const items = await openActionsMenu(container, 0);
    act(() => { fireEvent.click(findMenuItem(items, 'Delete')); });

    const cancelBtn = await waitFor(() =>
      within(document.body).getByRole('button', { name: 'Cancel' })
    );
    act(() => { fireEvent.click(cancelBtn); });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders a Paste Unit Operation button when the workflow is empty', () => {
    const onPasteBelow = vi.fn();
    const { container } = renderWithMantine(
      <UnitOpAccordion
        unitOperations={[]}
        onChange={() => {}}
        onCopy={() => {}}
        onPasteBelow={onPasteBelow}
        clipboardHasUnitOp
      />
    );

    const btn = container.querySelector('button') as HTMLButtonElement | null;
    expect(btn).toBeTruthy();
    expect(btn!.textContent).toMatch(/Paste Unit Operation/);

    act(() => { fireEvent.click(btn!); });
    expect(onPasteBelow).toHaveBeenCalledWith(-1);
  });

  it('clicking Copy does not toggle the Accordion (menu-item stopPropagation)', async () => {
    const onCopy = vi.fn();
    const { container } = renderWithMantine(
      <UnitOpAccordion
        unitOperations={[makeOp()]}
        onChange={() => {}}
        onCopy={onCopy}
        onPasteBelow={() => {}}
        clipboardHasUnitOp
      />
    );

    const control = container.querySelector('button.mantine-Accordion-control') as HTMLButtonElement;
    const expandedBefore = control.getAttribute('aria-expanded');

    const items = await openActionsMenu(container);
    act(() => { fireEvent.click(findMenuItem(items, 'Copy')); });

    expect(control.getAttribute('aria-expanded')).toBe(expandedBefore);
    expect(onCopy).toHaveBeenCalledWith(0);
  });

  it('disables Paste below when clipboard does not hold a Unit Operation', async () => {
    const onPasteBelow = vi.fn();
    const { container } = renderWithMantine(
      <UnitOpAccordion
        unitOperations={[makeOp()]}
        onChange={() => {}}
        onCopy={() => {}}
        onPasteBelow={onPasteBelow}
      />
    );

    const items = await openActionsMenu(container, 0);
    const pasteItem = findMenuItem(items, 'Paste below');
    // Mantine marks disabled menu items via aria-disabled / data-disabled.
    expect(
      pasteItem.getAttribute('aria-disabled') === 'true'
      || pasteItem.hasAttribute('data-disabled'),
    ).toBe(true);

    act(() => { fireEvent.click(pasteItem); });
    expect(onPasteBelow).not.toHaveBeenCalled();
  });

  it('enables Paste below when clipboardHasUnitOp is true', async () => {
    const onPasteBelow = vi.fn();
    const { container } = renderWithMantine(
      <UnitOpAccordion
        unitOperations={[makeOp()]}
        onChange={() => {}}
        onCopy={() => {}}
        onPasteBelow={onPasteBelow}
        clipboardHasUnitOp
      />
    );

    const items = await openActionsMenu(container, 0);
    const pasteItem = findMenuItem(items, 'Paste below');
    expect(pasteItem.getAttribute('aria-disabled')).not.toBe('true');
    expect(pasteItem.hasAttribute('data-disabled')).toBe(false);

    act(() => { fireEvent.click(pasteItem); });
    expect(onPasteBelow).toHaveBeenCalledWith(0);
  });

  it('invokes onMenuOpen exactly once when the actions menu opens', async () => {
    const onMenuOpen = vi.fn();
    const { container } = renderWithMantine(
      <UnitOpAccordion
        unitOperations={[makeOp()]}
        onChange={() => {}}
        onCopy={() => {}}
        onPasteBelow={() => {}}
        onMenuOpen={onMenuOpen}
      />
    );

    await openActionsMenu(container, 0);
    expect(onMenuOpen).toHaveBeenCalledTimes(1);
  });

  it('disables the empty-state Paste button until clipboardHasUnitOp is true', () => {
    const onPasteBelow = vi.fn();
    const { container, rerender } = renderWithMantine(
      <UnitOpAccordion
        unitOperations={[]}
        onChange={() => {}}
        onCopy={() => {}}
        onPasteBelow={onPasteBelow}
      />
    );

    const btnDisabled = container.querySelector('button') as HTMLButtonElement;
    expect(btnDisabled.textContent).toMatch(/Paste Unit Operation/);
    expect(btnDisabled.disabled).toBe(true);

    act(() => { fireEvent.click(btnDisabled); });
    expect(onPasteBelow).not.toHaveBeenCalled();

    rerender(
      <MantineProvider>
        <UnitOpAccordion
          unitOperations={[]}
          onChange={() => {}}
          onCopy={() => {}}
          onPasteBelow={onPasteBelow}
          clipboardHasUnitOp
        />
      </MantineProvider>
    );

    const btnEnabled = container.querySelector('button') as HTMLButtonElement;
    expect(btnEnabled.disabled).toBe(false);
    act(() => { fireEvent.click(btnEnabled); });
    expect(onPasteBelow).toHaveBeenCalledWith(-1);
  });
});
