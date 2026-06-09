import { useCallback, useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { UnitOperationBlock } from '../types';
import { UnitOpAccordion } from '../components/UnitOpAccordion';

// Probe: `getCursorForSection` is invoked once per section during EACH
// SortableUnitOp render (UnitOpAccordion line ~534). Counting invocations per
// opIndex therefore measures how many times that UnitOp's chrome re-rendered.
// This targets the chrome directly: mocking the memoized child
// UnitOpSectionTextarea / HighlightedTextarea would mask the bug, because an
// unedited UO's child keeps stable props and skips even when its chrome
// re-renders from dnd-kit's SortableContext context churn.
const cursorCalls = { byOp: {} as Record<number, number> };

// HighlightedTextarea is the input mechanism only (not the probe): replace it
// with a plain controlled textarea so a keystroke is easy to drive.
vi.mock('../components/HighlightedTextarea', async () => {
  const { forwardRef } = await import('react');
  return {
    HighlightedTextarea: forwardRef(function MockHighlightedTextarea(
      props: { value: string; onChange: (v: string) => void; chatContextOpId?: string; chatContextSectionHeading?: string },
      ref: React.Ref<HTMLTextAreaElement>
    ) {
      const label = `${props.chatContextOpId ?? '?'}:${props.chatContextSectionHeading ?? '?'}`;
      return (
        <textarea
          ref={ref}
          aria-label={label}
          value={props.value}
          onChange={(e) => props.onChange(e.currentTarget.value)}
        />
      );
    }),
  };
});

function makeOp(id: string, opId: string): UnitOperationBlock {
  return {
    id,
    opId,
    opName: 'Op',
    opDescription: '',
    opType: 'hw',
    sections: [{ heading: 'Input', content: '' }],
  };
}

function Harness({ initial }: { initial: UnitOperationBlock[] }) {
  const [ops, setOps] = useState(initial);
  // Stable identity: a churn-y getCursorForSection would itself re-render
  // every SortableUnitOp and invalidate the probe.
  const getCursorForSection = useCallback((opIndex: number) => {
    cursorCalls.byOp[opIndex] = (cursorCalls.byOp[opIndex] ?? 0) + 1;
    return null;
  }, []);
  const onOpenedChange = useCallback(() => {}, []);
  return (
    <MantineProvider>
      <UnitOpAccordion
        unitOperations={ops}
        onChange={setOps}
        getCursorForSection={getCursorForSection}
        openedOpIds={ops.map((o) => o.id)}
        onOpenedChange={onOpenedChange}
      />
    </MantineProvider>
  );
}

describe('UnitOpAccordion re-render isolation (workflow many-UO)', () => {
  beforeEach(() => {
    cursorCalls.byOp = {};
    vi.clearAllMocks();
  });

  it('typing in one UnitOp does not re-render sibling UnitOps', () => {
    render(<Harness initial={[makeOp('op-1', 'UHW010'), makeOp('op-2', 'UHW020')]} />);

    // sanity: both UnitOps mounted (their chrome rendered at least once)
    expect(cursorCalls.byOp[0] ?? 0).toBeGreaterThan(0);
    const op1Before = cursorCalls.byOp[1] ?? 0;
    expect(op1Before).toBeGreaterThan(0);

    const ta = screen.getByLabelText('UHW010:Input') as HTMLTextAreaElement;
    act(() => {
      fireEvent.change(ta, { target: { value: 'typed' } });
    });

    // the edited UO reflects the new value...
    expect((screen.getByLabelText('UHW010:Input') as HTMLTextAreaElement).value).toBe('typed');
    // ...but the untouched sibling UO must NOT have re-rendered.
    const op1After = cursorCalls.byOp[1] ?? 0;
    expect(op1After).toBe(op1Before);
  });
});
