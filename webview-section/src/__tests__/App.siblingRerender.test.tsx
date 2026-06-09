import { render, screen, act, fireEvent } from '@testing-library/react';
import App from '../App';
import type { LabNoteDocument } from '../types';

// Render counters for App's labnote-mode siblings. The mocks are wrapped in
// `memo` so they only re-render when their incoming props actually change.
// That makes the counters assert App's contract: it must hand these children
// referentially stable props (stable onChange) so they can skip re-rendering
// while the user types in a section. HighlightedTextarea is mocked to a plain
// controlled textarea so typing flows through the real SectionEditor ->
// handleLabNoteSectionChange -> setLabNote path.
const counts = vi.hoisted(() => ({ fm: 0, wc: 0 }));

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

vi.mock('../components/FrontMatterForm', async () => {
  const { memo } = await import('react');
  return {
    FrontMatterForm: memo(function MockFrontMatterForm() {
      counts.fm += 1;
      return <div data-testid="front-matter-form" />;
    }),
  };
});

vi.mock('../components/WorkflowChecklist', async () => {
  const { memo } = await import('react');
  return {
    WorkflowChecklist: memo(function MockWorkflowChecklist() {
      counts.wc += 1;
      return <div data-testid="workflow-checklist" />;
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

describe('App sibling re-render isolation (labnote)', () => {
  beforeEach(() => {
    counts.fm = 0;
    counts.wc = 0;
    vi.clearAllMocks();
  });

  it('typing in a section does not re-render FrontMatterForm or WorkflowChecklist', async () => {
    render(<App />);

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'init', data: { mode: 'labnote', labNote: mockLabNote } },
        })
      );
    });

    const fmBefore = counts.fm;
    const wcBefore = counts.wc;
    expect(fmBefore).toBeGreaterThan(0);
    expect(wcBefore).toBeGreaterThan(0);

    const objectiveTextarea = screen.getByLabelText(OBJECTIVE_HEADING) as HTMLTextAreaElement;
    await act(async () => {
      fireEvent.change(objectiveTextarea, { target: { value: 'Edited objective' } });
    });

    expect((screen.getByLabelText(OBJECTIVE_HEADING) as HTMLTextAreaElement).value).toBe('Edited objective');
    expect(counts.fm).toBe(fmBefore);
    expect(counts.wc).toBe(wcBefore);
  });
});
