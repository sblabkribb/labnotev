import React, { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import {
  BlockNoteSchema,
  defaultBlockSpecs,
} from '@blocknote/core';
import { BlockNoteView } from '@blocknote/mantine';
import {
  useCreateBlockNote,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from '@blocknote/react';
import { markdownToBlocks, blocksToMarkdown } from './markdownConverter';
import { MathBlock, createInsertMathBlock } from './blocks/MathBlock';
import { usePasteHandler } from './hooks/usePasteHandler';
import { useVSCodeTheme } from './hooks/useVSCodeTheme';
import { 
  getLabNoteSlashMenuItems, 
  createSampleSlashItemsWithExisting,
  SAMPLE_TYPES,
  SampleRecord,
} from './slashCommands';
import { SampleInputDialog, SampleInputResult } from './components/SampleInputDialog';
import { vscode } from './vscodeApi';

interface EditorProps {
  initialContent: string;
  documentUri: string;
  onSave: (markdown: string) => void;
  onSaveImage: (base64Data: string, filename: string) => Promise<string>;
  resolveAssetUrl?: (relativePath: string) => Promise<string>;
}

/**
 * Calculate match score for an item based on query terms
 * Higher score = more query terms matched
 */
export function calculateMatchScore(
  item: { title?: string; subtext?: string; aliases?: string[] },
  queryTerms: string[]
): number {
  let score = 0;
  const searchableText = [
    (item.title || '').toLowerCase(),
    (item.subtext || '').toLowerCase(),
    ...(item.aliases || []).map(a => a.toLowerCase())
  ].join(' ');

  for (const term of queryTerms) {
    if (searchableText.includes(term.toLowerCase())) {
      score++;
    }
  }
  return score;
}

export const Editor: React.FC<EditorProps> = ({
  initialContent,
  documentUri: _documentUri,
  onSave,
  onSaveImage,
  resolveAssetUrl,
}) => {
  const saveTimeoutRef = useRef<number | null>(null);
  const isInitializedRef = useRef(false);
  const lastSavedContentRef = useRef<string>(initialContent);
  const vscodeTheme = useVSCodeTheme();

  // Sample dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingSample, setPendingSample] = useState<{ type: string; id: string } | null>(null);
  
  // Sample data cache (loaded from extension)
  const [samplesCache, setSamplesCache] = useState<Record<string, Record<string, SampleRecord>>>({});

  // Parse initial content to blocks
  const initialBlocks = useMemo(() => {
    if (!initialContent.trim()) {
      return undefined;
    }
    try {
      const blocks = markdownToBlocks(initialContent);
      return blocks;
    } catch (e) {
      console.error('Error parsing markdown:', e);
      return undefined;
    }
  }, [initialContent]);

  // Custom schema with math block
  const schema = useMemo(() => BlockNoteSchema.create({
    blockSpecs: {
      ...defaultBlockSpecs,
      math: MathBlock(),
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
    initialContent: initialBlocks,
    uploadFile,
    resolveFileUrl,
  });

  // Load samples for a type from extension
  const loadSamplesForType = useCallback(async (type: string) => {
    if (samplesCache[type]) {
      return samplesCache[type];
    }
    try {
      const samples = await vscode.loadSamples(type);
      setSamplesCache(prev => ({ ...prev, [type]: samples }));
      return samples;
    } catch (e) {
      console.error('Failed to load samples:', e);
      return {};
    }
  }, [samplesCache]);

  // Handle new sample creation (opens dialog)
  const handleNewSample = useCallback((type: string, id: string) => {
    setPendingSample({ type, id });
    setDialogOpen(true);
  }, []);

  // Handle dialog confirm
  const handleDialogConfirm = useCallback(async (result: SampleInputResult) => {
    if (pendingSample && !result.skipSave) {
      // Save sample to extension
      try {
        await vscode.saveSample({
          sampleType: pendingSample.type,
          sampleId: pendingSample.id,
          alias: result.alias,
          description: result.description,
        });
        // Invalidate cache for this type
        setSamplesCache(prev => {
          const updated = { ...prev };
          delete updated[pendingSample.type];
          return updated;
        });
      } catch (e) {
        console.error('Failed to save sample:', e);
      }
    }
    setDialogOpen(false);
    setPendingSample(null);
  }, [pendingSample]);

  // Handle dialog cancel
  const handleDialogCancel = useCallback(() => {
    setDialogOpen(false);
    setPendingSample(null);
  }, []);

  // Custom slash menu items (excluding sample items - they're loaded dynamically)
  const baseSlashMenuItems = useMemo(() => [
    ...getDefaultReactSlashMenuItems(editor),
    createInsertMathBlock(editor),
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
          getItems={async (query) => {
            // Split query by whitespace into multiple terms
            const queryTerms = query.trim().split(/\s+/).filter(Boolean);
            
            // If no query, return base items only
            if (queryTerms.length === 0) {
              return baseSlashMenuItems;
            }
            
            // Check if first term matches a sample type
            const firstTerm = queryTerms[0].toLowerCase();
            const matchedType = SAMPLE_TYPES.find(type => 
              type.toLowerCase().includes(firstTerm) ||
              firstTerm.includes(type.toLowerCase())
            );
            
            // Load sample items dynamically if a sample type is matched
            let dynamicSampleItems: typeof baseSlashMenuItems = [];
            if (matchedType) {
              const samples = await loadSamplesForType(matchedType);
              dynamicSampleItems = createSampleSlashItemsWithExisting(
                editor,
                matchedType,
                samples,
                handleNewSample
              );
            }
            
            // Combine base items with dynamic sample items
            const allItems = [...baseSlashMenuItems, ...dynamicSampleItems];
            
            // Calculate match score and filter/sort by relevance
            const scoredItems = allItems
              .map(item => ({ item, score: calculateMatchScore(item, queryTerms) }))
              .filter(({ score }) => score > 0)
              .sort((a, b) => b.score - a.score);
            
            return scoredItems.map(({ item }) => item);
          }}
          onItemClick={(item) => {
            // BlockNote 0.46 uses 'onItemClick' function for DefaultReactSuggestionItem
            if (item.onItemClick) {
              item.onItemClick();
            }
          }}
        />
      </BlockNoteView>
      
      {/* Sample Input Dialog */}
      <SampleInputDialog
        isOpen={dialogOpen}
        sampleType={pendingSample?.type || ''}
        sampleId={pendingSample?.id || ''}
        onConfirm={handleDialogConfirm}
        onCancel={handleDialogCancel}
      />
    </div>
  );
};
