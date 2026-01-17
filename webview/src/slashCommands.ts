import { BlockNoteEditor, isStyledTextInlineContent } from '@blocknote/core';
import { ReactSlashMenuItem } from '@blocknote/react';
import { getSeoulDateString, getSeoulDateTimeString } from '@lib/dateUtils';
import { SAMPLE_TYPES, generateSampleId } from '@lib/sampleUtils';
import type { SampleType } from '@lib/sampleUtils';

// Re-export for backward compatibility
export { SAMPLE_TYPES, getSeoulDateString, getSeoulDateTimeString, generateSampleId };
export type { SampleType };

/**
 * Helper function to insert or update block (same pattern as BlockNote internal)
 * If current block only contains "/" or is empty, replace it; otherwise insert after
 */
function insertOrUpdateBlock(
  editor: BlockNoteEditor<any, any, any>,
  block: { type: string; content?: any; props?: any }
) {
  const currentBlock = editor.getTextCursorPosition().block;

  const isSlashOnly = Array.isArray(currentBlock.content) &&
    ((currentBlock.content.length === 1 &&
      isStyledTextInlineContent(currentBlock.content[0]) &&
      currentBlock.content[0].type === 'text' &&
      currentBlock.content[0].text === '/') ||
      currentBlock.content.length === 0);

  // Always insert after current block, then optionally remove the slash-only block
  const insertedBlocks = editor.insertBlocks([block], currentBlock, 'after');

  if (insertedBlocks.length > 0) {
    editor.setTextCursorPosition(insertedBlocks[0], 'end');
    
    // If current block was slash-only, remove it
    if (isSlashOnly) {
      try {
        editor.removeBlocks([currentBlock]);
      } catch (e) {
        // Ignore removal errors
      }
    }
  }
}

/**
 * Create a slash menu item for inserting the current date
 * Uses BlockNote's ReactSlashMenuItem interface: name, execute, hint
 */
export function createDateSlashItem(editor: BlockNoteEditor<any, any, any>): ReactSlashMenuItem {
  return {
    name: 'Insert Date',
    execute: (editor: BlockNoteEditor<any, any, any>) => {
      const dateStr = getSeoulDateString();
      insertOrUpdateBlock(editor, {
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: dateStr, styles: {} }],
      });
    },
    aliases: ['date', 'today'],
    group: 'Lab Note',
    hint: 'Insert current date (YYYY-MM-DD)',
  };
}

/**
 * Create a slash menu item for inserting the current date and time
 * Uses BlockNote's ReactSlashMenuItem interface: name, execute, hint
 */
export function createDateTimeSlashItem(editor: BlockNoteEditor<any, any, any>): ReactSlashMenuItem {
  return {
    name: 'Insert DateTime',
    execute: (editor: BlockNoteEditor<any, any, any>) => {
      const dateTimeStr = getSeoulDateTimeString();
      insertOrUpdateBlock(editor, {
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: dateTimeStr, styles: {} }],
      });
    },
    aliases: ['datetime', 'now', 'timestamp'],
    group: 'Lab Note',
    hint: 'Insert current date and time (YYYY-MM-DD HH:mm)',
  };
}

/**
 * Create slash menu items for sample ID generation
 * Uses BlockNote's ReactSlashMenuItem interface: name, execute, hint
 */
export function createSampleIdSlashItems(editor: BlockNoteEditor<any, any, any>): ReactSlashMenuItem[] {
  return SAMPLE_TYPES.map(type => ({
    name: `Insert ${type} Sample ID`,
    execute: (editor: BlockNoteEditor<any, any, any>) => {
      const sampleId = generateSampleId(type);
      insertOrUpdateBlock(editor, {
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: sampleId, styles: {} }],
      });
    },
    aliases: [type.toLowerCase(), `sample-${type.toLowerCase()}`],
    group: 'Sample',
    hint: `Generate a new ${type} sample ID`,
  }));
}

/**
 * Get all custom slash menu items for lab notes
 */
export function getLabNoteSlashMenuItems(editor: BlockNoteEditor<any, any, any>): ReactSlashMenuItem[] {
  return [
    createDateSlashItem(editor),
    createDateTimeSlashItem(editor),
    ...createSampleIdSlashItems(editor),
  ];
}
