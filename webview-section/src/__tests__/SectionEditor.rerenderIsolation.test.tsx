import { render, screen, act, fireEvent } from '@testing-library/react';
import App from '../App';
import type { LabNoteDocument } from '../types';

// Count how many times each section's HighlightedTextarea renders, keyed by the
// section heading (passed through as `chatContextSectionHeading`). The real
// HighlightedTextarea is mocked with a minimal controlled textarea so this test
// isolates the re-render behaviour driven by App + SectionEditor memoization,
// not the overlay/resize internals.
const counts = vi.hoisted(() => ({ map: {} as Record<string, number> }));

vi.mock('../components/HighlightedTextarea', async () => {
  const { forwardRef } = await import('react');
  return {
    HighlightedTextarea: forwardRef(function MockHighlightedTextarea(
      props: { value: string; onChange: (v: string) => void; chatContextSectionHeading?: string; ariaLabel?: string },
      ref: React.Ref<HTMLTextAreaElement>
    ) {
      const key = props.chatContextSectionHeading ?? props.ariaLabel ?? 'unknown';
      counts.map[key] = (counts.map[key] ?? 0) + 1;
      return (
        <textarea
          ref={ref}
          aria-label={key}
          value={props.value}
          onChange={(e) => props.onChange(e.currentTarget.value)}
        />
      );
    }),
  };
});

const mockLabNote: LabNoteDocument = {
  frontMatter: {
    title: 'Test Experiment',
    author: '홍길동',
    experiment_type: 'labnote',
    sample_tracking: true,
    created_date: '2026-01-15',
    last_updated_date: '2026-01-20',
  },
  sections: [
    { type: 'objective', content: 'Test objective' },
    { type: 'workflows', items: [] },
    { type: 'results', content: 'Test results' },
  ],
};

const OBJECTIVE_HEADING = '🎯 Experiment Objective';
const RESULTS_HEADING = '📊 Results & Discussion';

describe('SectionEditor re-render isolation (labnote)', () => {
  beforeEach(() => {
    counts.map = {};
    vi.clearAllMocks();
  });

  it('typing in one section does not re-render the other sections', async () => {
    render(<App />);

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'init', data: { mode: 'labnote', labNote: mockLabNote } },
        })
      );
    });

    const resultsBefore = counts.map[RESULTS_HEADING] ?? 0;
    expect(resultsBefore).toBeGreaterThan(0); // sanity: results section mounted

    const objectiveTextarea = screen.getByLabelText(OBJECTIVE_HEADING) as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(objectiveTextarea, { target: { value: 'Edited objective' } });
    });

    // The edited (objective) section must reflect the new value...
    expect((screen.getByLabelText(OBJECTIVE_HEADING) as HTMLTextAreaElement).value).toBe('Edited objective');
    // ...but the untouched results section must NOT have re-rendered.
    const resultsAfter = counts.map[RESULTS_HEADING] ?? 0;
    expect(resultsAfter).toBe(resultsBefore);
  });
});
