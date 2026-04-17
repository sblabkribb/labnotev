import { useMemo } from 'react';
import { Group, Text, Anchor } from '@mantine/core';
import { postMessage } from '../vscodeApi';

const RESOURCE_LINK_RE = /\[([^\]]*)\]\((resources\/[^)]+)\)/g;

const IMAGE_EXT = /\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i;

export interface ParsedAttachmentLink {
  label: string;
  path: string;
}

/** Extract markdown links pointing at resources/... excluding common image extensions (ImageThumbnails handles those). */
export function parseResourceAttachmentLinks(content: string): ParsedAttachmentLink[] {
  const out: ParsedAttachmentLink[] = [];
  const re = new RegExp(RESOURCE_LINK_RE.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const label = match[1].trim() || match[2];
    const href = match[2].trim();
    if (IMAGE_EXT.test(href)) continue;
    out.push({ label, path: href });
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
