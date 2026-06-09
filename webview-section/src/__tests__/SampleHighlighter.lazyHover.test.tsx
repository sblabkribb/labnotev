import type { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { SampleHighlighter } from '../components/SampleHighlighter';
import * as vscodeApi from '../vscodeApi';

function renderWithMantine(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

const TYPES = ['DNA'];
const COLORS: Record<string, string> = { DNA: '#FFB6C1' };

describe('SampleHighlighter lazy HoverCard mounting (Phase A)', () => {
  beforeEach(() => {
    vi.spyOn(vscodeApi, 'postMessage').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not mount the HoverCard target before the token is hovered', () => {
    const { container } = renderWithMantine(
      <SampleHighlighter
        text="DNA-001"
        interactive
        availableTypes={TYPES}
        sampleTypeColors={COLORS}
        sampleDefs={{ 'DNA-001': { alias: 'GeneA', description: 'Plasmid prep' } }}
      />
    );

    // The token text is still present as a bare span.
    expect(screen.getByText('DNA-001')).toBeInTheDocument();
    // But the Mantine HoverCard/Popover target machinery (which adds
    // aria-haspopup="dialog" to the target element) must NOT be mounted yet.
    expect(container.querySelector('[aria-haspopup]')).toBeNull();
  });

  it('mounts the HoverCard and shows the dropdown on first hover', async () => {
    const { container } = renderWithMantine(
      <SampleHighlighter
        text="DNA-001"
        interactive
        availableTypes={TYPES}
        sampleTypeColors={COLORS}
        sampleDefs={{ 'DNA-001': { alias: 'GeneA', description: 'Plasmid prep' } }}
      />
    );

    fireEvent.mouseEnter(screen.getByText('DNA-001'));

    await waitFor(() => {
      expect(screen.getByText('GeneA')).toBeInTheDocument();
    });
    expect(container.querySelector('[aria-haspopup]')).not.toBeNull();
  });

  it('still forwards mouseDown to onSampleClick on a token that was never hovered', () => {
    const onSampleClick = vi.fn();
    renderWithMantine(
      <SampleHighlighter
        text="DNA-001"
        interactive
        availableTypes={TYPES}
        sampleTypeColors={COLORS}
        sampleDefs={{ 'DNA-001': { alias: 'GeneA', description: 'Plasmid prep' } }}
        onSampleClick={onSampleClick}
      />
    );

    fireEvent.mouseDown(screen.getByText('DNA-001'));
    expect(onSampleClick).toHaveBeenCalledTimes(1);
  });
});
