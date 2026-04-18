import type { ReactNode } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { HighlightedTextarea } from '../components/HighlightedTextarea';

function renderWithMantine(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

function getTextarea(container: HTMLElement): HTMLTextAreaElement {
  const ta = container.querySelector('textarea') as HTMLTextAreaElement | null;
  if (!ta) throw new Error('textarea not found');
  return ta;
}

function getOverlay(container: HTMLElement): HTMLDivElement | null {
  const ta = getTextarea(container);
  const parent = ta.parentElement as HTMLElement | null;
  if (!parent) return null;
  return parent.querySelector('div') as HTMLDivElement | null;
}

// Phase A-1: SampleHighlighter no longer ships hard-coded built-in types or
// colors — the extension must inject them through init/customTypesUpdated. The
// tests must mirror that contract so the overlay has something to render.
const DEFAULT_TYPES = ['DNA', 'RNA', 'Plasmid', 'Reagent', 'Primer', 'Protein', 'Equip', 'Labware'];
const DEFAULT_COLORS: Record<string, string> = {
  DNA: '#FFB6C1', RNA: '#87CEEB', Plasmid: '#FFFACD', Reagent: '#DDA0DD',
  Primer: '#B0E0E6', Protein: '#F0E68C', Equip: '#A9A9A9', Labware: '#C0C0C0',
};

describe('HighlightedTextarea', () => {
  describe('layer z-index (sample content)', () => {
    it('renders overlay above textarea with pointer-events:none', () => {
      const { container } = renderWithMantine(
        <HighlightedTextarea
          value="샘플 DNA-001 사용"
          onChange={() => {}}
          availableTypes={DEFAULT_TYPES}
          sampleTypeColors={DEFAULT_COLORS}
        />
      );
      const overlay = getOverlay(container);
      const textarea = getTextarea(container);
      if (!overlay) throw new Error('overlay should render when samples are present');

      const overlayZ = Number(overlay.style.zIndex);
      const textareaZ = Number(textarea.style.zIndex);
      expect(Number.isFinite(overlayZ)).toBe(true);
      expect(Number.isFinite(textareaZ)).toBe(true);
      expect(overlayZ).toBeGreaterThan(textareaZ);
      expect(overlay.style.pointerEvents).toBe('none');
    });
  });

  describe('layer z-index (no samples)', () => {
    it('does not render an overlay when content has no sample ids', () => {
      const { container } = renderWithMantine(
        <HighlightedTextarea value="plain text only" onChange={() => {}} />
      );
      const textarea = getTextarea(container);
      const parent = textarea.parentElement as HTMLElement;
      const overlayCandidate = parent.querySelector('div');
      expect(overlayCandidate).toBeNull();
    });
  });

  describe('onChange / onCursorChange wiring', () => {
    it('fires onChange when user types into textarea', () => {
      const onChange = vi.fn();
      const { container } = renderWithMantine(
        <HighlightedTextarea value="hello" onChange={onChange} />
      );
      const textarea = getTextarea(container);
      fireEvent.change(textarea, { target: { value: 'hello world' } });
      expect(onChange).toHaveBeenCalledWith('hello world');
    });

    it('fires onCursorChange on click and keyup', () => {
      const onCursorChange = vi.fn();
      const { container } = renderWithMantine(
        <HighlightedTextarea
          value="abcdef"
          onChange={() => {}}
          onCursorChange={onCursorChange}
        />
      );
      const textarea = getTextarea(container);
      textarea.selectionStart = 3;
      textarea.selectionEnd = 3;
      fireEvent.click(textarea);
      expect(onCursorChange).toHaveBeenCalledWith(3);
      onCursorChange.mockClear();
      textarea.selectionStart = 5;
      textarea.selectionEnd = 5;
      fireEvent.keyUp(textarea, { key: 'ArrowRight' });
      expect(onCursorChange).toHaveBeenCalledWith(5);
    });
  });

  describe('sample token click-through (Phase B-2)', () => {
    it('moves the textarea caret to the click position when a sample span is clicked', () => {
      const onCursorChange = vi.fn();
      const { container } = renderWithMantine(
        <HighlightedTextarea
          value="prefix DNA-001 suffix"
          onChange={() => {}}
          onCursorChange={onCursorChange}
          availableTypes={DEFAULT_TYPES}
          sampleTypeColors={DEFAULT_COLORS}
        />
      );

      const textarea = getTextarea(container);
      // Grab the sample span rendered inside the overlay. In interactive mode
      // the span is wrapped in a Mantine HoverCard.Target, so query by style
      // color instead of a specific DOM nesting.
      const spans = container.querySelectorAll('span');
      const sampleSpan = Array.from(spans).find(
        (s) => s.textContent === 'DNA-001'
      );
      if (!sampleSpan) throw new Error('sample span not rendered');

      // jsdom does not implement caretPositionFromPoint, so the handler falls
      // back to "end-of-span" which is the end of "prefix DNA-001" → offset 14.
      fireEvent.mouseDown(sampleSpan, { clientX: 0, clientY: 0 });

      expect(document.activeElement).toBe(textarea);
      expect(textarea.selectionStart).toBe('prefix DNA-001'.length);
      expect(textarea.selectionEnd).toBe('prefix DNA-001'.length);
      expect(onCursorChange).toHaveBeenCalledWith('prefix DNA-001'.length);
    });
  });

  describe('minRows prop', () => {
    it('applies calculated minHeight from minRows (default 4)', () => {
      const { container } = renderWithMantine(
        <HighlightedTextarea value="" onChange={() => {}} />
      );
      const textarea = getTextarea(container);
      const expected = `${4 * 1.55 * 13 + 16}px`;
      expect(textarea.style.minHeight).toBe(expected);
    });

    it('honors explicit minRows=2', () => {
      const { container } = renderWithMantine(
        <HighlightedTextarea value="" onChange={() => {}} minRows={2} />
      );
      const textarea = getTextarea(container);
      const expected = `${2 * 1.55 * 13 + 16}px`;
      expect(textarea.style.minHeight).toBe(expected);
    });
  });
});
