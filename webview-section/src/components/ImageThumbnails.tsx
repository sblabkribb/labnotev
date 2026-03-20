import { useState, useMemo } from 'react';
import { Group, Modal, Text } from '@mantine/core';

const IMAGE_LINK_PATTERN = /!\[([^\]]*)\]\(([^)]+)\)/g;

interface ParsedImage {
  alt: string;
  path: string;
}

function parseImageLinks(content: string): ParsedImage[] {
  const images: ParsedImage[] = [];
  let match;
  const regex = new RegExp(IMAGE_LINK_PATTERN);
  while ((match = regex.exec(content)) !== null) {
    const imgPath = match[2];
    if (/\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i.test(imgPath)) {
      images.push({ alt: match[1] || imgPath, path: imgPath });
    }
  }
  return images;
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
