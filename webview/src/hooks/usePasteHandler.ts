import { useEffect, useCallback } from 'react';
import { BlockNoteEditor } from '@blocknote/core';

interface PasteHandlerOptions {
  editor: BlockNoteEditor<any, any, any>;
  onSaveImage: (base64Data: string, filename: string) => Promise<string>;
}

/**
 * Custom paste handler hook for handling various content types
 * - Text (plain text)
 * - Rich text (HTML from web/documents)
 * - Images (clipboard screenshots)
 * - Files (image files from file explorer)
 */
export function usePasteHandler({ editor, onSaveImage }: PasteHandlerOptions) {
  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    const clipboardData = event.clipboardData;
    if (!clipboardData) return;

    // Collect image files - avoid duplicates by checking files first, then items only if needed
    const imageFiles: File[] = [];
    
    // Check for files (images from file explorer or screenshots)
    const files = clipboardData.files;
    
    // First, check clipboardData.files
    const imageFilesFromFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    
    if (imageFilesFromFiles.length > 0) {
      // If we found images in files, use only those (avoid duplicates from items)
      imageFiles.push(...imageFilesFromFiles);
    } else {
      // Only check items if no images found in files
      const items = clipboardData.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              imageFiles.push(file);
            }
          }
        }
      }
    }

    // If we found any images, handle them and prevent default behavior
    if (imageFiles.length > 0) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      
      // Process all image files
      for (const file of imageFiles) {
        await handleImageFile(file, editor, onSaveImage);
      }
      return;
    }

    // For HTML content, let BlockNote handle it natively
    // BlockNote already has good support for HTML paste
    const htmlContent = clipboardData.getData('text/html');
    if (htmlContent) {
      // BlockNote will handle HTML paste automatically
      return;
    }

    // For plain text, let BlockNote handle it
    // BlockNote has native support for plain text paste
  }, [editor, onSaveImage]);

  useEffect(() => {
    // Use capture phase to intercept before BlockNote's handler
    document.addEventListener('paste', handlePaste, true);
    return () => {
      document.removeEventListener('paste', handlePaste, true);
    };
  }, [handlePaste]);
}

async function handleImageFile(
  file: File,
  editor: BlockNoteEditor<any, any, any>,
  onSaveImage: (base64Data: string, filename: string) => Promise<string>
) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const ext = getImageExtension(file.type);
  const filename = `${timestamp}_${random}.${ext}`;

  try {
    // Read file as base64
    const base64 = await readFileAsBase64(file);
    
    // Save image and get relative path
    const relativePath = await onSaveImage(base64, filename);
    
    // Insert image block at current cursor position
    const currentBlock = editor.getTextCursorPosition().block;
    editor.insertBlocks(
      [
        {
          type: 'image',
          props: {
            url: relativePath,
            caption: file.name || '',
          },
        },
      ],
      currentBlock,
      'after'
    );
  } catch (error) {
    console.error('Failed to paste image:', error);
  }
}

function getImageExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
  };
  return map[mimeType] || 'png';
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix to get pure base64
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
