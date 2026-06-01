import type { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { SampleHighlighter, highlightSampleIds } from '../components/SampleHighlighter';
import * as vscodeApi from '../vscodeApi';

function renderWithMantine(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

const DEFAULT_AVAILABLE_TYPES = ['DNA', 'RNA', 'Plasmid', 'Reagent', 'Primer', 'Protein', 'Equip', 'Labware'];
const DEFAULT_SAMPLE_COLORS: Record<string, string> = {
  DNA: '#FFB6C1',
  RNA: '#ADD8E6',
  Plasmid: '#98FB98',
  Reagent: '#FFD700',
  Primer: '#FF69B4',
  Protein: '#DDA0DD',
  Equip: '#FFA07A',
  Labware: '#D8BFD8',
};

describe('SampleHighlighter', () => {
  beforeEach(() => {
    vi.spyOn(vscodeApi, 'postMessage').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render text without samples as plain text', () => {
    const { container } = renderWithMantine(
      <SampleHighlighter text="No samples here" availableTypes={DEFAULT_AVAILABLE_TYPES} sampleTypeColors={DEFAULT_SAMPLE_COLORS} />
    );
    expect(screen.getByText('No samples here')).toBeInTheDocument();
    expect(container.querySelectorAll('span').length).toBe(0);
  });

  it('should highlight DNA sample IDs using injected sampleTypeColors', () => {
    const { container } = renderWithMantine(
      <SampleHighlighter
        text="Used DNA-001 in experiment"
        availableTypes={DEFAULT_AVAILABLE_TYPES}
        sampleTypeColors={DEFAULT_SAMPLE_COLORS}
      />
    );
    const spans = container.querySelectorAll('span');
    expect(spans.length).toBe(1);
    expect(spans[0].textContent).toBe('DNA-001');
    // #FFB6C1 => rgb(255, 182, 193)
    expect(spans[0].style.color).toBe('rgb(255, 182, 193)');
  });

  it('should NOT highlight types that are not in availableTypes (BUILTIN_TYPES no longer leaks)', () => {
    // Cell was in the old BUILTIN_TYPES but is not in the unified SAMPLE_TYPES.
    const { container } = renderWithMantine(
      <SampleHighlighter
        text="Cell-001 should stay plain"
        availableTypes={DEFAULT_AVAILABLE_TYPES}
        sampleTypeColors={DEFAULT_SAMPLE_COLORS}
      />
    );
    expect(container.querySelectorAll('span').length).toBe(0);
  });

  it('should highlight custom type when provided via availableTypes and sampleTypeColors', () => {
    const { container } = renderWithMantine(
      <SampleHighlighter
        text="MyCustom-99"
        availableTypes={[...DEFAULT_AVAILABLE_TYPES, 'MyCustom']}
        sampleTypeColors={{ ...DEFAULT_SAMPLE_COLORS, MyCustom: '#123456' }}
      />
    );
    const spans = container.querySelectorAll('span');
    expect(spans.length).toBe(1);
    expect(spans[0].textContent).toBe('MyCustom-99');
  });

  it('should highlight RNA sample IDs', () => {
    const { container } = renderWithMantine(
      <SampleHighlighter text="RNA-042 was sequenced" availableTypes={DEFAULT_AVAILABLE_TYPES} sampleTypeColors={DEFAULT_SAMPLE_COLORS} />
    );
    const spans = container.querySelectorAll('span');
    expect(spans.length).toBe(1);
    expect(spans[0].textContent).toBe('RNA-042');
  });

  // Issue #27: highlight the ID only, leaving any trailing `|alias` / `;alias`
  // unhighlighted so the Editor-mode overlay matches the text-mode decoration.
  it('highlights only the ID, not a trailing |alias token', () => {
    const { container } = renderWithMantine(
      <SampleHighlighter text="Used DNA-001|SampleA in step" availableTypes={DEFAULT_AVAILABLE_TYPES} sampleTypeColors={DEFAULT_SAMPLE_COLORS} />
    );
    const spans = container.querySelectorAll('span');
    expect(spans.length).toBe(1);
    expect(spans[0].textContent).toBe('DNA-001');
  });

  // Issue #27 exact reproduction: `;TE buffer` used to highlight `;TE` only
  // (first whitespace-delimited token), diverging from the text editor which
  // highlighted just the ID. Both must now stop at the ID.
  it('highlights only the ID for a `;alias` definition with a spaced alias (issue #27)', () => {
    const { container } = renderWithMantine(
      <SampleHighlighter
        text="@reagent;Reagent-1779928464616;TE buffer"
        availableTypes={DEFAULT_AVAILABLE_TYPES}
        sampleTypeColors={DEFAULT_SAMPLE_COLORS}
      />
    );
    const spans = container.querySelectorAll('span');
    expect(spans.length).toBe(1);
    expect(spans[0].textContent).toBe('Reagent-1779928464616');
  });

  it('should highlight multiple sample IDs', () => {
    const { container } = renderWithMantine(
      <SampleHighlighter text="DNA-001 and RNA-042 were mixed" availableTypes={DEFAULT_AVAILABLE_TYPES} sampleTypeColors={DEFAULT_SAMPLE_COLORS} />
    );
    const spans = container.querySelectorAll('span');
    expect(spans.length).toBe(2);
  });

  it('shows alias and description in hover card and navigates on button click', async () => {
    renderWithMantine(
      <SampleHighlighter
        text="DNA-001"
        interactive
        availableTypes={DEFAULT_AVAILABLE_TYPES}
        sampleTypeColors={DEFAULT_SAMPLE_COLORS}
        sampleDefs={{ 'DNA-001': { alias: 'GeneA', description: 'Plasmid prep' } }}
      />
    );
    fireEvent.mouseEnter(screen.getByText('DNA-001'));
    await waitFor(() => {
      expect(screen.getByText('GeneA')).toBeInTheDocument();
    });
    expect(screen.getByText('Plasmid prep')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Go to definition/, hidden: true }));
    expect(vscodeApi.postMessage).toHaveBeenCalledWith({
      type: 'navigateToSample',
      data: { sampleId: 'DNA-001', sampleType: 'DNA' },
    });
  });

  it('shows "No definition info" when sample id is missing from sampleDefs', async () => {
    renderWithMantine(
      <SampleHighlighter
        text="DNA-001"
        interactive
        availableTypes={DEFAULT_AVAILABLE_TYPES}
        sampleTypeColors={DEFAULT_SAMPLE_COLORS}
        sampleDefs={{}}
      />
    );
    fireEvent.mouseEnter(screen.getByText('DNA-001'));
    await waitFor(() => {
      expect(screen.getByText('No definition info')).toBeInTheDocument();
    });
  });

  it('shows "No alias or description registered" when record exists but empty', async () => {
    renderWithMantine(
      <SampleHighlighter
        text="DNA-001"
        interactive
        availableTypes={DEFAULT_AVAILABLE_TYPES}
        sampleTypeColors={DEFAULT_SAMPLE_COLORS}
        sampleDefs={{ 'DNA-001': { alias: null, description: null } }}
      />
    );
    fireEvent.mouseEnter(screen.getByText('DNA-001'));
    await waitFor(() => {
      expect(screen.getByText('No alias or description registered')).toBeInTheDocument();
    });
  });
});

describe('highlightSampleIds', () => {
  it('should return true for text containing sample IDs in availableTypes', () => {
    expect(highlightSampleIds('Used DNA-001', DEFAULT_AVAILABLE_TYPES)).toBe(true);
  });

  it('should return false for text without sample IDs', () => {
    expect(highlightSampleIds('No samples', DEFAULT_AVAILABLE_TYPES)).toBe(false);
  });

  it('returns false for types not in availableTypes (Cell was old BUILTIN_TYPES leak)', () => {
    expect(highlightSampleIds('Cell-001', DEFAULT_AVAILABLE_TYPES)).toBe(false);
  });

  it('returns true for custom types when provided via availableTypes', () => {
    expect(highlightSampleIds('MyCustom-7', [...DEFAULT_AVAILABLE_TYPES, 'MyCustom'])).toBe(true);
  });
});
