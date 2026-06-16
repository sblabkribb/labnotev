import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
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

  // Issue #34: consecutive registrations without re-focusing/typing in between.
  // The snapshot the insertion handler splices into (liveValue/cursorPos) is
  // only refreshed by user events or a deferred rAF, so a second insertion
  // reuses the pre-first-insertion snapshot, splicing into stale content at the
  // stale caret and OVERWRITING the first insertion (data loss). The live
  // textarea (the user's source of truth) must drive both base and caret.
  it('does not overwrite a prior textInserted when a second one arrives without intervening events', async () => {
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

    const objective = (Array.from(document.querySelectorAll('textarea')) as HTMLTextAreaElement[])
      .find(t => t.value === 'AAA')!;
    expect(objective).toBeTruthy();

    await act(async () => {
      fireEvent.focus(objective);
    });
    objective.selectionStart = objective.selectionEnd = 3;
    await act(async () => {
      fireEvent.keyUp(objective);
    });

    // First registration lands at the live caret (end).
    await act(async () => {
      simulateMessage({ type: 'textInserted', data: { text: ' ONE' } });
    });
    expect(objective.value).toBe('AAA ONE');

    // The user's caret is now at the end of the freshly inserted text. No
    // focus/keyup/click events fire (mirrors a programmatic re-registration).
    objective.selectionStart = objective.selectionEnd = objective.value.length;

    // Second registration must append after ' ONE', not overwrite it.
    await act(async () => {
      simulateMessage({ type: 'textInserted', data: { text: ' TWO' } });
    });

    // Buggy snapshot path reuses liveValue 'AAA' + cursorPos 3 -> 'AAA TWO'
    // (the first ' ONE' is gone). The live-DOM path keeps both.
    expect(objective.value).toBe('AAA ONE TWO');
  });

  it('does not overwrite a prior sampleDefinitionCreated when a second one arrives without intervening events', async () => {
    const wf: WorkflowDocument = {
      ...mockWorkflow,
      unitOperations: [
        {
          id: 'uo-a',
          opId: 'UO_A',
          opName: 'Op A',
          opDescription: '',
          opType: 'hw',
          sections: [{ heading: 'Samples', content: 'AAA' }],
        },
      ],
    };

    render(<App />);
    await act(async () => {
      simulateMessage({ type: 'init', data: { mode: 'workflow', workflow: wf } });
    });

    const sec = (Array.from(document.querySelectorAll('textarea')) as HTMLTextAreaElement[])
      .find(t => t.value === 'AAA')!;
    expect(sec).toBeTruthy();

    await act(async () => {
      fireEvent.focus(sec);
    });
    sec.selectionStart = sec.selectionEnd = 3;
    await act(async () => {
      fireEvent.keyUp(sec);
    });

    await act(async () => {
      simulateMessage({
        type: 'sampleDefinitionCreated',
        data: { definitionText: '- @dna;DNA-1', opIndex: 0, secIndex: 0, opId: 'UO_A', secHeading: 'Samples' },
      });
    });
    expect(sec.value).toBe('AAA\n- @dna;DNA-1');

    // Caret at end of the first definition; no intervening events.
    sec.selectionStart = sec.selectionEnd = sec.value.length;

    await act(async () => {
      simulateMessage({
        type: 'sampleDefinitionCreated',
        data: { definitionText: '- @dna;DNA-2', opIndex: 0, secIndex: 0, opId: 'UO_A', secHeading: 'Samples' },
      });
    });

    // Buggy path reuses stale base 'AAA' + cursorPos 3 -> 'AAA\n- @dna;DNA-2'
    // (DNA-1 lost). The live-DOM path preserves both definitions.
    expect(sec.value).toBe('AAA\n- @dna;DNA-1\n- @dna;DNA-2');
  });

  // Issue #34 (real cause): the same opId code (e.g. UHW010) can appear on more
  // than one unit operation. Routing sampleDefinitionCreated by opId via
  // findIndex always hits the FIRST match, so adding a sample in the second
  // UHW010's section corrupts the FIRST one. Routing must use the unique op.id
  // (uoId) so the definition lands in the section the user actually edited.
  it('routes sampleDefinitionCreated by unique uoId when the same opId is used twice', async () => {
    const wf: WorkflowDocument = {
      ...mockWorkflow,
      unitOperations: [
        {
          id: 'unitop-1',
          opId: 'UHW010',
          opName: 'Op One',
          opDescription: '',
          opType: 'hw',
          sections: [{ heading: 'Output', content: 'FIRST' }],
        },
        {
          id: 'unitop-2',
          opId: 'UHW010',
          opName: 'Op Two',
          opDescription: '',
          opType: 'hw',
          sections: [{ heading: 'Output', content: 'SECOND' }],
        },
      ],
    };

    render(<App />);
    await act(async () => {
      simulateMessage({ type: 'init', data: { mode: 'workflow', workflow: wf } });
    });

    const textareas = Array.from(document.querySelectorAll('textarea')) as HTMLTextAreaElement[];
    const firstOutput = textareas.find(t => t.value === 'FIRST')!;
    const secondOutput = textareas.find(t => t.value === 'SECOND')!;
    expect(firstOutput).toBeTruthy();
    expect(secondOutput).toBeTruthy();

    // Focus the SECOND UHW010's Output and place the caret at the end.
    await act(async () => {
      fireEvent.focus(secondOutput);
    });
    secondOutput.selectionStart = secondOutput.selectionEnd = secondOutput.value.length;
    await act(async () => {
      fireEvent.keyUp(secondOutput);
    });

    await act(async () => {
      simulateMessage({
        type: 'sampleDefinitionCreated',
        data: {
          definitionText: '- @dna;DNA-1',
          opIndex: 1,
          secIndex: 0,
          opId: 'UHW010',
          uoId: 'unitop-2',
          secHeading: 'Output',
        },
      });
    });

    // The definition must land in the SECOND op; the FIRST op stays untouched.
    // The buggy path routes by opId-findIndex -> first op, corrupting 'FIRST'.
    expect(secondOutput.value).toBe('SECOND\n- @dna;DNA-1');
    expect(firstOutput.value).toBe('FIRST');
  });

  // Issue #34 (round-trip input): clicking +Sample on the second of two ops
  // sharing the same opId must send the unique uoId so the extension can echo
  // it back and route the definition to the correct op.
  it('sends the unique uoId in createSampleFromModal for the focused op', async () => {
    const vscode = (window as unknown as { acquireVsCodeApi: () => { postMessage: ReturnType<typeof vi.fn> } }).acquireVsCodeApi();
    const wf: WorkflowDocument = {
      ...mockWorkflow,
      unitOperations: [
        {
          id: 'unitop-1',
          opId: 'UHW010',
          opName: 'Op One',
          opDescription: '',
          opType: 'hw',
          sections: [{ heading: 'Reagent', content: 'R1' }],
        },
        {
          id: 'unitop-2',
          opId: 'UHW010',
          opName: 'Op Two',
          opDescription: '',
          opType: 'hw',
          sections: [{ heading: 'Reagent', content: 'R2' }],
        },
      ],
    };

    render(<App />);
    await act(async () => {
      simulateMessage({ type: 'init', data: { mode: 'workflow', workflow: wf } });
    });

    const addButtons = Array.from(
      document.querySelectorAll('button[aria-label="Add sample"]'),
    ) as HTMLButtonElement[];
    expect(addButtons.length).toBe(2);

    // Open the modal for the SECOND op (opIndex 1, uoId 'unitop-2').
    await act(async () => {
      fireEvent.click(addButtons[1]);
    });

    // The Reagent section locks the type, so Create is enabled immediately.
    const createBtn = await waitFor(() => {
      const btn = document.body.querySelector('button[type="submit"]') as HTMLButtonElement | null;
      if (!btn) throw new Error('Create button not mounted yet');
      return btn;
    });
    await act(async () => {
      fireEvent.click(createBtn);
    });

    const call = vscode.postMessage.mock.calls
      .map(c => c[0])
      .find((m: { type: string }) => m.type === 'createSampleFromModal');
    expect(call).toBeTruthy();
    expect(call.data.uoId).toBe('unitop-2');
    expect(call.data.opIndex).toBe(1);
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
