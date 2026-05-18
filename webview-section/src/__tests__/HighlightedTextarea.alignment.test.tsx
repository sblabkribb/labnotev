import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { HighlightedTextarea } from '../components/HighlightedTextarea';

/**
 * Regression: caret used to appear one visual line below the actual input
 * position whenever a sample token was present on the same wrapped line.
 *
 * Root cause was a 2px content-width drift between the textarea (1px border
 * + 8px padding inside a border-box layout) and the overlay div (no border,
 * 8px padding only). In monospace 13px that drift was just enough for a word
 * to slip onto the next line in the overlay only, shifting the visual line
 * of every offset that came after.
 *
 * These tests assert the layout invariant that fixed it: the textarea and
 * overlay must share box-sizing, padding, and a 1px border footprint.
 */

function renderWithMantine(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

function getTextarea(container: HTMLElement): HTMLTextAreaElement {
  const ta = container.querySelector('textarea') as HTMLTextAreaElement | null;
  if (!ta) throw new Error('textarea not found');
  return ta;
}

function getOverlay(container: HTMLElement): HTMLDivElement {
  const ta = getTextarea(container);
  const parent = ta.parentElement as HTMLElement | null;
  if (!parent) throw new Error('textarea parent not found');
  const overlay = parent.querySelector('div') as HTMLDivElement | null;
  if (!overlay) throw new Error('overlay not rendered; sample token required');
  return overlay;
}

const DEFAULT_TYPES = ['DNA', 'RNA', 'Reagent', 'Equip', 'Labware'];
const DEFAULT_COLORS: Record<string, string> = {
  DNA: '#FFB6C1',
  RNA: '#87CEEB',
  Reagent: '#DDA0DD',
  Equip: '#A9A9A9',
  Labware: '#C0C0C0',
};

function renderWithSamples() {
  return renderWithMantine(
    <HighlightedTextarea
      value="contains Labware-001 token"
      onChange={() => {}}
      availableTypes={DEFAULT_TYPES}
      sampleTypeColors={DEFAULT_COLORS}
    />
  );
}

describe('HighlightedTextarea overlay/textarea content-box alignment', () => {
  it('applies box-sizing: border-box to both textarea and overlay', () => {
    const { container } = renderWithSamples();
    const ta = getTextarea(container);
    const overlay = getOverlay(container);
    expect(ta.style.boxSizing).toBe('border-box');
    expect(overlay.style.boxSizing).toBe('border-box');
  });

  it('gives textarea and overlay the same 8px padding', () => {
    const { container } = renderWithSamples();
    const ta = getTextarea(container);
    const overlay = getOverlay(container);
    expect(ta.style.padding).toBe('8px');
    expect(overlay.style.padding).toBe('8px');
  });

  it('gives the overlay a 1px (transparent) border to match the textarea border footprint', () => {
    const { container } = renderWithSamples();
    const ta = getTextarea(container);
    const overlay = getOverlay(container);
    // jsdom does not always expose `border` shorthand consistently; rely on
    // the explicit border-width that React serialises from the longhand it
    // builds out of the shorthand `'1px solid ...'` style entry.
    expect(ta.style.borderTopWidth || ta.style.border.split(' ')[0]).toMatch(/^1px$/);
    expect(
      overlay.style.borderTopWidth || overlay.style.border.split(' ')[0]
    ).toMatch(/^1px$/);
  });

  it('honours the new minHeight formula that accounts for padding + border (16 + 2)', () => {
    const { container } = renderWithMantine(
      <HighlightedTextarea value="" onChange={() => {}} minRows={3} />
    );
    const ta = getTextarea(container);
    const expected = `${3 * 1.55 * 13 + 18}px`;
    expect(ta.style.minHeight).toBe(expected);
  });
});
