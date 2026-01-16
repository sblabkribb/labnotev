import { Block, BlockNoteEditor, PartialBlock } from '@blocknote/core';

/**
 * Convert Markdown string to BlockNote blocks
 */
export function markdownToBlocks(markdown: string): PartialBlock[] {
  const lines = markdown.split('\n');
  const blocks: PartialBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Empty line - skip
    if (!line.trim()) {
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      blocks.push({
        type: 'heading',
        props: { level: Math.min(level, 3) as 1 | 2 | 3 },
        content: parseInlineContent(headingMatch[2]),
      });
      i++;
      continue;
    }

    // Code block
    if (line.startsWith('```')) {
      const language = line.slice(3).trim() || 'plaintext';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: 'codeBlock',
        props: { language },
        content: codeLines.join('\n'),
      });
      i++; // Skip closing ```
      continue;
    }

    // Math block ($$...$$)
    if (line.startsWith('$$')) {
      const mathLines: string[] = [];
      if (line.length > 2 && line.endsWith('$$')) {
        // Single line math
        mathLines.push(line.slice(2, -2));
      } else {
        i++;
        while (i < lines.length && !lines[i].startsWith('$$')) {
          mathLines.push(lines[i]);
          i++;
        }
      }
      // Store math as a paragraph with special marker for now
      // Will be converted to custom math block later
      blocks.push({
        type: 'paragraph',
        content: [{ type: 'text', text: `$$${mathLines.join('\n')}$$`, styles: {} }],
      });
      i++;
      continue;
    }

    // Bullet list
    if (line.match(/^[\-\*]\s+/)) {
      const listItems: PartialBlock[] = [];
      while (i < lines.length && lines[i].match(/^[\-\*]\s+/)) {
        const content = lines[i].replace(/^[\-\*]\s+/, '');
        listItems.push({
          type: 'bulletListItem',
          content: parseInlineContent(content),
        });
        i++;
      }
      blocks.push(...listItems);
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\.\s+/)) {
      const listItems: PartialBlock[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        const content = lines[i].replace(/^\d+\.\s+/, '');
        listItems.push({
          type: 'numberedListItem',
          content: parseInlineContent(content),
        });
        i++;
      }
      blocks.push(...listItems);
      continue;
    }

    // Image
    const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatch) {
      blocks.push({
        type: 'image',
        props: {
          url: imageMatch[2],
          caption: imageMatch[1] || undefined,
        },
      });
      i++;
      continue;
    }

    // Table (GFM)
    if (line.includes('|')) {
      const tableRows: string[][] = [];
      while (i < lines.length && lines[i].includes('|')) {
        const row = lines[i]
          .split('|')
          .map((cell) => cell.trim())
          .filter((cell) => cell && !cell.match(/^[-:]+$/));
        if (row.length > 0 && !lines[i].match(/^\|?[\s\-:|]+\|?$/)) {
          tableRows.push(row);
        }
        i++;
      }
      if (tableRows.length > 0) {
        blocks.push({
          type: 'table',
          content: {
            type: 'tableContent',
            rows: tableRows.map((row) => ({
              cells: row.map((cell) => parseInlineContent(cell)),
            })),
          },
        });
      }
      continue;
    }

    // Horizontal rule
    if (line.match(/^[-*_]{3,}$/)) {
      // BlockNote doesn't have HR, skip or convert to empty paragraph
      i++;
      continue;
    }

    // Default: paragraph
    blocks.push({
      type: 'paragraph',
      content: parseInlineContent(line),
    });
    i++;
  }

  return blocks.length > 0 ? blocks : [{ type: 'paragraph', content: [] }];
}

/**
 * Parse inline content (bold, italic, code, links, inline math)
 */
function parseInlineContent(text: string): Array<{
  type: 'text' | 'link';
  text?: string;
  href?: string;
  content?: Array<{ type: 'text'; text: string; styles: Record<string, boolean> }>;
  styles: Record<string, boolean>;
}> {
  const result: Array<{
    type: 'text' | 'link';
    text?: string;
    href?: string;
    content?: Array<{ type: 'text'; text: string; styles: Record<string, boolean> }>;
    styles: Record<string, boolean>;
  }> = [];

  // Simple regex-based parsing
  // This is a simplified version - a full parser would be more complex
  let remaining = text;
  
  while (remaining.length > 0) {
    // Inline math $...$
    const mathMatch = remaining.match(/^\$([^$]+)\$/);
    if (mathMatch) {
      result.push({ type: 'text', text: `$${mathMatch[1]}$`, styles: {} });
      remaining = remaining.slice(mathMatch[0].length);
      continue;
    }

    // Inline code `...`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      result.push({ type: 'text', text: codeMatch[1], styles: { code: true } });
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Bold **...**
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      result.push({ type: 'text', text: boldMatch[1], styles: { bold: true } });
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic *...*
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      result.push({ type: 'text', text: italicMatch[1], styles: { italic: true } });
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Link [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      result.push({
        type: 'link',
        href: linkMatch[2],
        content: [{ type: 'text', text: linkMatch[1], styles: {} }],
        styles: {},
      });
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Regular text until next special character
    const nextSpecial = remaining.search(/[\$`*\[]/);
    if (nextSpecial === -1) {
      result.push({ type: 'text', text: remaining, styles: {} });
      break;
    } else if (nextSpecial === 0) {
      // Special char that didn't match - treat as regular text
      result.push({ type: 'text', text: remaining[0], styles: {} });
      remaining = remaining.slice(1);
    } else {
      result.push({ type: 'text', text: remaining.slice(0, nextSpecial), styles: {} });
      remaining = remaining.slice(nextSpecial);
    }
  }

  return result.length > 0 ? result : [{ type: 'text', text: '', styles: {} }];
}

/**
 * Convert BlockNote blocks to Markdown string
 */
export async function blocksToMarkdown(editor: BlockNoteEditor): Promise<string> {
  const blocks = editor.document;
  const lines: string[] = [];

  for (const block of blocks) {
    const markdown = blockToMarkdown(block as Block);
    if (markdown !== null) {
      lines.push(markdown);
    }
  }

  return lines.join('\n\n');
}

function blockToMarkdown(block: Block): string | null {
  switch (block.type) {
    case 'paragraph':
      return inlineContentToMarkdown(block.content);

    case 'heading':
      const level = (block.props as { level: number }).level || 1;
      const prefix = '#'.repeat(level);
      return `${prefix} ${inlineContentToMarkdown(block.content)}`;

    case 'bulletListItem':
      return `- ${inlineContentToMarkdown(block.content)}`;

    case 'numberedListItem':
      return `1. ${inlineContentToMarkdown(block.content)}`;

    case 'codeBlock':
      const language = (block.props as { language?: string }).language || '';
      const code = typeof block.content === 'string' ? block.content : '';
      return `\`\`\`${language}\n${code}\n\`\`\``;

    case 'image':
      const props = block.props as { url?: string; caption?: string };
      const caption = props.caption || '';
      const url = props.url || '';
      return `![${caption}](${url})`;

    case 'table':
      return tableToMarkdown(block);

    default:
      return null;
  }
}

function inlineContentToMarkdown(content: unknown): string {
  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((item: {
      type: string;
      text?: string;
      href?: string;
      content?: unknown;
      styles?: Record<string, boolean>;
    }) => {
      if (item.type === 'link') {
        const linkText = inlineContentToMarkdown(item.content);
        return `[${linkText}](${item.href || ''})`;
      }

      let text = item.text || '';
      const styles = item.styles || {};

      if (styles.code) {
        text = `\`${text}\``;
      }
      if (styles.bold) {
        text = `**${text}**`;
      }
      if (styles.italic) {
        text = `*${text}*`;
      }

      return text;
    })
    .join('');
}

function tableToMarkdown(block: Block): string {
  const content = block.content as {
    type: string;
    rows?: Array<{ cells: unknown[] }>;
  };
  
  if (!content || !content.rows || content.rows.length === 0) {
    return '';
  }

  const rows = content.rows;
  const lines: string[] = [];

  rows.forEach((row, index) => {
    const cells = row.cells.map((cell) => inlineContentToMarkdown(cell));
    lines.push(`| ${cells.join(' | ')} |`);
    
    if (index === 0) {
      // Add separator after header
      lines.push(`| ${cells.map(() => '---').join(' | ')} |`);
    }
  });

  return lines.join('\n');
}
