import type {
  WorkflowDocument,
  WorkflowFrontMatter,
  UnitOperationBlock,
  UnitOpSection,
} from './sectionTypes';

function parseFrontMatter(md: string): { frontMatter: Record<string, unknown>; body: string } {
  const fmMatch = md.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    return { frontMatter: {}, body: md };
  }
  const yamlBlock = fmMatch[1];
  const body = md.slice(fmMatch[0].length).replace(/^\n+/, '');
  const fm: Record<string, unknown> = {};
  for (const line of yamlBlock.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value: string = line.slice(colonIdx + 1).trim();
    if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    fm[key] = value;
  }
  return { frontMatter: fm, body };
}

function serializeFrontMatter(fm: WorkflowFrontMatter): string {
  const lines: string[] = ['---'];
  const knownKeys = ['title', 'experimenter', 'created_date', 'last_updated_date', 'end_date'];
  for (const key of knownKeys) {
    const val = fm[key];
    if (key === 'end_date' && !val) {
      lines.push(`${key}: ''`);
    } else {
      lines.push(`${key}: ${val ?? ''}`);
    }
  }
  for (const [key, val] of Object.entries(fm)) {
    if (!knownKeys.includes(key)) {
      lines.push(`${key}: ${val ?? ''}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

const H2_PATTERN = /^##\s+/;
const H3_PATTERN = /^###\s+/;
const H4_PATTERN = /^####\s+/;
const HR_PATTERN = /^---\s*$/;
const UNIT_OP_HEADING_PATTERN = /^###\s+\[([A-Z]+\d+)\s+(.+?)\]\s*(.*)/;
const BLOCKQUOTE_PATTERN = /^>\s*(.*)/;

/** Catalog ids use UHW/USW (see workflowDataLoader); legacy markdown may use HW/SW prefixes. */
function detectOpType(opId: string): 'hw' | 'sw' {
  const u = opId.toUpperCase();
  if (u.startsWith('USW')) return 'sw';
  if (u.startsWith('UHW')) return 'hw';
  if (u.startsWith('SW')) return 'sw';
  if (u.startsWith('HW')) return 'hw';
  return 'hw';
}

/** Normalizes known H4 heading typos in unit operation sections (keep in sync with webview `normalizeUnitOpSectionHeading`). */
export function normalizeWorkflowUnitSectionHeading(heading: string): string {
  if (heading === 'Reagen') return 'Reagent';
  return heading;
}

export function parseWorkflowMd(md: string): WorkflowDocument {
  const { frontMatter: rawFm, body } = parseFrontMatter(md);

  const fm: WorkflowFrontMatter = {
    title: String(rawFm.title ?? ''),
    experimenter: String(rawFm.experimenter ?? ''),
    created_date: String(rawFm.created_date ?? ''),
    last_updated_date: String(rawFm.last_updated_date ?? ''),
    end_date: String(rawFm.end_date ?? ''),
  };
  for (const [k, v] of Object.entries(rawFm)) {
    if (!(k in fm)) {
      fm[k] = v;
    }
  }

  const lines = body.split('\n');
  let workflowHeader = '';
  let workflowDescription = '';
  const unitOperations: UnitOperationBlock[] = [];

  let i = 0;

  // Parse workflow header (first ## heading with [...])
  while (i < lines.length) {
    const h2Match = lines[i].match(/^##\s+(\[.+?\].*)/);
    if (h2Match) {
      workflowHeader = h2Match[1].trim();
      i++;
      // Next non-empty line could be blockquote description
      while (i < lines.length && lines[i].trim() === '') i++;
      if (i < lines.length) {
        const bqMatch = lines[i].match(BLOCKQUOTE_PATTERN);
        if (bqMatch) {
          workflowDescription = bqMatch[1].trim();
          i++;
        }
      }
      break;
    }
    i++;
  }

  // Skip to unit operations (past "Related Unit Operations" section)
  while (i < lines.length) {
    if (HR_PATTERN.test(lines[i].trim()) || UNIT_OP_HEADING_PATTERN.test(lines[i])) {
      break;
    }
    if (H2_PATTERN.test(lines[i]) && !/Related Unit Operations/i.test(lines[i])) {
      break;
    }
    i++;
  }

  // Parse unit operations
  let opCounter = 0;
  while (i < lines.length) {
    // Skip HR separators
    if (HR_PATTERN.test(lines[i].trim())) {
      i++;
      while (i < lines.length && lines[i].trim() === '') i++;
      continue;
    }

    // Check for tail section (## heading that is NOT a unit op heading and NOT "Related Unit Operations")
    if (H2_PATTERN.test(lines[i]) && !UNIT_OP_HEADING_PATTERN.test(lines[i])) {
      const headingText = lines[i].replace(/^##\s+/, '').trim();
      if (!/Related Unit Operations/i.test(headingText)) {
        break;
      }
    }

    const opMatch = lines[i].match(UNIT_OP_HEADING_PATTERN);
    if (opMatch) {
      opCounter++;
      const opId = opMatch[1];
      const opName = opMatch[2].trim();
      const alias = opMatch[3]?.trim() || undefined;
      i++;

      // Get description from blockquote
      let opDescription = '';
      while (i < lines.length && lines[i].trim() === '') i++;
      if (i < lines.length) {
        const bqMatch = lines[i].match(BLOCKQUOTE_PATTERN);
        if (bqMatch) {
          opDescription = bqMatch[1].trim();
          i++;
        }
      }

      // Parse #### sections until next --- or ### or ## or EOF
      const sections: UnitOpSection[] = [];
      while (i < lines.length) {
        if (HR_PATTERN.test(lines[i].trim()) || UNIT_OP_HEADING_PATTERN.test(lines[i])) {
          break;
        }
        if (H2_PATTERN.test(lines[i]) && !/Related Unit Operations/i.test(lines[i])) {
          break;
        }

        const h4Match = lines[i].match(/^####\s+(.*)/);
        if (h4Match) {
          const heading = normalizeWorkflowUnitSectionHeading(h4Match[1].trim());
          i++;
          const contentLines: string[] = [];
          while (i < lines.length) {
            if (H4_PATTERN.test(lines[i]) || HR_PATTERN.test(lines[i].trim()) || UNIT_OP_HEADING_PATTERN.test(lines[i])) {
              break;
            }
            if (H2_PATTERN.test(lines[i]) && !/Related Unit Operations/i.test(lines[i])) {
              break;
            }
            contentLines.push(lines[i]);
            i++;
          }
          sections.push({
            heading,
            content: contentLines.join('\n').replace(/^\n+/, '').replace(/\n+$/, ''),
          });
          continue;
        }

        i++;
      }

      unitOperations.push({
        id: `unitop-${opCounter}`,
        opId,
        opName,
        opDescription,
        opType: detectOpType(opId),
        alias,
        sections,
      });
      continue;
    }

    i++;
  }

  // Parse tail content (everything from the current position onwards)
  // Strip the "## Conclusions and Discussion" heading since the UI renders it separately
  let tailContent = '';
  if (i < lines.length) {
    const raw = lines.slice(i).join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
    tailContent = raw.replace(/^##\s+Conclusions and Discussion\s*\n?/, '').replace(/^\n+/, '');
  }

  return { frontMatter: fm, workflowHeader, workflowDescription, unitOperations, tailContent };
}

export function serializeWorkflowMd(doc: WorkflowDocument): string {
  const parts: string[] = [serializeFrontMatter(doc.frontMatter), ''];

  // Workflow header
  parts.push(`## ${doc.workflowHeader}`);
  parts.push('');
  if (doc.workflowDescription) {
    parts.push(`> ${doc.workflowDescription}`);
    parts.push('');
  }

  // Related Unit Operations section marker with TOC
  parts.push('## Related Unit Operations');
  parts.push('');
  if (doc.unitOperations.length > 0) {
    for (const op of doc.unitOperations) {
      const label = `${op.opId} ${op.opName}`;
      const headingText = `[${op.opId} ${op.opName}]${op.alias ? ' ' + op.alias : ''}`;
      const slug = headingText.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/^-+|-+$/g, '');
      parts.push(`- [${label}](#${slug})`);
    }
    parts.push('');
  }

  // Unit operations
  for (const op of doc.unitOperations) {
    parts.push('---');
    parts.push('');
    parts.push(`### [${op.opId} ${op.opName}]${op.alias ? ' ' + op.alias : ''}`);
    parts.push('');
    if (op.opDescription) {
      parts.push(`> ${op.opDescription}`);
      parts.push('');
    }
    for (const section of op.sections) {
      parts.push(`#### ${section.heading}`);
      parts.push(section.content);
      parts.push('');
    }
  }

  // Tail section (always write the heading; content may be empty)
  parts.push('## Conclusions and Discussion');
  parts.push('');
  if (doc.tailContent) {
    parts.push(doc.tailContent);
    parts.push('');
  }
  parts.push('');

  return parts.join('\n');
}

export function validateWorkflowDocument(doc: WorkflowDocument): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!doc.frontMatter.title) {
    errors.push('title is required in front matter');
  }
  if (!doc.frontMatter.experimenter) {
    errors.push('experimenter is required in front matter');
  }
  if (!doc.frontMatter.created_date) {
    errors.push('created_date is required in front matter');
  }

  return { ok: errors.length === 0, errors };
}
