import type { ReactNode } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { SectionEditor } from '../components/SectionEditor';
import { UnitOpAccordion } from '../components/UnitOpAccordion';
import * as vscodeApi from '../vscodeApi';
import type { UnitOperationBlock } from '../types';

// Phase A-1: mirror the extension's injected SAMPLE_TYPES / sampleTypeColors.
// Without these props SampleHighlighter renders nothing and the overlay never
// mounts, so this regression test would silently stop catching layering bugs.
const DEFAULT_TYPES = ['DNA', 'RNA', 'Plasmid', 'Reagent', 'Primer', 'Protein', 'Equip', 'Labware'];
const DEFAULT_COLORS: Record<string, string> = {
  DNA: '#FFB6C1', RNA: '#87CEEB', Plasmid: '#FFFACD', Reagent: '#DDA0DD',
  Primer: '#B0E0E6', Protein: '#F0E68C', Equip: '#A9A9A9', Labware: '#C0C0C0',
};

function renderWithMantine(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

function getOverlayAndTextarea(container: HTMLElement): {
  overlay: HTMLDivElement;
  textarea: HTMLTextAreaElement;
} {
  // Find the HighlightedTextarea (section content) specifically. The new
  // opDescription `<Textarea>` (added in v0.54.4 for visual wrap) is also a
  // textarea but has no SampleHighlighter overlay sibling, so we look for the
  // textarea whose parent contains a sibling div overlay.
  const textareas = Array.from(container.querySelectorAll('textarea')) as HTMLTextAreaElement[];
  for (const ta of textareas) {
    const parent = ta.parentElement;
    if (!parent) continue;
    const overlay = parent.querySelector('div') as HTMLDivElement | null;
    if (overlay) return { overlay, textarea: ta };
  }
  throw new Error('HighlightedTextarea (textarea + overlay sibling) not found');
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
        availableTypes={DEFAULT_TYPES}
        sampleTypeColors={DEFAULT_COLORS}
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
      <UnitOpAccordion
        unitOperations={unitOperations}
        onChange={() => {}}
        availableTypes={DEFAULT_TYPES}
        sampleTypeColors={DEFAULT_COLORS}
      />
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
