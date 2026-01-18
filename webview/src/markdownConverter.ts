import { Block, BlockNoteEditor, PartialBlock } from '@blocknote/core';

/**
 * Convert Markdown string to BlockNote blocks
 */
export function markdownToBlocks(markdown: string): PartialBlock[] {
  const lines = markdown.split('\n');
  const blocks: PartialBlock[] = [];
  let i = 0;

  // YAML front matter detection (must be at the very beginning)
  if (lines[0]?.trim() === '---') {
    let yamlEndIndex = -1;
    for (let j = 1; j < lines.length; j++) {
      if (lines[j].trim() === '---') {
        yamlEndIndex = j;
        break;
      }
    }
    if (yamlEndIndex > 0) {
      const yamlContent = lines.slice(1, yamlEndIndex).join('\n');
      // Store YAML as paragraph with special marker (codeBlock causes NaN error in BlockNote)
      // Format: ___YAML_FRONTMATTER___\n{content}\n___END_YAML___
      blocks.push({
        type: 'paragraph',
        content: [{ type: 'text', text: `___YAML_FRONTMATTER___\n${yamlContent}\n___END_YAML___`, styles: {} }],
      });
      i = yamlEndIndex + 1;
    }
  }

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
      // Store code block as paragraph with special marker (codeBlock causes NaN error)
      blocks.push({
        type: 'paragraph',
        content: [{ type: 'text', text: `___CODE_BLOCK_${language}___\n${codeLines.join('\n')}\n___END_CODE___`, styles: {} }],
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

    // Quote (blockquote)
    if (line.match(/^>\s*/)) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].match(/^>\s*/)) {
        quoteLines.push(lines[i].replace(/^>\s*/, ''));
        i++;
      }
      blocks.push({
        type: 'paragraph',
        content: [{ type: 'text', text: `___QUOTE___\n${quoteLines.join('\n')}\n___END_QUOTE___`, styles: {} }],
      });
      continue;
    }

    // Checklist item (- [ ] or - [x])
    const checklistMatch = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (checklistMatch) {
      const content = checklistMatch[3];
      const checked = checklistMatch[2].toLowerCase() === 'x';
      blocks.push({
        type: 'checkListItem',
        props: { checked },
        content: parseInlineContent(content),
      } as PartialBlock);
      i++;
      continue;
    }

    // Bullet list (with indentation support)
    const bulletMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (bulletMatch) {
      const content = bulletMatch[2];
      blocks.push({
        type: 'bulletListItem',
        content: parseInlineContent(content),
      });
      i++;
      continue;
    }

    // Numbered list (with indentation support)
    const numberedMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (numberedMatch) {
      const content = numberedMatch[2];
      blocks.push({
        type: 'numberedListItem',
        content: parseInlineContent(content),
      });
      i++;
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
          props: {},
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

    // Horizontal rule (store as special marker in paragraph)
    if (line.match(/^[-*_]{3,}$/)) {
      blocks.push({
        type: 'paragraph',
        content: [{ type: 'text', text: '___HORIZONTAL_RULE___', styles: {} }],
      });
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

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const isFirst = i === 0;
    const markdownLines = blockToMarkdownWithChildren(block as Block, isFirst, 0);
    lines.push(...markdownLines);
  }

  return lines.join('\n\n');
}

/**
 * Convert a block and its children to markdown lines
 * Returns array of markdown lines (to handle children properly)
 */
function blockToMarkdownWithChildren(block: Block, isFirst: boolean = false, indentLevel: number = 0): string[] {
  const indent = '  '.repeat(indentLevel);
  const result: string[] = [];
  
  const mainMarkdown = blockToMarkdown(block, isFirst, indent);
  if (mainMarkdown !== null) {
    result.push(mainMarkdown);
  }
  
  // Process children recursively
  const children = (block as any).children;
  if (Array.isArray(children) && children.length > 0) {
    for (const child of children) {
      const childLines = blockToMarkdownWithChildren(child as Block, false, indentLevel + 1);
      result.push(...childLines);
    }
  }
  
  return result;
}

function blockToMarkdown(block: Block, isFirst: boolean = false, indent: string = ''): string | null {
  switch (block.type) {
    case 'paragraph':
      const text = inlineContentToMarkdown(block.content);
      // Check for YAML front matter marker
      if (text.startsWith('___YAML_FRONTMATTER___\n') && text.endsWith('\n___END_YAML___')) {
        const yamlContent = text.slice('___YAML_FRONTMATTER___\n'.length, -'\n___END_YAML___'.length);
        return `---\n${yamlContent}\n---`;
      }
      // Check for code block marker
      const codeBlockMatch = text.match(/^___CODE_BLOCK_(.+?)___\n([\s\S]*)\n___END_CODE___$/);
      if (codeBlockMatch) {
        const language = codeBlockMatch[1];
        const code = codeBlockMatch[2];
        return `\`\`\`${language}\n${code}\n\`\`\``;
      }
      // Check for horizontal rule marker
      if (text === '___HORIZONTAL_RULE___') {
        return '---';
      }
      // Check for quote marker
      if (text.startsWith('___QUOTE___\n') && text.endsWith('\n___END_QUOTE___')) {
        const quoteContent = text.slice('___QUOTE___\n'.length, -'\n___END_QUOTE___'.length);
        return quoteContent.split('\n').map(line => `> ${line}`).join('\n');
      }
      return text;

    case 'heading':
      const level = (block.props as { level: number }).level || 1;
      const prefix = '#'.repeat(level);
      return `${prefix} ${inlineContentToMarkdown(block.content)}`;

    case 'bulletListItem':
      return `${indent}- ${inlineContentToMarkdown(block.content)}`;

    case 'numberedListItem':
      return `${indent}1. ${inlineContentToMarkdown(block.content)}`;

    case 'checkListItem':
      const checked = (block.props as { checked?: boolean }).checked;
      const checkbox = checked ? '[x]' : '[ ]';
      return `${indent}- ${checkbox} ${inlineContentToMarkdown(block.content)}`;

    case 'quote':
      return `> ${inlineContentToMarkdown(block.content)}`;

    case 'codeBlock':
      const language = (block.props as { language?: string }).language || '';
      const code = typeof block.content === 'string' ? block.content : '';
      
      // First yaml block is treated as YAML front matter
      if (isFirst && language === 'yaml') {
        return `---\n${code}\n---`;
      }
      
      return `\`\`\`${language}\n${code}\n\`\`\``;

    case 'image':
      const props = block.props as { url?: string; caption?: string };
      const caption = props.caption || '';
      const url = props.url || '';
      return `![${caption}](${url})`;

    case 'table':
      return tableToMarkdown(block);

    default:
      // For unknown block types, try to extract text content
      const unknownContent = inlineContentToMarkdown(block.content);
      return unknownContent || null;
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
