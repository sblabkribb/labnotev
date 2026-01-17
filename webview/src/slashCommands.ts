import { BlockNoteEditor, isStyledTextInlineContent } from '@blocknote/core';

/**
 * Sample types available for slash commands
 */
export const SAMPLE_TYPES = ['DNA', 'RNA', 'Plasmid', 'Reagent', 'Primer', 'Protein', 'Equip', 'Labware'] as const;
export type SampleType = typeof SAMPLE_TYPES[number];

/**
 * Returns YYYY-MM-DD in Asia/Seoul timezone
 */
export function getSeoulDateString(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Returns YYYY-MM-DD HH:mm in Asia/Seoul timezone (24h)
 */
export function getSeoulDateTimeString(): string {
  const now = new Date();
  const datePart = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const timePart = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).format(now);
  return `${datePart} ${timePart}`;
}

// Counter for generating unique IDs within the same millisecond
let idCounter = 0;
let lastTimestamp = 0;

/**
 * Generate a unique sample ID using timestamp format
 * Ensures uniqueness even when called multiple times in the same millisecond
 */
export function generateSampleId(type: SampleType): string {
  const timestamp = Date.now();
  if (timestamp === lastTimestamp) {
    idCounter++;
  } else {
    idCounter = 0;
    lastTimestamp = timestamp;
  }
  return `${type}-${timestamp}${idCounter > 0 ? `-${idCounter}` : ''}`;
}

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
 * BlockNote-compatible slash menu item interface
 * Uses 'title' instead of 'name' and 'onItemClick' instead of 'execute'
 */
export interface SlashMenuItem {
  title: string;
  onItemClick: () => void;
  aliases?: readonly string[];
  group?: string;
  icon?: React.ReactElement;
  subtext?: string;
}

/**
 * Create a slash menu item for inserting the current date
 */
export function createDateSlashItem(editor: BlockNoteEditor<any, any, any>): SlashMenuItem {
  return {
    title: 'Insert Date',
    onItemClick: () => {
      const dateStr = getSeoulDateString();
      insertOrUpdateBlock(editor, {
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: dateStr, styles: {} }],
      });
    },
    aliases: ['date', 'today'] as const,
    group: 'Lab Note',
    subtext: 'Insert current date (YYYY-MM-DD)',
  };
}

/**
 * Create a slash menu item for inserting the current date and time
 */
export function createDateTimeSlashItem(editor: BlockNoteEditor<any, any, any>): SlashMenuItem {
  return {
    title: 'Insert DateTime',
    onItemClick: () => {
      const dateTimeStr = getSeoulDateTimeString();
      insertOrUpdateBlock(editor, {
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: dateTimeStr, styles: {} }],
      });
    },
    aliases: ['datetime', 'now', 'timestamp'] as const,
    group: 'Lab Note',
    subtext: 'Insert current date and time (YYYY-MM-DD HH:mm)',
  };
}

/**
 * Create slash menu items for sample ID generation
 */
export function createSampleIdSlashItems(editor: BlockNoteEditor<any, any, any>): SlashMenuItem[] {
  return SAMPLE_TYPES.map(type => ({
    title: `Insert ${type} Sample ID`,
    onItemClick: () => {
      const sampleId = generateSampleId(type);
      insertOrUpdateBlock(editor, {
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: sampleId, styles: {} }],
      });
    },
    aliases: [type.toLowerCase(), `sample-${type.toLowerCase()}`] as const,
    group: 'Sample',
    subtext: `Generate a new ${type} sample ID`,
  }));
}

/**
 * Get all custom slash menu items for lab notes
 */
export function getLabNoteSlashMenuItems(editor: BlockNoteEditor<any, any, any>): SlashMenuItem[] {
  return [
    createDateSlashItem(editor),
    createDateTimeSlashItem(editor),
    ...createSampleIdSlashItems(editor),
  ];
}
