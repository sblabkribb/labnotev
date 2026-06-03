import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { FindBar } from '../components/FindBar';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MantineProvider>{children}</MantineProvider>
);

function renderBar(overrides: Partial<React.ComponentProps<typeof FindBar>> = {}) {
  const props = {
    query: 'foo',
    onQueryChange: vi.fn(),
    caseSensitive: false,
    onToggleCase: vi.fn(),
    count: 3,
    activeIndex: 0,
    onNext: vi.fn(),
    onPrev: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<FindBar {...props} />, { wrapper });
  return props;
}

describe('FindBar', () => {
  it('shows the active/total count', () => {
    renderBar({ count: 3, activeIndex: 1 });
    // getByText throws if absent, so a truthy result asserts presence.
    expect(screen.getByText('2/3')).toBeTruthy();
  });

  it('shows "No results" when the query has no matches', () => {
    renderBar({ count: 0, activeIndex: -1 });
    expect(screen.getByText('No results')).toBeTruthy();
  });

  it('shows no count label for an empty query', () => {
    renderBar({ query: '', count: 0, activeIndex: -1 });
    expect(screen.queryByText('No results')).toBeNull();
  });

  it('calls onNext on Enter and onPrev on Shift+Enter', () => {
    const props = renderBar();
    const input = screen.getByLabelText('Find in editor');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onNext).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(props.onPrev).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape', () => {
    const props = renderBar();
    const input = screen.getByLabelText('Find in editor');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('wires the prev/next/close/case buttons', () => {
    const props = renderBar();
    fireEvent.click(screen.getByLabelText('Next match'));
    fireEvent.click(screen.getByLabelText('Previous match'));
    fireEvent.click(screen.getByLabelText('Close find'));
    fireEvent.click(screen.getByLabelText('Match case'));
    expect(props.onNext).toHaveBeenCalledTimes(1);
    expect(props.onPrev).toHaveBeenCalledTimes(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onToggleCase).toHaveBeenCalledTimes(1);
  });

  it('disables navigation buttons when there are no matches', () => {
    renderBar({ count: 0, activeIndex: -1 });
    expect(screen.getByLabelText('Next match').hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('Previous match').hasAttribute('disabled')).toBe(true);
  });

  it('updates the query through onQueryChange', () => {
    const props = renderBar();
    const input = screen.getByLabelText('Find in editor');
    fireEvent.change(input, { target: { value: 'bar' } });
    expect(props.onQueryChange).toHaveBeenCalledWith('bar');
  });
});
