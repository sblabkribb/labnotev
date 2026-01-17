import { describe, it, expect } from 'vitest';
import { markdownToBlocks } from '../markdownConverter';

describe('markdownConverter', () => {
  describe('markdownToBlocks', () => {
    describe('Headings', () => {
      it('should convert H1 heading', () => {
        const markdown = '# Hello World';
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe('heading');
        expect((blocks[0].props as { level: number }).level).toBe(1);
        expect(blocks[0].content).toEqual([
          { type: 'text', text: 'Hello World', styles: {} }
        ]);
      });

      it('should convert H2 heading', () => {
        const markdown = '## Subtitle';
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe('heading');
        expect((blocks[0].props as { level: number }).level).toBe(2);
      });

      it('should convert H3 heading', () => {
        const markdown = '### Small Heading';
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe('heading');
        expect((blocks[0].props as { level: number }).level).toBe(3);
      });

      it('should cap heading level at 3', () => {
        const markdown = '###### H6 Heading';
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe('heading');
        expect((blocks[0].props as { level: number }).level).toBe(3);
      });
    });

    describe('Paragraphs', () => {
      it('should convert simple paragraph', () => {
        const markdown = 'This is a paragraph.';
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe('paragraph');
        expect(blocks[0].content).toEqual([
          { type: 'text', text: 'This is a paragraph.', styles: {} }
        ]);
      });

      it('should convert multiple paragraphs', () => {
        const markdown = 'First paragraph.\n\nSecond paragraph.';
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks).toHaveLength(2);
        expect(blocks[0].type).toBe('paragraph');
        expect(blocks[1].type).toBe('paragraph');
      });

      it('should return empty paragraph for empty content', () => {
        const markdown = '';
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe('paragraph');
      });
    });

    describe('Inline formatting', () => {
      it('should convert bold text', () => {
        const markdown = 'This is **bold** text.';
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks).toHaveLength(1);
        const content = blocks[0].content as Array<{ type: string; text: string; styles: Record<string, boolean> }>;
        const boldItem = content.find(item => item.styles?.bold);
        expect(boldItem).toBeDefined();
        expect(boldItem?.text).toBe('bold');
      });

      it('should convert italic text', () => {
        const markdown = 'This is *italic* text.';
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks).toHaveLength(1);
        const content = blocks[0].content as Array<{ type: string; text: string; styles: Record<string, boolean> }>;
        const italicItem = content.find(item => item.styles?.italic);
        expect(italicItem).toBeDefined();
        expect(italicItem?.text).toBe('italic');
      });

      it('should convert inline code', () => {
        const markdown = 'Use `console.log()` for debugging.';
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks).toHaveLength(1);
        const content = blocks[0].content as Array<{ type: string; text: string; styles: Record<string, boolean> }>;
        const codeItem = content.find(item => item.styles?.code);
        expect(codeItem).toBeDefined();
        expect(codeItem?.text).toBe('console.log()');
      });

      it('should convert links', () => {
        const markdown = 'Visit [Google](https://google.com) for search.';
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks).toHaveLength(1);
        const content = blocks[0].content as Array<{ type: string; href?: string }>;
        const linkItem = content.find(item => item.type === 'link');
        expect(linkItem).toBeDefined();
        expect(linkItem?.href).toBe('https://google.com');
      });

      it('should convert inline math', () => {
        const markdown = 'The formula $E=mc^2$ is famous.';
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks).toHaveLength(1);
        const content = blocks[0].content as Array<{ type: string; text: string }>;
        const mathItem = content.find(item => item.text?.includes('$E=mc^2$'));
        expect(mathItem).toBeDefined();
      });
    });

    describe('Lists', () => {
      it('should convert bullet list with dash', () => {
        const markdown = '- Item 1\n- Item 2\n- Item 3';
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks).toHaveLength(3);
        blocks.forEach(block => {
          expect(block.type).toBe('bulletListItem');
        });
      });

      it('should convert bullet list with asterisk', () => {
        const markdown = '* Item 1\n* Item 2';
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks).toHaveLength(2);
        blocks.forEach(block => {
          expect(block.type).toBe('bulletListItem');
        });
      });

      it('should convert numbered list', () => {
        const markdown = '1. First\n2. Second\n3. Third';
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks).toHaveLength(3);
        blocks.forEach(block => {
          expect(block.type).toBe('numberedListItem');
        });
      });
    });

    describe('Code blocks', () => {
      it('should convert code block with language', () => {
        const markdown = '```javascript\nconst x = 1;\n```';
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe('codeBlock');
        expect((blocks[0].props as { language: string }).language).toBe('javascript');
        expect(blocks[0].content).toBe('const x = 1;');
      });

      it('should convert code block without language', () => {
        const markdown = '```\nsome code\n```';
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe('codeBlock');
        expect((blocks[0].props as { language: string }).language).toBe('plaintext');
      });

      it('should convert multi-line code block', () => {
        const markdown = '```python\ndef hello():\n    print("Hello")\n```';
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe('codeBlock');
        expect(blocks[0].content).toContain('def hello():');
        expect(blocks[0].content).toContain('print("Hello")');
      });
    });

    describe('Images', () => {
      it('should convert image with alt text', () => {
        const markdown = '![Alt text](./assets/image.png)';
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe('image');
        expect((blocks[0].props as { url: string; caption: string }).url).toBe('./assets/image.png');
        expect((blocks[0].props as { url: string; caption: string }).caption).toBe('Alt text');
      });

      it('should convert image without alt text', () => {
        const markdown = '![](./image.png)';
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe('image');
        expect((blocks[0].props as { url: string }).url).toBe('./image.png');
      });
    });

    describe('Math blocks', () => {
      it('should convert block math', () => {
        const markdown = '$$\nx = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\n$$';
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks).toHaveLength(1);
        // Math is stored as paragraph with $$ markers for now
        const content = blocks[0].content as Array<{ text: string }>;
        expect(content[0].text).toContain('$$');
        expect(content[0].text).toContain('frac');
      });
    });

    describe('Tables', () => {
      it('should convert simple table', () => {
        const markdown = '| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |';
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe('table');
      });
    });

    describe('Mixed content', () => {
      it('should convert document with multiple block types', () => {
        const markdown = `# Title

This is a paragraph.

- Item 1
- Item 2

\`\`\`javascript
const x = 1;
\`\`\``;
        
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks.length).toBeGreaterThan(3);
        expect(blocks[0].type).toBe('heading');
        expect(blocks[1].type).toBe('paragraph');
        expect(blocks.some(b => b.type === 'bulletListItem')).toBe(true);
        expect(blocks.some(b => b.type === 'codeBlock')).toBe(true);
      });
    });

    describe('YAML front matter', () => {
      it('should parse YAML front matter as code block', () => {
        const markdown = `---
Title: My Document
Sample Tracking: Yes
---

# Content`;
        
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks.length).toBeGreaterThanOrEqual(2);
        expect(blocks[0].type).toBe('codeBlock');
        expect((blocks[0].props as { language: string }).language).toBe('yaml-frontmatter');
        expect(blocks[0].content).toContain('Title: My Document');
        expect(blocks[0].content).toContain('Sample Tracking: Yes');
      });

      it('should parse YAML front matter with Sample Tracking field', () => {
        const markdown = `---
Sample Tracking: Yes
Author: Test User
---

Some content`;
        
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks[0].type).toBe('codeBlock');
        expect((blocks[0].props as { language: string }).language).toBe('yaml-frontmatter');
        expect(blocks[0].content).toContain('Sample Tracking: Yes');
      });

      it('should handle YAML front matter at the beginning only', () => {
        const markdown = `---
Title: Test
---

# Heading

---

This is a horizontal rule`;
        
        const blocks = markdownToBlocks(markdown);
        
        // First block should be YAML
        expect(blocks[0].type).toBe('codeBlock');
        expect((blocks[0].props as { language: string }).language).toBe('yaml-frontmatter');
        
        // Following content should be heading and paragraph
        expect(blocks.some(b => b.type === 'heading')).toBe(true);
      });

      it('should handle empty YAML front matter', () => {
        const markdown = `---
---

# Content`;
        
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks[0].type).toBe('codeBlock');
        expect((blocks[0].props as { language: string }).language).toBe('yaml-frontmatter');
        expect(blocks[0].content).toBe('');
      });

      it('should handle markdown without YAML front matter', () => {
        const markdown = `# Title

No YAML here`;
        
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks[0].type).toBe('heading');
      });

      it('should handle multi-line YAML values', () => {
        const markdown = `---
Title: My Document
Description: |
  This is a multi-line
  description text
Sample Tracking: Yes
---

Content`;
        
        const blocks = markdownToBlocks(markdown);
        
        expect(blocks[0].type).toBe('codeBlock');
        expect(blocks[0].content).toContain('Description: |');
        expect(blocks[0].content).toContain('multi-line');
      });
    });
  });
});
