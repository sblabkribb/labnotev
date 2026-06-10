import { useCallback, useState } from 'react';
import { render, act, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import type { UnitOperationBlock } from '../types';
import { UnitOpAccordion } from '../components/UnitOpAccordion';
import * as vscodeApi from '../vscodeApi';

function makeOp(id: string, opId: string): UnitOperationBlock {
  return {
    id,
    opId,
    opName: 'Op',
    opDescription: '',
    opType: 'hw',
    sections: [{ heading: 'Input', content: 'SEC' }],
  };
}

// The accordion also renders a plain op-description Textarea (not draft-backed),
// so target the section's HighlightedTextarea by its seeded content instead of
// `querySelector('textarea')`.
function sectionTextarea(container: HTMLElement): HTMLTextAreaElement {
  const ta = Array.from(container.querySelectorAll('textarea')).find(
    (t) => t.value === 'SEC'
  );
  if (!ta) throw new Error('section textarea not found');
  return ta as HTMLTextAreaElement;
}

function Harness({
  initial,
  onCommitSpy,
}: {
  initial: UnitOperationBlock[];
  onCommitSpy: (ops: UnitOperationBlock[]) => void;
}) {
  const [ops, setOps] = useState(initial);
  const handleChange = useCallback(
    (next: UnitOperationBlock[]) => {
      onCommitSpy(next);
      setOps(next);
    },
    [onCommitSpy]
  );
  const getCursorForSection = useCallback(() => null, []);
  const onOpenedChange = useCallback(() => {}, []);
  return (
    <MantineProvider>
      <UnitOpAccordion
        unitOperations={ops}
        onChange={handleChange}
        getCursorForSection={getCursorForSection}
        openedOpIds={ops.map((o) => o.id)}
        onOpenedChange={onOpenedChange}
      />
    </MantineProvider>
  );
}

describe('UnitOpAccordion defers section commits via a local draft', () => {
  beforeEach(() => {
    vi.spyOn(vscodeApi, 'postMessage').mockImplementation(() => {});
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('typing in a UO section shows text immediately but does not commit synchronously', () => {
    const onCommit = vi.fn();
    const { container } = render(
      <Harness initial={[makeOp('op-1', 'UHW010')]} onCommitSpy={onCommit} />
    );
    const ta = sectionTextarea(container);

    act(() => {
      fireEvent.change(ta, { target: { value: 'SECab' } });
    });

    expect(ta.value).toBe('SECab');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits the edited section once after the debounce window', () => {
    const onCommit = vi.fn();
    const { container } = render(
      <Harness initial={[makeOp('op-1', 'UHW010')]} onCommitSpy={onCommit} />
    );
    const ta = sectionTextarea(container);

    act(() => {
      fireEvent.change(ta, { target: { value: 'SECab' } });
      fireEvent.change(ta, { target: { value: 'SECabc' } });
    });
    expect(onCommit).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0][0].sections[0].content).toBe('SECabc');
  });

  it('flushes the pending section draft on blur', () => {
    const onCommit = vi.fn();
    const { container } = render(
      <Harness initial={[makeOp('op-1', 'UHW010')]} onCommitSpy={onCommit} />
    );
    const ta = sectionTextarea(container);

    act(() => {
      fireEvent.change(ta, { target: { value: 'SECabXY' } });
    });
    expect(onCommit).not.toHaveBeenCalled();

    act(() => {
      fireEvent.blur(ta);
    });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0][0].sections[0].content).toBe('SECabXY');
  });
});
