import { render, screen, act, fireEvent } from '@testing-library/react';
import App from '../App';
import type { LabNoteDocument } from '../types';

// This test asserts that typing in a section does NOT re-render App at all
// while the find bar is closed. Section content now lives in a per-section
// local draft (useDraftValue): keystrokes update the draft subtree only, and
// the parent App is committed on a trailing debounce (or blur). So a keystroke
// triggers 0 App render passes; the commit (after the debounce) triggers 1.
//
// We count App render passes with a NON-memoized mock child: a non-memoized
// child re-renders once per parent (App) render, so its render count equals
// the number of App render passes. HighlightedTextarea is mocked to a plain
// controlled textarea so typing flows through the real draft -> setLabNote path.
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

describe('App is not re-rendered by section keystrokes (local draft)', () => {
  beforeEach(() => {
    counts.fm = 0;
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders App 0 times per keystroke while the find bar is closed, 1 on commit', () => {
    render(<App />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'init', data: { mode: 'labnote', labNote: mockLabNote } },
        })
      );
    });

    const textarea = screen.getByLabelText(OBJECTIVE_HEADING) as HTMLTextAreaElement;

    // Warm-up: type then flush so saveStatus is already 'unsaved' and the
    // measured commit below does not incur that one-time extra render.
    act(() => {
      fireEvent.change(textarea, { target: { value: 'Test objective.' } });
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Measured keystroke: updates only the section draft -> App must not render.
    counts.fm = 0;
    act(() => {
      fireEvent.change(textarea, { target: { value: 'Test objective..' } });
    });
    expect(counts.fm).toBe(0);

    // After the draft debounce flushes, App commits exactly once.
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(counts.fm).toBe(1);
  });
});
