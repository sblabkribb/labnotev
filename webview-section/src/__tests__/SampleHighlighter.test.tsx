import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { SampleHighlighter, highlightSampleIds } from '../components/SampleHighlighter';
import * as vscodeApi from '../vscodeApi';

function renderWithMantine(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe('SampleHighlighter', () => {
  beforeEach(() => {
    vi.spyOn(vscodeApi, 'postMessage').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render text without samples as plain text', () => {
    const { container } = renderWithMantine(<SampleHighlighter text="No samples here" />);
    expect(screen.getByText('No samples here')).toBeInTheDocument();
    expect(container.querySelectorAll('span').length).toBe(0);
  });

  it('should highlight DNA sample IDs', () => {
    const { container } = renderWithMantine(<SampleHighlighter text="Used DNA-001 in experiment" />);
    const spans = container.querySelectorAll('span');
    expect(spans.length).toBe(1);
    expect(spans[0].textContent).toBe('DNA-001');
    expect(spans[0].style.color).toBe('rgb(231, 76, 60)');
  });

  it('should highlight RNA sample IDs', () => {
    const { container } = renderWithMantine(<SampleHighlighter text="RNA-042 was sequenced" />);
    const spans = container.querySelectorAll('span');
    expect(spans.length).toBe(1);
    expect(spans[0].textContent).toBe('RNA-042');
  });

  it('should highlight sample IDs with aliases', () => {
    const { container } = renderWithMantine(<SampleHighlighter text="Used DNA-001|SampleA in step" />);
    const spans = container.querySelectorAll('span');
    expect(spans.length).toBe(1);
    expect(spans[0].textContent).toBe('DNA-001|SampleA');
  });

  it('should highlight multiple sample IDs', () => {
    const { container } = renderWithMantine(
      <SampleHighlighter text="DNA-001 and RNA-042 were mixed" />
    );
    const spans = container.querySelectorAll('span');
    expect(spans.length).toBe(2);
  });

  it('shows alias and description in hover card and navigates on button click', async () => {
    renderWithMantine(
      <SampleHighlighter
        text="DNA-001"
        interactive
        sampleDefs={{ 'DNA-001': { alias: 'GeneA', description: 'Plasmid prep' } }}
      />
    );
    fireEvent.mouseEnter(screen.getByText('DNA-001'));
    await waitFor(() => {
      expect(screen.getByText('GeneA')).toBeInTheDocument();
    });
    expect(screen.getByText('Plasmid prep')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /정의로 이동/, hidden: true }));
    expect(vscodeApi.postMessage).toHaveBeenCalledWith({
      type: 'navigateToSample',
      data: { sampleId: 'DNA-001', sampleType: 'DNA' },
    });
  });

  it('shows 정의 정보 없음 when sample id is missing from sampleDefs', async () => {
    renderWithMantine(<SampleHighlighter text="DNA-001" interactive sampleDefs={{}} />);
    fireEvent.mouseEnter(screen.getByText('DNA-001'));
    await waitFor(() => {
      expect(screen.getByText('정의 정보 없음')).toBeInTheDocument();
    });
  });

  it('shows 등록된 별칭·설명 없음 when record exists but empty', async () => {
    renderWithMantine(
      <SampleHighlighter
        text="DNA-001"
        interactive
        sampleDefs={{ 'DNA-001': { alias: null, description: null } }}
      />
    );
    fireEvent.mouseEnter(screen.getByText('DNA-001'));
    await waitFor(() => {
      expect(screen.getByText('등록된 별칭·설명 없음')).toBeInTheDocument();
    });
  });
});

describe('highlightSampleIds', () => {
  it('should return true for text containing sample IDs', () => {
    expect(highlightSampleIds('Used DNA-001')).toBe(true);
  });

  it('should return false for text without sample IDs', () => {
    expect(highlightSampleIds('No samples')).toBe(false);
  });
});
