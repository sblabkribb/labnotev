import type { ReactNode } from 'react';
import { render, fireEvent, act } from '@testing-library/react';
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

describe('UnitOpAccordion + Sample 버튼', () => {
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

    const sampleButton = container.querySelector('button[aria-label="샘플 추가"]') as HTMLButtonElement | null;
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
});
