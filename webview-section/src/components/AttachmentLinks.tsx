import { useMemo } from 'react';
import { Group, Text, Anchor } from '@mantine/core';
import { postMessage } from '../vscodeApi';
import {
  MARKDOWN_FILE_LINK_RE,
  normalizeLocalMarkdownHref,
  isWorkflowDocLink,
  isImagePath,
} from '../lib/markdownLocalLinks';

export interface ParsedAttachmentLink {
  label: string;
  path: string;
}

/**
 * Extract `[label](path)` file links under the experiment folder (non-image only).
 * Image paths are shown as thumbnails in ImageThumbnails (paste + linked attachments).
 */
export function parseResourceAttachmentLinks(content: string): ParsedAttachmentLink[] {
  const out: ParsedAttachmentLink[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(MARKDOWN_FILE_LINK_RE.source, 'g');
  while ((match = re.exec(content)) !== null) {
    const label = match[1].trim() || match[2].trim();
    const hrefRaw = match[2];
    const href = normalizeLocalMarkdownHref(hrefRaw);
    if (!href || isWorkflowDocLink(href)) continue;
    if (isImagePath(href)) continue;

    let include = false;
    if (href.startsWith('images/')) {
      include = true;
    } else if (href.startsWith('resources/')) {
      include = true;
    } else if (href.includes('/')) {
      include = true;
    } else if (/\.[a-z0-9]{2,12}$/i.test(href)) {
      include = true;
    }

    if (!include) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    out.push({ label: label || href, path: href });
  }
  return out;
}

interface AttachmentLinksProps {
  content: string;
}

export function AttachmentLinks({ content }: AttachmentLinksProps) {
  const links = useMemo(() => parseResourceAttachmentLinks(content), [content]);

  if (links.length === 0) return null;

  return (
    <Group gap="xs" mt={4} wrap="wrap">
      {links.map((link, i) => (
        <Anchor
          key={`${link.path}-${i}`}
          size="xs"
          onClick={(e) => {
            e.preventDefault();
            postMessage({ type: 'openAttachment', data: { path: link.path } });
          }}
          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <PaperclipGlyph />
          <Text span size="xs" inherit>
            {link.label}
          </Text>
        </Anchor>
      ))}
    </Group>
  );
}

function PaperclipGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
      <path d="M9.5 4.5L4.5 9.5a2 2 0 102.8 2.8l5.8-5.8a2.5 2.5 0 00-3.5-3.5L3.8 8.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
