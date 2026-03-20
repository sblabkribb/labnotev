import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SampleHighlighter, highlightSampleIds } from '../components/SampleHighlighter';

describe('SampleHighlighter', () => {
  it('should render text without samples as plain text', () => {
    const { container } = render(<SampleHighlighter text="No samples here" />);
    expect(container.textContent).toBe('No samples here');
    expect(container.querySelectorAll('span').length).toBe(0);
  });

  it('should highlight DNA sample IDs', () => {
    const { container } = render(<SampleHighlighter text="Used DNA-001 in experiment" />);
    const spans = container.querySelectorAll('span');
    expect(spans.length).toBe(1);
    expect(spans[0].textContent).toBe('DNA-001');
    expect(spans[0].style.color).toBe('rgb(231, 76, 60)');
  });

  it('should highlight RNA sample IDs', () => {
    const { container } = render(<SampleHighlighter text="RNA-042 was sequenced" />);
    const spans = container.querySelectorAll('span');
    expect(spans.length).toBe(1);
    expect(spans[0].textContent).toBe('RNA-042');
  });

  it('should highlight sample IDs with aliases', () => {
    const { container } = render(<SampleHighlighter text="Used DNA-001|SampleA in step" />);
    const spans = container.querySelectorAll('span');
    expect(spans.length).toBe(1);
    expect(spans[0].textContent).toBe('DNA-001|SampleA');
  });

  it('should highlight multiple sample IDs', () => {
    const { container } = render(
      <SampleHighlighter text="DNA-001 and RNA-042 were mixed" />
    );
    const spans = container.querySelectorAll('span');
    expect(spans.length).toBe(2);
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
