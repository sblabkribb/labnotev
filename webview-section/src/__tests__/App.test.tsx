import { render, screen, act, fireEvent } from '@testing-library/react';
import App from '../App';
import type { LabNoteDocument, WorkflowDocument } from '../types';

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

const mockWorkflow: WorkflowDocument = {
  frontMatter: {
    title: 'WD010 Test',
    experimenter: '홍길동',
    created_date: '2026-01-15',
    last_updated_date: '2026-01-20',
    end_date: '',
  },
  workflowHeader: '[WD010 Test]',
  workflowDescription: 'Test description',
  unitOperations: [],
  tailContent: '',
};

function simulateMessage(data: any) {
  window.dispatchEvent(new MessageEvent('message', { data }));
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading state initially', () => {
    render(<App />);
    // Loader should be visible before init message
    expect(document.querySelector('.mantine-Loader-root')).toBeTruthy();
  });

  it('should render labnote mode after init message', async () => {
    render(<App />);

    await act(async () => {
      simulateMessage({
        type: 'init',
        data: { mode: 'labnote', labNote: mockLabNote },
      });
    });

    expect(screen.getByText(/Lab Note/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Experiment')).toBeInTheDocument();
  });

  it('should render workflow mode after init message', async () => {
    render(<App />);

    await act(async () => {
      simulateMessage({
        type: 'init',
        data: { mode: 'workflow', workflow: mockWorkflow },
      });
    });

    expect(screen.getByText(/Workflow.*Section Editor/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('WD010 Test')).toBeInTheDocument();
  });

  it('should render unknown mode message', async () => {
    render(<App />);

    await act(async () => {
      simulateMessage({
        type: 'init',
        data: { mode: 'unknown' },
      });
    });

    expect(screen.getByText(/not in Lab Note or Workflow format/)).toBeInTheDocument();
  });

  // Phase C-3 regression: `sampleDefinitionCreated` used to route by the
  // numeric `opIndex` the webview sent when opening the create-sample modal.
  // If the user reordered unit operations between clicking "Create Sample" and the
  // extension echoing back the definition, the message landed in the wrong
  // section. Phase C-1 switched the handler to prefer `opId` + `secHeading`
  // when both sides agree on them, so the definition follows the op even
  // after reordering.
  it('routes sampleDefinitionCreated to the op matching opId, not the original opIndex', async () => {
    const twoOps: WorkflowDocument = {
      ...mockWorkflow,
      unitOperations: [
        {
          id: 'uo-a',
          opId: 'UO_A',
          opName: 'Op A',
          opDescription: '',
          opType: 'hw',
          sections: [{ heading: 'Samples', content: '' }],
        },
        {
          id: 'uo-b',
          opId: 'UO_B',
          opName: 'Op B',
          opDescription: '',
          opType: 'hw',
          sections: [{ heading: 'Samples', content: '' }],
        },
      ],
    };

    render(<App />);

    await act(async () => {
      simulateMessage({ type: 'init', data: { mode: 'workflow', workflow: twoOps } });
    });

    // The extension echoes back the original opIndex=1 (UO_B's slot at creation
    // time) plus opId='UO_B'. In this test we mimic the "already reordered"
    // state by passing an opIndex that now points at the *wrong* op. The
    // id-based lookup must win.
    await act(async () => {
      simulateMessage({
        type: 'sampleDefinitionCreated',
        data: {
          sampleType: 'DNA',
          definitionText: '@dna;DNA-1;alias',
          opIndex: 0,
          secIndex: 0,
          opId: 'UO_B',
          secHeading: 'Samples',
        },
      });
    });

    // UO_B's "Samples" section should receive the definition; UO_A's shouldn't.
    const textareas = Array.from(
      document.querySelectorAll('textarea')
    ) as HTMLTextAreaElement[];
    const withDefinition = textareas.filter(t => t.value.includes('@dna;DNA-1;alias'));
    expect(withDefinition.length).toBe(1);
  });

  // v0.54.4: Title -> Workflow Header sync. Previously updateWorkflowFm only
  // mutated frontMatter[key] which meant editing Title left workflowHeader stale.
  // The new branch rebuilds [idName] desc from `${idName} - ${desc}` so both
  // representations stay in sync, mirroring the existing Header -> Title path.
  it('syncs workflowHeader when title with " - " separator is edited', async () => {
    render(<App />);

    await act(async () => {
      simulateMessage({ type: 'init', data: { mode: 'workflow', workflow: mockWorkflow } });
    });

    const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
    expect(titleInput.value).toBe('WD010 Test');

    await act(async () => {
      fireEvent.change(titleInput, { target: { value: 'WB150 PCR - 진행' } });
    });

    // Bracket part rendered by `## [...]` Text node should follow the new idName
    expect(screen.getByText('[WB150 PCR]')).toBeTruthy();

    // The Workflow Header description input (the one that edits the suffix) should
    // now display the new description portion.
    const descInput = screen.getByDisplayValue('진행') as HTMLInputElement;
    expect(descInput).toBeTruthy();
  });

  // Regression for the message-handler stale-closure fix: `textInserted` now
  // reads the current section content from refs (not the render scope captured
  // when the handler effect mounted), so inserting into a focused section that
  // was populated by a later `init` splices into the up-to-date content.
  it('inserts textInserted into the focused labnote section using current content', async () => {
    render(<App />);

    await act(async () => {
      simulateMessage({ type: 'init', data: { mode: 'labnote', labNote: mockLabNote } });
    });

    const textareas = Array.from(document.querySelectorAll('textarea')) as HTMLTextAreaElement[];
    const objective = textareas.find(t => t.value === 'Test objective');
    expect(objective).toBeTruthy();

    objective!.selectionStart = objective!.selectionEnd = objective!.value.length;
    await act(async () => {
      fireEvent.focus(objective!);
    });

    await act(async () => {
      simulateMessage({ type: 'textInserted', data: { text: ' INSERTED' } });
    });

    expect(objective!.value).toBe('Test objective INSERTED');
  });

  // Issue #33 regression: after v0.60.7 introduced per-section drafts
  // (useDraftValue), the live textarea value diverges from App's committed
  // content while typing. An insertion that splices into the *committed*
  // (lagging) content corrupts the section (mid-line cut / lost typing). The
  // splice must use the *live* value the caret indexes.
  it('inserts textInserted into the live (uncommitted) labnote draft, not the lagging committed content', async () => {
    const ln: LabNoteDocument = {
      ...mockLabNote,
      sections: [
        { type: 'objective', content: 'AAA' },
        { type: 'workflows', items: [] },
        { type: 'results', content: 'Test results' },
      ],
    };

    render(<App />);
    await act(async () => {
      simulateMessage({ type: 'init', data: { mode: 'labnote', labNote: ln } });
    });

    const textareas = Array.from(document.querySelectorAll('textarea')) as HTMLTextAreaElement[];
    const objective = textareas.find(t => t.value === 'AAA')!;
    expect(objective).toBeTruthy();

    await act(async () => {
      fireEvent.focus(objective);
    });
    // Type so the local draft (live value) grows past the committed 'AAA'
    // WITHOUT letting the debounce commit it back to App.
    await act(async () => {
      fireEvent.change(objective, { target: { value: 'AAAZ\nBBB' } });
    });
    objective.selectionStart = objective.selectionEnd = 'AAAZ\nBBB'.length;
    await act(async () => {
      fireEvent.keyUp(objective);
    });

    await act(async () => {
      simulateMessage({ type: 'textInserted', data: { text: ' INS' } });
    });

    // Live value preserved, insertion at the live caret (end). The buggy path
    // would splice into 'AAA' and yield 'AAA INS', losing 'Z\nBBB'.
    expect(objective.value).toBe('AAAZ\nBBB INS');
  });

  // Issue #33 (reported path): +Sample modal -> sampleDefinitionCreated. With a
  // diverged draft, splicing into the committed content cuts the line in the
  // middle. The definition must land at the live caret inside the live value.
  it('splices sampleDefinitionCreated into the live unit-op draft at the live caret', async () => {
    const wf: WorkflowDocument = {
      ...mockWorkflow,
      unitOperations: [
        {
          id: 'uo-a',
          opId: 'UO_A',
          opName: 'Op A',
          opDescription: '',
          opType: 'hw',
          sections: [{ heading: 'Samples', content: 'XX' }],
        },
      ],
    };

    render(<App />);
    await act(async () => {
      simulateMessage({ type: 'init', data: { mode: 'workflow', workflow: wf } });
    });

    const textareas = Array.from(document.querySelectorAll('textarea')) as HTMLTextAreaElement[];
    const sec = textareas.find(t => t.value === 'XX')!;
    expect(sec).toBeTruthy();

    await act(async () => {
      fireEvent.focus(sec);
    });
    await act(async () => {
      fireEvent.change(sec, { target: { value: 'XXXX\nYYYY' } });
    });
    // Caret at the start of the second line (offset 5).
    sec.selectionStart = sec.selectionEnd = 5;
    await act(async () => {
      fireEvent.keyUp(sec);
    });

    await act(async () => {
      simulateMessage({
        type: 'sampleDefinitionCreated',
        data: {
          definitionText: '- @dna;DNA-1',
          opIndex: 0,
          secIndex: 0,
          opId: 'UO_A',
          secHeading: 'Samples',
        },
      });
    });

    // Live first line intact ('XXXX'), definition at the live caret, rest kept.
    // The buggy path splices into committed 'XX' -> 'XX\n- @dna;DNA-1'.
    expect(sec.value).toBe('XXXX\n- @dna;DNA-1YYYY');
  });

  // When the extension reports a failed save, the editor must not stay stuck
  // showing "Saving"; it returns to the unsaved state.
  it('marks the editor unsaved when a saveFailed message arrives', async () => {
    render(<App />);

    await act(async () => {
      simulateMessage({ type: 'init', data: { mode: 'labnote', labNote: mockLabNote } });
    });

    await act(async () => {
      simulateMessage({ type: 'saveFailed' });
    });

    expect(screen.getByText(/Unsaved/i)).toBeInTheDocument();
  });

  it('syncs workflowHeader to bracket-only form when title has no " - " separator', async () => {
    render(<App />);

    await act(async () => {
      simulateMessage({ type: 'init', data: { mode: 'workflow', workflow: mockWorkflow } });
    });

    const titleInput = screen.getByLabelText('Title') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(titleInput, { target: { value: 'WD010 NewName' } });
    });

    expect(screen.getByText('[WD010 NewName]')).toBeTruthy();

    // No " - " separator => description part is empty. The Header description
    // <TextInput> should now hold ''.
    const headerDescInputs = Array.from(
      document.querySelectorAll('input[placeholder="Add description"]')
    ) as HTMLInputElement[];
    expect(headerDescInputs.length).toBeGreaterThan(0);
    expect(headerDescInputs[0].value).toBe('');
  });
});
