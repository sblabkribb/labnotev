import { useState, useMemo } from 'react';
import { Group, Modal, Text } from '@mantine/core';
import {
  MARKDOWN_FILE_LINK_RE,
  normalizeLocalMarkdownHref,
  isWorkflowDocLink,
  isImagePath,
} from '../lib/markdownLocalLinks';

const INLINE_IMAGE_PATTERN = /!\[([^\]]*)\]\(([^)]+)\)/g;

export interface ParsedImage {
  alt: string;
  path: string;
}

/**
 * Collects image paths from `![](path)` and from attachment-style `[label](path)` for image extensions.
 * Dedupes by normalized relative path.
 */
export function parseImageLinks(content: string): ParsedImage[] {
  const byPath = new Map<string, ParsedImage>();

  const tryAdd = (hrefRaw: string, alt: string) => {
    const normalized = normalizeLocalMarkdownHref(hrefRaw.trim());
    if (!normalized || isWorkflowDocLink(normalized)) return;
    if (!isImagePath(normalized)) return;
    if (!byPath.has(normalized)) {
      const displayAlt = (alt || '').trim() || normalized;
      byPath.set(normalized, { path: normalized, alt: displayAlt });
    }
  };

  let match: RegExpExecArray | null;
  const rInline = new RegExp(INLINE_IMAGE_PATTERN.source, 'g');
  while ((match = rInline.exec(content)) !== null) {
    tryAdd(match[2], match[1] || match[2]);
  }

  const rLink = new RegExp(MARKDOWN_FILE_LINK_RE.source, 'g');
  while ((match = rLink.exec(content)) !== null) {
    tryAdd(match[2], match[1] || match[2]);
  }

  return Array.from(byPath.values());
}

interface ImageThumbnailsProps {
  content: string;
  docBaseUri: string;
}

export function ImageThumbnails({ content, docBaseUri }: ImageThumbnailsProps) {
  const images = useMemo(() => parseImageLinks(content), [content]);
  const [preview, setPreview] = useState<ParsedImage | null>(null);

  if (images.length === 0 || !docBaseUri) return null;

  return (
    <>
      <Group gap="xs" mt={4}>
        {images.map((img, i) => (
          <div
            key={`${img.path}-${i}`}
            onClick={() => setPreview(img)}
            style={{
              cursor: 'pointer',
              border: '1px solid var(--mantine-color-default-border)',
              borderRadius: 4,
              padding: 2,
              display: 'inline-block',
            }}
          >
            <img
              src={`${docBaseUri}/${img.path}`}
              alt={img.alt}
              style={{ maxHeight: 100, maxWidth: 160, display: 'block', borderRadius: 2 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            {img.alt !== img.path && (
              <Text size="xs" c="dimmed" ta="center" truncate style={{ maxWidth: 160 }}>
                {img.alt}
              </Text>
            )}
          </div>
        ))}
      </Group>

      <Modal
        opened={!!preview}
        onClose={() => setPreview(null)}
        size="xl"
        title={preview?.alt || 'Image Preview'}
        centered
      >
        {preview && (
          <>
            <img
              src={`${docBaseUri}/${preview.path}`}
              alt={preview.alt}
              style={{ width: '100%', borderRadius: 4 }}
            />
            <Text size="xs" c="dimmed" mt="xs">{preview.path}</Text>
          </>
        )}
      </Modal>
    </>
  );
}
