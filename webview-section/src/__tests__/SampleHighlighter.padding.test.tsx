import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { SampleHighlighter } from '../components/SampleHighlighter';

/**
 * Regression: previously the sample span carried `padding: '0 2px'`, which
 * added 4px of inline width per token. Because the underlying textarea has
 * no equivalent padding, that drift pushed the overlay's wrap positions out
 * of sync with the textarea's and made the caret appear one visual line off
 * on any wrapped line containing a token.
 *
 * The span must claim *exactly* the character width of its text content.
 * Visual emphasis comes from `color`, `fontWeight`, and a slightly stronger
 * `backgroundColor` alpha (22 vs the old 15).
 */

function renderWithMantine(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

const TYPES = ['DNA'];
const COLORS: Record<string, string> = { DNA: '#FFB6C1' };

function getTokenSpan(container: HTMLElement, tokenText: string): HTMLSpanElement {
  const spans = Array.from(container.querySelectorAll('span'));
  const span = spans.find((s) => s.textContent === tokenText);
  if (!span) throw new Error(`token span "${tokenText}" not rendered`);
  return span;
}

describe('SampleHighlighter token span character-grid alignment', () => {
  it('renders the token span without horizontal padding', () => {
    const { container } = renderWithMantine(
      <SampleHighlighter
        text="prefix DNA-001 suffix"
        availableTypes={TYPES}
        sampleTypeColors={COLORS}
      />
    );
    const span = getTokenSpan(container, 'DNA-001');
    // No inline padding of any kind. (We accept an empty string; jsdom
    // serialises an absent inline padding as ''.)
    expect(span.style.padding).toBe('');
    expect(span.style.paddingLeft).toBe('');
    expect(span.style.paddingRight).toBe('');
  });

  it('keeps the token visually distinct without padding by setting a non-empty background color', () => {
    const { container } = renderWithMantine(
      <SampleHighlighter
        text="prefix DNA-001 suffix"
        availableTypes={TYPES}
        sampleTypeColors={COLORS}
      />
    );
    const span = getTokenSpan(container, 'DNA-001');
    // Tinted background remains the only visual emphasis carrier after the
    // padding removal. The exact serialisation (#RRGGBBAA vs rgba()) varies
    // between jsdom versions, so we only assert that *some* non-empty bg is
    // applied and that it is not the old (15) alpha form.
    expect(span.style.backgroundColor).not.toBe('');
    expect(span.style.backgroundColor).not.toMatch(/15\)?$/i);
  });
});
