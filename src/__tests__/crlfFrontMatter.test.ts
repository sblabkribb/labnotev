import { mockVscode } from './setup';
import { parseLabNoteMd } from '../lib/labnoteSectionParser';
import { parseWorkflowMd } from '../lib/workflowSectionParser';

vi.mock('vscode', () => mockVscode);

/**
 * Windows files saved with CRLF line endings must parse identically to LF.
 * The front-matter regexes previously required a bare `\n` after the opening
 * `---`, so `---\r\n` failed to match: `detectMdFileType` returned 'unknown'
 * (blank Section Editor) and the parsers dropped the front matter entirely.
 */

const LABNOTE_LF = `---
title: CRLF Test
author: 홍길동
experiment_type: labnote
sample_tracking: yes
created_date: 2026-01-15
last_updated_date: 2026-01-20
---

## 🎯 Experiment Objective
> Goal line

Body content here.
`;

const WORKFLOW_LF = `---
title: WD010 Sample Preparation
experimenter: 홍길동
created_date: 2026-01-15
last_updated_date: 2026-01-20
end_date: ''
---

## [WD010 Sample Preparation]

> Prepare samples
`;

const toCRLF = (s: string) => s.replace(/\n/g, '\r\n');

describe('CRLF front matter handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detectMdFileType recognizes a CRLF labnote file', async () => {
    const { detectMdFileType } = await import('../sectionEditorProvider');
    expect(detectMdFileType(toCRLF(LABNOTE_LF))).toBe('labnote');
  });

  it('detectMdFileType recognizes a CRLF workflow file', async () => {
    const { detectMdFileType } = await import('../sectionEditorProvider');
    expect(detectMdFileType(toCRLF(WORKFLOW_LF))).toBe('workflow');
  });

  it('parseLabNoteMd parses CRLF front matter and leaves no carriage returns in section content', () => {
    const doc = parseLabNoteMd(toCRLF(LABNOTE_LF));
    expect(doc.frontMatter.title).toBe('CRLF Test');
    expect(doc.frontMatter.experiment_type).toBe('labnote');
    const serialized = JSON.stringify(doc.sections);
    expect(serialized).not.toContain('\\r');
  });

  it('parseWorkflowMd parses CRLF front matter', () => {
    const doc = parseWorkflowMd(toCRLF(WORKFLOW_LF));
    expect(doc.frontMatter.title).toBe('WD010 Sample Preparation');
    expect(doc.frontMatter.experimenter).toBe('홍길동');
  });
});
