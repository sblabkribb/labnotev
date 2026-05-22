import type { ReactNode } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

// `globals: true` (vitest.config.ts) keeps `vi`/`describe`/`it`/`expect`
// implicit, so this file deliberately avoids importing them.

vi.mock('../vscodeApi', () => ({
  postMessage: vi.fn(),
}));

import { postMessage } from '../vscodeApi';
import { HighlightedTextarea } from '../components/HighlightedTextarea';

function renderWithMantine(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

function getTextarea(container: HTMLElement): HTMLTextAreaElement {
  const ta = container.querySelector('textarea') as HTMLTextAreaElement | null;
  if (!ta) throw new Error('textarea not found');
  return ta;
}

function selectRange(ta: HTMLTextAreaElement, start: number, end: number) {
  ta.focus();
  ta.setSelectionRange(start, end);
  // jsdom does not auto-fire onSelect when setSelectionRange is called
  // programmatically. The component listens to onSelect/onMouseUp/onKeyUp;
  // dispatching `select` mimics what happens during a real drag.
  fireEvent.select(ta);
}

function getSendButton(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector(
    'button[aria-label="Send selection to Chat"]'
  ) as HTMLButtonElement | null;
}

describe('HighlightedTextarea — Send to Chat', () => {
  beforeEach(() => {
    (postMessage as unknown as { mockClear: () => void }).mockClear();
  });

  it('does not render the floating button when there is no selection', () => {
    const { container } = renderWithMantine(
      <HighlightedTextarea value="hello world" onChange={() => {}} />
    );
    const ta = getTextarea(container);
    ta.focus();
    fireEvent.select(ta);
    expect(getSendButton(container)).toBeNull();
  });

  it('renders the floating button after a selection and posts the payload on click', () => {
    const { container } = renderWithMantine(
      <HighlightedTextarea
        value="hello world"
        onChange={() => {}}
        chatContextOpId="UHW010"
        chatContextSectionHeading="Method"
      />
    );
    const ta = getTextarea(container);
    selectRange(ta, 0, 5); // selects "hello"

    const btn = getSendButton(container);
    if (!btn) throw new Error('Send-to-Chat button should be visible');
    fireEvent.click(btn);

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith({
      type: 'sendSelectionToChat',
      data: {
        selectedText: 'hello',
        chatContextOpId: 'UHW010',
        chatContextSectionHeading: 'Method',
      },
    });
  });

  it('sends the same payload on Ctrl+Alt+L and does NOT delegate the shortcut to external onKeyDown', () => {
    const externalKeyDown = vi.fn();
    const { container } = renderWithMantine(
      <HighlightedTextarea
        value="hello world"
        onChange={() => {}}
        onKeyDown={externalKeyDown}
        chatContextSectionHeading="Method"
      />
    );
    const ta = getTextarea(container);
    selectRange(ta, 0, 5);

    fireEvent.keyDown(ta, { key: 'l', ctrlKey: true, altKey: true });

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'sendSelectionToChat',
        data: expect.objectContaining({ selectedText: 'hello' }),
      })
    );
    expect(externalKeyDown).not.toHaveBeenCalled();
  });

  it('ignores Ctrl+Alt+L when there is no selection', () => {
    const { container } = renderWithMantine(
      <HighlightedTextarea value="hello world" onChange={() => {}} />
    );
    const ta = getTextarea(container);
    ta.focus();
    ta.setSelectionRange(0, 0);
    fireEvent.keyDown(ta, { key: 'l', ctrlKey: true, altKey: true });

    expect(postMessage).not.toHaveBeenCalled();
  });

  it('delegates non-shortcut keys (e.g. Enter) to external onKeyDown', () => {
    const externalKeyDown = vi.fn();
    const { container } = renderWithMantine(
      <HighlightedTextarea
        value="hello world"
        onChange={() => {}}
        onKeyDown={externalKeyDown}
      />
    );
    const ta = getTextarea(container);
    ta.focus();

    fireEvent.keyDown(ta, { key: 'Enter' });

    expect(externalKeyDown).toHaveBeenCalledTimes(1);
    expect(postMessage).not.toHaveBeenCalled();
  });

  it('prevents default on the button mousedown so the textarea keeps focus and the selection survives', () => {
    const { container } = renderWithMantine(
      <HighlightedTextarea value="hello world" onChange={() => {}} />
    );
    const ta = getTextarea(container);
    selectRange(ta, 0, 5);

    const btn = getSendButton(container);
    if (!btn) throw new Error('button should be visible');
    const evt = fireEvent.mouseDown(btn);
    // `fireEvent` returns the prevented status (false when defaultPrevented).
    expect(evt).toBe(false);
  });
});
