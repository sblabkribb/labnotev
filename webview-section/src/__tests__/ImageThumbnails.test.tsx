import { parseImageLinks } from '../components/ImageThumbnails';

describe('parseImageLinks', () => {
  it('collects inline markdown images', () => {
    const md = '![](images/a.png)';
    expect(parseImageLinks(md).map(i => i.path)).toEqual(['images/a.png']);
  });

  it('collects linked-style image attachments under resources/', () => {
    const md = '[snap](resources/attachments/snap.png)';
    expect(parseImageLinks(md)).toEqual([{ path: 'resources/attachments/snap.png', alt: 'snap' }]);
  });

  it('dedupes same path from inline and link style', () => {
    const md = '![](images/x.png)\n[copy](images/x.png)';
    const imgs = parseImageLinks(md);
    expect(imgs).toHaveLength(1);
    expect(imgs[0].path).toBe('images/x.png');
  });

  it('normalizes ./ prefix on linked images', () => {
    expect(parseImageLinks('[a](./images/z.png)').map(i => i.path)).toEqual(['images/z.png']);
  });

  it('does not collect non-image file links', () => {
    expect(parseImageLinks('[doc](resources/attachments/doc.pdf)')).toEqual([]);
  });
});
