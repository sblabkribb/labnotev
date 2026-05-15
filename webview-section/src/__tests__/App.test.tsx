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
