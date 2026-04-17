import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { AttachmentLinks, parseResourceAttachmentLinks } from '../components/AttachmentLinks';
import * as vscodeApi from '../vscodeApi';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MantineProvider>{children}</MantineProvider>
);

describe('parseResourceAttachmentLinks', () => {
  it('extracts resources/ links and skips image extensions', () => {
    const md = `
See [report](resources/attachments/report.pdf)
![thumb](resources/attachments/preview.png)
[DNA](resources/labsamples/DNA.json)
`;
    const links = parseResourceAttachmentLinks(md);
    expect(links.map(l => l.path)).toEqual([
      'resources/attachments/report.pdf',
      'resources/labsamples/DNA.json',
    ]);
    expect(links.find(l => l.path.endsWith('.png'))).toBeUndefined();
  });

  it('omits image extensions under images/ (thumbnails handle those)', () => {
    const md = '[scan](images/scan.png) [sheet](images/data.xlsx)';
    const links = parseResourceAttachmentLinks(md);
    expect(links.map(l => l.path)).toEqual(['images/data.xlsx']);
  });

  it('extracts ./images/ and ./resources/ after normalization', () => {
    const md = '[a](./images/a.pdf) [b](./resources/attachments/b.pdf)';
    const links = parseResourceAttachmentLinks(md);
    expect(links.map(l => l.path).sort()).toEqual(['images/a.pdf', 'resources/attachments/b.pdf'].sort());
  });

  it('extracts other relative file links (non-image)', () => {
    expect(parseResourceAttachmentLinks('[n](data/notes.txt)').map(l => l.path)).toEqual(['data/notes.txt']);
    expect(parseResourceAttachmentLinks('[r](report.pdf)').map(l => l.path)).toEqual(['report.pdf']);
  });

  it('skips workflow .labnote.md links', () => {
    expect(parseResourceAttachmentLinks('[wf](./001_WD010_Design.labnote.md)')).toEqual([]);
  });

  it('returns empty when no resource links', () => {
    expect(parseResourceAttachmentLinks('hello ![](images/a.png)')).toEqual([]);
  });
});

describe('AttachmentLinks', () => {
  beforeEach(() => {
    vi.spyOn(vscodeApi, 'postMessage').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders anchors and posts openAttachment on click', () => {
    render(<AttachmentLinks content="- [doc](resources/attachments/doc.pdf)" />, { wrapper });
    const link = screen.getByText('doc').closest('a');
    expect(link).toBeTruthy();
    fireEvent.click(link!);
    expect(vscodeApi.postMessage).toHaveBeenCalledWith({
      type: 'openAttachment',
      data: { path: 'resources/attachments/doc.pdf' },
    });
  });
});
