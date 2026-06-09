import { render, screen, act, fireEvent } from '@testing-library/react';
import App from '../App';
import type { LabNoteDocument } from '../types';

// This test asserts App does NOT render its body twice per keystroke. The find
// effect runs on every keystroke (labNote/workflow are in its deps); if it
// unconditionally calls `setFindMatches([])` (a fresh array), it schedules a
// second App render pass even while the find bar is closed.
//
// We count App render passes with a NON-memoized mock child: a non-memoized
// child re-renders once per parent (App) render, so its render count equals
// the number of App render passes. HighlightedTextarea is mocked to a plain
// controlled textarea so typing flows through the real setLabNote path.
const counts = vi.hoisted(() => ({ fm: 0 }));

vi.mock('../components/HighlightedTextarea', async () => {
  const { forwardRef } = await import('react');
  return {
    HighlightedTextarea: forwardRef(function MockHighlightedTextarea(
      props: { value: string; onChange: (v: string) => void; chatContextSectionHeading?: string; ariaLabel?: string },
      ref: React.Ref<HTMLTextAreaElement>
    ) {
      const key = props.chatContextSectionHeading ?? props.ariaLabel ?? 'unknown';
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

// Intentionally NOT wrapped in memo: this makes the render counter track App's
// render passes (a memoized child would skip the second, bail-only pass).
vi.mock('../components/FrontMatterForm', () => ({
  FrontMatterForm: function MockFrontMatterForm() {
    counts.fm += 1;
    return <div data-testid="front-matter-form" />;
  },
}));

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

describe('App find effect does not double-render per keystroke', () => {
  beforeEach(() => {
    counts.fm = 0;
    vi.clearAllMocks();
  });

  it('renders App exactly once per keystroke while the find bar is closed', async () => {
    render(<App />);

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'init', data: { mode: 'labnote', labNote: mockLabNote } },
        })
      );
    });

    const textarea = screen.getByLabelText(OBJECTIVE_HEADING) as HTMLTextAreaElement;

    // Warm-up keystroke: flips saveStatus to 'unsaved' so the measured
    // keystroke below does not incur that one-time extra render.
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'Test objective.' } });
    });

    counts.fm = 0;
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'Test objective..' } });
    });

    // One keystroke => one App render pass. Before the fix, the find effect
    // schedules a second pass via setFindMatches([]).
    expect(counts.fm).toBe(1);
  });
});
