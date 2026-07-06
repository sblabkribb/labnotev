import * as path from 'path';
import { mockVscode } from './setup';

vi.mock('vscode', () => mockVscode);

/**
 * Issue #37: attachment/image hrefs are stored percent-encoded (`%20` for
 * spaces). The markdown ImageLinkProvider must decode the href before resolving
 * it to a filesystem path, otherwise clicking a link with a space in the name
 * would look for a literal `%20` file and fail.
 */

const docDir = path.resolve('/workspace/exp01');

function makeDoc(text: string) {
  return {
    languageId: 'markdown',
    uri: { fsPath: path.join(docDir, 'README.labnote.md') },
    getText: () => text,
  } as any;
}

function decodeCommandImagePath(target: unknown): string {
  const raw = String((target as { toString: () => string }).toString());
  const query = raw.slice(raw.indexOf('?') + 1);
  const parsed = JSON.parse(decodeURIComponent(query)) as { imagePath: string };
  return parsed.imagePath;
}

describe('ImageLinkProvider percent-encoded hrefs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('decodes %20 in the href when resolving the image path', async () => {
    const { ImageLinkProvider } = await import('../lib/imageLinkProvider');
    const provider = new ImageLinkProvider();
    const doc = makeDoc('![shot](images/my%20file.png)');

    const links = provider.provideDocumentLinks(doc, {} as any);

    expect(links.length).toBe(1);
    const imagePath = decodeCommandImagePath(links[0].target);
    expect(imagePath).toContain('my file.png');
    expect(imagePath).not.toContain('%20');
  });

  it('still resolves a plain href without encoding', async () => {
    const { ImageLinkProvider } = await import('../lib/imageLinkProvider');
    const provider = new ImageLinkProvider();
    const doc = makeDoc('![shot](images/plain.png)');

    const links = provider.provideDocumentLinks(doc, {} as any);

    expect(links.length).toBe(1);
    const imagePath = decodeCommandImagePath(links[0].target);
    expect(imagePath).toContain('plain.png');
  });
});
