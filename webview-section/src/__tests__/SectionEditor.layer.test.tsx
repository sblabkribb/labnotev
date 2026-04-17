import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { SectionEditor } from '../components/SectionEditor';
import { UnitOpAccordion } from '../components/UnitOpAccordion';
import * as vscodeApi from '../vscodeApi';
import type { UnitOperationBlock } from '../types';

function renderWithMantine(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

function getOverlayAndTextarea(container: HTMLElement): {
  overlay: HTMLDivElement;
  textarea: HTMLTextAreaElement;
} {
  const textarea = container.querySelector('textarea') as HTMLTextAreaElement | null;
  if (!textarea) throw new Error('textarea not found');
  const parent = textarea.parentElement as HTMLElement | null;
  if (!parent) throw new Error('textarea parent not found');
  const overlay = parent.querySelector('div') as HTMLDivElement | null;
  if (!overlay) throw new Error('overlay div not found');
  return { overlay, textarea };
}

describe('Layer z-index regression (SectionEditor overlay must sit above textarea)', () => {
  beforeEach(() => {
    vi.spyOn(vscodeApi, 'postMessage').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('SectionEditor: overlay z-index > textarea z-index and overlay stays pointer-events:none', () => {
    const { container } = renderWithMantine(
      <SectionEditor
        heading="Test"
        content="샘플 DNA-001 사용"
        onChange={() => {}}
      />
    );

    const { overlay, textarea } = getOverlayAndTextarea(container);

    const overlayZ = Number(overlay.style.zIndex);
    const textareaZ = Number(textarea.style.zIndex);

    expect(Number.isFinite(overlayZ)).toBe(true);
    expect(Number.isFinite(textareaZ)).toBe(true);
    expect(overlayZ).toBeGreaterThan(textareaZ);
    expect(overlay.style.pointerEvents).toBe('none');
  });

  it('UnitOpAccordion: overlay z-index > textarea z-index and overlay stays pointer-events:none', () => {
    const unitOperations: UnitOperationBlock[] = [
      {
        id: 'op-1',
        opId: 'OP1',
        opName: 'Test OP',
        opDescription: '',
        opType: 'hw',
        sections: [
          { heading: 'Procedure', content: '샘플 DNA-001 사용' },
        ],
      },
    ];

    const { container } = renderWithMantine(
      <UnitOpAccordion unitOperations={unitOperations} onChange={() => {}} />
    );

    const control = container.querySelector('button.mantine-Accordion-control') as HTMLButtonElement | null;
    if (control) {
      fireEvent.click(control);
    }

    const { overlay, textarea } = getOverlayAndTextarea(container);

    const overlayZ = Number(overlay.style.zIndex);
    const textareaZ = Number(textarea.style.zIndex);

    expect(Number.isFinite(overlayZ)).toBe(true);
    expect(Number.isFinite(textareaZ)).toBe(true);
    expect(overlayZ).toBeGreaterThan(textareaZ);
    expect(overlay.style.pointerEvents).toBe('none');
  });
});
