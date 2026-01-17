import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BlockNoteEditor,
  BlockNoteSchema,
  defaultBlockSpecs,
  PartialBlock,
} from '@blocknote/core';
import { BlockNoteView } from '@blocknote/mantine';
import {
  useCreateBlockNote,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from '@blocknote/react';
import { markdownToBlocks, blocksToMarkdown } from './markdownConverter';
import { MathBlock, insertMathBlock } from './blocks/MathBlock';
import { usePasteHandler } from './hooks/usePasteHandler';
import { useVSCodeTheme } from './hooks/useVSCodeTheme';
import { getLabNoteSlashMenuItems } from './slashCommands';

interface EditorProps {
  initialContent: string;
  documentUri: string;
  onSave: (markdown: string) => void;
  onSaveImage: (base64Data: string, filename: string) => Promise<string>;
  resolveAssetUrl?: (relativePath: string) => Promise<string>;
}

export const Editor: React.FC<EditorProps> = ({
  initialContent,
  documentUri,
  onSave,
  onSaveImage,
  resolveAssetUrl,
}) => {
  const saveTimeoutRef = useRef<number | null>(null);
  const isInitializedRef = useRef(false);
  const lastSavedContentRef = useRef<string>(initialContent);
  const vscodeTheme = useVSCodeTheme();

  // Parse initial content to blocks
  const initialBlocks = useMemo(() => {
    if (!initialContent.trim()) {
      return undefined;
    }
    try {
      return markdownToBlocks(initialContent);
    } catch (e) {
      console.error('Error parsing markdown:', e);
      return undefined;
    }
  }, [initialContent]);

  // Custom schema with math block
  const schema = useMemo(() => BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      math: MathBlock,
    },
  }), []);

  // Custom upload handler for images
  const uploadFile = useCallback(async (file: File): Promise<string> => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const ext = file.name.split('.').pop() || 'png';
    const filename = `${timestamp}_${random}.${ext}`;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const relativePath = await onSaveImage(base64, filename);
        resolve(relativePath);
      };
      reader.readAsDataURL(file);
    });
  }, [onSaveImage]);

  // Resolve file URLs for images (convert relative paths to vscode-resource URIs)
  const resolveFileUrl = useCallback(async (url: string): Promise<string> => {
    // If it's already an absolute URL or data URL, return as is
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('vscode-')) {
      return url;
    }
    // If it's a relative path, resolve it via the extension
    if (resolveAssetUrl && (url.startsWith('./') || url.startsWith('../') || !url.includes('://'))) {
      try {
        return await resolveAssetUrl(url);
      } catch (e) {
        console.error('Failed to resolve asset URL:', e);
        return url;
      }
    }
    return url;
  }, [resolveAssetUrl]);

  // Create BlockNote editor with custom schema
  const editor = useCreateBlockNote({
    schema,
    initialContent: initialBlocks as PartialBlock[] | undefined,
    uploadFile,
    resolveFileUrl,
  });

  // Custom slash menu items
  const slashMenuItems = useMemo(() => [
    ...getDefaultReactSlashMenuItems(editor),
    insertMathBlock,
    ...getLabNoteSlashMenuItems(editor),
  ], [editor]);

  // Handle paste events (Ctrl+V)
  usePasteHandler({ editor, onSaveImage });

  // Handle content changes with debounced save
  const handleChange = useCallback(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      return;
    }

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(async () => {
      const markdown = await blocksToMarkdown(editor);
      if (markdown !== lastSavedContentRef.current) {
        lastSavedContentRef.current = markdown;
        onSave(markdown);
      }
    }, 500);
  }, [editor, onSave]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="editor-container">
      <BlockNoteView
        editor={editor}
        onChange={handleChange}
        theme={vscodeTheme}
        slashMenu={false}
        data-theming-css-variables-demo
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) =>
            slashMenuItems.filter(
              (item) =>
                item.name.toLowerCase().includes(query.toLowerCase()) ||
                item.aliases?.some((alias) =>
                  alias.toLowerCase().includes(query.toLowerCase())
                )
            )
          }
        />
      </BlockNoteView>
    </div>
  );
};
