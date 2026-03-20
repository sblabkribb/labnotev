import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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

    expect(screen.getByText(/Lab Note 또는 Workflow 형식이 아닙니다/)).toBeInTheDocument();
  });
});
