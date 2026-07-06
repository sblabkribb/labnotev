import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { WorkflowChecklist, moveWorkflowItem } from '../components/WorkflowChecklist';
import type { WorkflowReference } from '../types';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MantineProvider>{children}</MantineProvider>
);

const items: WorkflowReference[] = [
  { checked: false, title: '001 WD010 Design', link: './001_WD010_Design.labnote.md' },
  { checked: true, title: '002 WT010 Test', link: './002_WT010_Test.labnote.md' },
  { checked: false, title: '003 WX010 Extra', link: './003_WX010_Extra.labnote.md' },
];

describe('moveWorkflowItem', () => {
  it('moves an item down, swapping with the next', () => {
    const result = moveWorkflowItem(items, 0, 'down');
    expect(result.map(i => i.link)).toEqual([
      './002_WT010_Test.labnote.md',
      './001_WD010_Design.labnote.md',
      './003_WX010_Extra.labnote.md',
    ]);
  });

  it('moves an item up, swapping with the previous', () => {
    const result = moveWorkflowItem(items, 2, 'up');
    expect(result.map(i => i.link)).toEqual([
      './001_WD010_Design.labnote.md',
      './003_WX010_Extra.labnote.md',
      './002_WT010_Test.labnote.md',
    ]);
  });

  it('is a no-op moving the first item up', () => {
    expect(moveWorkflowItem(items, 0, 'up').map(i => i.link)).toEqual(items.map(i => i.link));
  });

  it('is a no-op moving the last item down', () => {
    expect(moveWorkflowItem(items, 2, 'down').map(i => i.link)).toEqual(items.map(i => i.link));
  });

  it('preserves checked/title/link of moved items', () => {
    const result = moveWorkflowItem(items, 1, 'up');
    expect(result[0]).toEqual({ checked: true, title: '002 WT010 Test', link: './002_WT010_Test.labnote.md' });
    expect(result[1]).toEqual({ checked: false, title: '001 WD010 Design', link: './001_WD010_Design.labnote.md' });
  });

  it('does not mutate the input array', () => {
    const copy = items.map(i => ({ ...i }));
    moveWorkflowItem(items, 0, 'down');
    expect(items).toEqual(copy);
  });
});

describe('WorkflowChecklist reorder buttons', () => {
  it('calls onChange with the reordered array when moving down', () => {
    const onChange = vi.fn();
    render(<WorkflowChecklist items={items} onChange={onChange} />, { wrapper });
    const downButtons = screen.getAllByRole('button', { name: 'Move workflow down' });
    fireEvent.click(downButtons[0]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].map((i: WorkflowReference) => i.link)).toEqual([
      './002_WT010_Test.labnote.md',
      './001_WD010_Design.labnote.md',
      './003_WX010_Extra.labnote.md',
    ]);
  });

  it('calls onChange with the reordered array when moving up', () => {
    const onChange = vi.fn();
    render(<WorkflowChecklist items={items} onChange={onChange} />, { wrapper });
    const upButtons = screen.getAllByRole('button', { name: 'Move workflow up' });
    fireEvent.click(upButtons[2]);
    expect(onChange.mock.calls[0][0].map((i: WorkflowReference) => i.link)).toEqual([
      './001_WD010_Design.labnote.md',
      './003_WX010_Extra.labnote.md',
      './002_WT010_Test.labnote.md',
    ]);
  });

  it('disables the up button on the first item and the down button on the last', () => {
    const onChange = vi.fn();
    render(<WorkflowChecklist items={items} onChange={onChange} />, { wrapper });
    const upButtons = screen.getAllByRole('button', { name: 'Move workflow up' }) as HTMLButtonElement[];
    const downButtons = screen.getAllByRole('button', { name: 'Move workflow down' }) as HTMLButtonElement[];
    expect(upButtons[0].disabled).toBe(true);
    expect(downButtons[downButtons.length - 1].disabled).toBe(true);
    expect(upButtons[1].disabled).toBe(false);
    expect(downButtons[0].disabled).toBe(false);
  });

  it('still toggles the checkbox (no regression)', () => {
    const onChange = vi.fn();
    render(<WorkflowChecklist items={items} onChange={onChange} />, { wrapper });
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    fireEvent.click(checkboxes[0]);
    expect(onChange.mock.calls[0][0][0].checked).toBe(true);
  });
});
