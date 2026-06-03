describe('Image Preview Panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ImagePreviewPanel class', () => {
    it('should export ImagePreviewPanel class', async () => {
      const { ImagePreviewPanel } = await import('../views/ImagePreviewPanel');
      expect(ImagePreviewPanel).toBeDefined();
    });

    it('should have static viewType property', async () => {
      const { ImagePreviewPanel } = await import('../views/ImagePreviewPanel');
      expect(ImagePreviewPanel.viewType).toBe('labnotev.imagePreview');
    });

    it('should have static show method', async () => {
      const { ImagePreviewPanel } = await import('../views/ImagePreviewPanel');
      expect(typeof ImagePreviewPanel.show).toBe('function');
    });
  });

  describe('extractImageLinksFromText', () => {
    it('should extract markdown image links', async () => {
      const { extractImageLinksFromText } = await import('../views/ImagePreviewPanel');
      
      const text = 'Some text ![alt text](images/photo.png) more text';
      const links = extractImageLinksFromText(text);
      
      expect(links.length).toBe(1);
      expect(links[0].path).toBe('images/photo.png');
      expect(links[0].alt).toBe('alt text');
    });

    it('should extract multiple image links', async () => {
      const { extractImageLinksFromText } = await import('../views/ImagePreviewPanel');
      
      const text = '![img1](a.png) text ![img2](b.jpg) ![img3](c.gif)';
      const links = extractImageLinksFromText(text);
      
      expect(links.length).toBe(3);
      expect(links[0].path).toBe('a.png');
      expect(links[1].path).toBe('b.jpg');
      expect(links[2].path).toBe('c.gif');
    });

    it('should extract image links with various extensions', async () => {
      const { extractImageLinksFromText } = await import('../views/ImagePreviewPanel');
      
      const text = '![](test.png) ![](test.jpg) ![](test.jpeg) ![](test.gif) ![](test.webp) ![](test.svg)';
      const links = extractImageLinksFromText(text);
      
      expect(links.length).toBe(6);
    });

    it('should handle empty alt text', async () => {
      const { extractImageLinksFromText } = await import('../views/ImagePreviewPanel');
      
      const text = '![](image.png)';
      const links = extractImageLinksFromText(text);
      
      expect(links.length).toBe(1);
      expect(links[0].alt).toBe('');
      expect(links[0].path).toBe('image.png');
    });

    it('should return empty array for text without images', async () => {
      const { extractImageLinksFromText } = await import('../views/ImagePreviewPanel');
      
      const text = 'This document has no images.';
      const links = extractImageLinksFromText(text);
      
      expect(links.length).toBe(0);
    });

    it('should extract images with relative paths', async () => {
      const { extractImageLinksFromText } = await import('../views/ImagePreviewPanel');
      
      const text = '![photo](./images/2024/photo.png)';
      const links = extractImageLinksFromText(text);
      
      expect(links.length).toBe(1);
      expect(links[0].path).toBe('./images/2024/photo.png');
    });

    it('should extract line and character position of image', async () => {
      const { extractImageLinksFromText } = await import('../views/ImagePreviewPanel');
      
      const text = 'Line 1\nLine 2 ![img](photo.png) more\nLine 3';
      const links = extractImageLinksFromText(text);
      
      expect(links.length).toBe(1);
      expect(links[0].line).toBe(1); // 0-indexed
      expect(links[0].character).toBe(7); // "Line 2 " = 7 characters
    });
  });

  describe('HTML generation', () => {
    it('should generate HTML with image and close button', async () => {
      const { generateImagePreviewHtml } = await import('../views/ImagePreviewPanel');
      
      const html = generateImagePreviewHtml('test-uri', 'Test Image');
      
      expect(html).toContain('img');
      expect(html).toContain('test-uri');
      expect(html).toContain('Test Image');
      expect(html).toContain('close'); // close button
    });

    it('should include close button with onclick handler', async () => {
      const { generateImagePreviewHtml } = await import('../views/ImagePreviewPanel');
      
      const html = generateImagePreviewHtml('image.png', 'Alt');
      
      expect(html).toContain('button');
      expect(html).toContain('closePanel');
    });

    it('should escape HTML in alt text', async () => {
      const { generateImagePreviewHtml } = await import('../views/ImagePreviewPanel');
      
      const html = generateImagePreviewHtml('image.png', '<script>alert("xss")</script>');
      
      // Alt text should be escaped (check in title and span elements)
      expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      // Should not contain raw script tag in alt position (title attribute)
      expect(html).not.toContain('title="<script>');
    });

    it('should include a Content-Security-Policy meta scoped to the webview cspSource', async () => {
      const { generateImagePreviewHtml } = await import('../views/ImagePreviewPanel');

      const cspSource = 'vscode-webview://test-csp-source';
      const html = generateImagePreviewHtml('image.png', 'Alt', cspSource);

      expect(html).toContain('http-equiv="Content-Security-Policy"');
      expect(html).toContain("default-src 'none'");
      // Images are restricted to the webview source
      expect(html).toContain(`img-src ${cspSource}`);
      // Scripts are gated by a per-render nonce, used on the <script> tag too
      const nonceMatch = html.match(/script-src 'nonce-([A-Za-z0-9]+)'/);
      expect(nonceMatch).not.toBeNull();
      expect(html).toContain(`<script nonce="${nonceMatch![1]}">`);
    });

    it('should not rely on inline event handler attributes (CSP-incompatible)', async () => {
      const { generateImagePreviewHtml } = await import('../views/ImagePreviewPanel');

      const html = generateImagePreviewHtml('image.png', 'Alt', 'vscode-webview://s');

      expect(html).not.toMatch(/onclick=/);
      expect(html).not.toMatch(/onerror=/);
    });
  });

  describe('Multiple panels', () => {
    it('should allow multiple panels to be created', async () => {
      const { ImagePreviewPanel } = await import('../views/ImagePreviewPanel');
      
      // ImagePreviewPanel should create new panel for each call
      // Unlike SampleInfoPanel which reuses single panel
      expect(ImagePreviewPanel.allowMultiple).toBe(true);
    });
  });
});
