import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { NodeFileSystem } from '@labnotev/core/node';
import {
  buildExportCandidates,
  collectExportSources,
  renderMarkdownFallback,
  attachmentLinksToImages,
  rewriteImageSources,
  postProcessBodyHtml,
  buildExportHtml,
  type RenderedSource,
} from '../../lib/exportMarkdown';

const nfs = new NodeFileSystem();

describe('buildExportCandidates', () => {
  const readmeAbsPath = '/ws/labnote/001_X/README.labnote.md';

  it('lists README first, then checklist items in order, then unlisted siblings', () => {
    const readme = `---
title: X
---
## Related Workflows

[ ] [001 WD010 Design](./001_WD010_Design.labnote.md)
[x] [002 WB010 Build](./002_WB010_Build.labnote.md)
`;
    const siblings = ['001_WD010_Design.labnote.md', '002_WB010_Build.labnote.md', '003_WX010_Extra.labnote.md'];

    const result = buildExportCandidates(readmeAbsPath, readme, siblings);

    expect(result.map(c => c.label)).toEqual([
      'README.labnote.md',
      '001 WD010 Design',
      '002 WB010 Build',
      '003_WX010_Extra.labnote.md',
    ]);
    expect(result[0].checked).toBe(true);
    expect(result[1].checked).toBe(true);
    expect(result[2].checked).toBe(true);
    expect(result[3].checked).toBe(false);
  });

  // Regression: real-world README (transcriptome-analysis/labnote/002_pmid_38072358)
  // linked the same workflow file twice under Related Workflows.
  it('dedupes a workflow file linked twice in the checklist', () => {
    const readme = `## Related Workflows

[ ] [001 RNASeq](./001_WL050_Transcriptome_Analysis.labnote.md)
[ ] [002 DEG analysis](./002_WL050_Transcriptome_Analysis.labnote.md)
[ ] [002 DEG analysis again](./002_WL050_Transcriptome_Analysis.labnote.md)
`;
    const siblings = ['001_WL050_Transcriptome_Analysis.labnote.md', '002_WL050_Transcriptome_Analysis.labnote.md'];

    const result = buildExportCandidates(readmeAbsPath, readme, siblings);

    expect(result).toHaveLength(3); // README + 2 unique workflow files
    expect(result[2].label).toBe('002 DEG analysis'); // first occurrence wins
  });

  it('ignores checklist links pointing outside the experiment folder', () => {
    const readme = `## Related Workflows

[ ] [Escape](../../../etc/passwd.labnote.md)
`;
    const result = buildExportCandidates(readmeAbsPath, readme, []);
    expect(result).toHaveLength(1); // README only
  });

  it('ignores checklist links whose target file is missing on disk', () => {
    const readme = `## Related Workflows

[ ] [Ghost](./999_GHOST.labnote.md)
`;
    const result = buildExportCandidates(readmeAbsPath, readme, []);
    expect(result).toHaveLength(1);
  });
});

describe('collectExportSources', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-sources-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reads front matter fields verbatim and strips them from the body', async () => {
    const filePath = path.join(dir, 'README.labnote.md');
    fs.writeFileSync(
      filePath,
      `---\ntitle: pmid_39169056\nauthor: Sebin Heo\ncreated_date: 2026-08-04\nlast_updated_date: 2026-08-10\n---\n\n## Objective\n\nBody text.\n`,
      'utf8'
    );

    const [source] = await collectExportSources(nfs, [filePath]);

    expect(source.coverTitle).toBe('pmid_39169056');
    expect(source.coverAuthor).toBe('Sebin Heo');
    expect(source.createdDate).toBe('2026-08-04');
    expect(source.lastUpdatedDate).toBe('2026-08-10');
    expect(source.body).toContain('## Objective');
    expect(source.body).not.toContain('---');
  });

  it('falls back to experimenter when author is absent (workflow files)', async () => {
    const filePath = path.join(dir, '001_WL050.labnote.md');
    fs.writeFileSync(
      filePath,
      `---\ntitle: WL050\nexperimenter: Sebin Heo\ncreated_date: '2026-08-04 14:25'\nlast_updated_date: 2026-08-18\nend_date: ''\n---\n\n## Body\n`,
      'utf8'
    );

    const [source] = await collectExportSources(nfs, [filePath]);

    expect(source.coverAuthor).toBe('Sebin Heo');
    expect(source.createdDate).toBe('2026-08-04 14:25'); // date+time preserved verbatim
  });

  it('dedupes by resolved absolute path and skips missing files', async () => {
    const filePath = path.join(dir, 'a.labnote.md');
    fs.writeFileSync(filePath, '---\ntitle: A\n---\nBody\n', 'utf8');

    const result = await collectExportSources(nfs, [filePath, filePath, path.join(dir, 'missing.labnote.md')]);

    expect(result).toHaveLength(1);
  });
});

describe('renderMarkdownFallback', () => {
  it('converts headings, lists, paragraphs, and images', () => {
    const html = renderMarkdownFallback('# Title\n\nSome text.\n\n- one\n- two\n\n![alt](images/x.png)\n');
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('<li>two</li>');
    expect(html).toContain('<p>Some text.</p>');
    expect(html).toContain('<img src="images/x.png" alt="alt" />');
  });
});

describe('attachmentLinksToImages', () => {
  it('converts a link to an image file into an <img> tag', () => {
    const html = '<a href="resources/attachments/supp_fig2.png">supp_fig2.png</a>';
    const result = attachmentLinksToImages(html);
    expect(result).toBe('<img src="resources/attachments/supp_fig2.png" alt="supp_fig2.png" />');
  });

  it('leaves non-image links untouched', () => {
    const html = '<a href="resources/attachments/report.pdf">report.pdf</a>';
    expect(attachmentLinksToImages(html)).toBe(html);
  });
});

describe('rewriteImageSources', () => {
  it('rewrites a relative src to an absolute file:// URI', () => {
    const html = '<img src="images/x.png" alt="" />';
    const result = rewriteImageSources(html, '/ws/labnote/001_X');
    // Compute the expected href the same way the source does so the assertion
    // is platform-neutral (path.resolve anchors to the current drive on Windows).
    const expectedHref = pathToFileURL(path.resolve('/ws/labnote/001_X', 'images/x.png')).href;
    expect(result).toBe(`<img src="${expectedHref}" alt="" />`);
  });

  it('leaves absolute http/data/file srcs untouched', () => {
    expect(rewriteImageSources('<img src="https://a/b.png">', '/x')).toContain('https://a/b.png');
    expect(rewriteImageSources('<img src="data:image/png;base64,AA">', '/x')).toContain('data:image/png');
  });

  it('decodes percent-encoded paths before resolving', () => {
    const html = '<img src="resources/attachments/supp%20fig.png" alt="" />';
    const result = rewriteImageSources(html, '/ws/exp');
    const expectedHref = pathToFileURL('/ws/exp/resources/attachments/supp fig.png').href;
    expect(result).toContain(expectedHref);
  });
});

describe('postProcessBodyHtml', () => {
  it('converts attachment image links then absolutizes their src in one pass', () => {
    const html = '<a href="resources/attachments/fig.png">fig.png</a>';
    const result = postProcessBodyHtml(html, '/ws/exp');
    const expectedHref = pathToFileURL(
      path.resolve('/ws/exp', 'resources/attachments/fig.png')
    ).href;
    expect(result).toBe(`<img src="${expectedHref}" alt="fig.png" />`);
  });
});

describe('buildExportHtml', () => {
  const labels = { author: 'Author', created: 'Created', lastUpdated: 'Last updated' };

  function makeSource(overrides: Partial<RenderedSource>): RenderedSource {
    return {
      absPath: '/ws/exp/README.labnote.md',
      fileName: 'README.labnote.md',
      dirPath: '/ws/exp',
      coverTitle: 'Untitled',
      coverAuthor: '',
      createdDate: '',
      lastUpdatedDate: '',
      body: '',
      bodyHtml: '',
      ...overrides,
    };
  }

  it('renders a cover with title/author/created/last-updated from the first source', () => {
    const source = makeSource({
      coverTitle: 'pmid_39169056',
      coverAuthor: 'Sebin Heo',
      createdDate: '2026-08-04',
      lastUpdatedDate: '2026-08-10',
      bodyHtml: '<p>Body</p>',
    });

    const html = buildExportHtml([source], labels);

    expect(html).toContain('<h1>pmid_39169056</h1>');
    expect(html).toContain('Author: Sebin Heo');
    expect(html).toContain('Created: 2026-08-04');
    expect(html).toContain('Last updated: 2026-08-10');
    expect(html).toContain('<p>Body</p>');
  });

  it('does not repeat a full cover for additional sources, only a heading + meta line', () => {
    const first = makeSource({ coverTitle: 'README', bodyHtml: '<p>readme body</p>' });
    const second = makeSource({
      coverTitle: 'WL050 Workflow',
      createdDate: '2026-08-04',
      lastUpdatedDate: '2026-08-18',
      bodyHtml: '<p>workflow body</p>',
    });

    const html = buildExportHtml([first, second], labels);

    expect(html.match(/class="cover"/g)).toHaveLength(1);
    expect(html).toContain('<h2>WL050 Workflow</h2>');
    expect(html).toContain('<p>workflow body</p>');
  });

  it('escapes HTML in title and meta fields', () => {
    const source = makeSource({ coverTitle: '<script>alert(1)</script>', bodyHtml: '<p>x</p>' });
    const html = buildExportHtml([source], labels);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('returns a minimal document when there are no sources', () => {
    const html = buildExportHtml([], labels);
    expect(html).toContain('<html');
  });
});
