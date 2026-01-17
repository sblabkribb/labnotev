import { BlockNoteEditor } from '@blocknote/core';

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
      const currentBlock = editor.getTextCursorPosition().block;
      editor.insertBlocks(
        [{ type: 'paragraph', content: [{ type: 'text', text: dateStr }] }],
        currentBlock,
        'after'
      );
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
      const currentBlock = editor.getTextCursorPosition().block;
      editor.insertBlocks(
        [{ type: 'paragraph', content: [{ type: 'text', text: dateTimeStr }] }],
        currentBlock,
        'after'
      );
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
      const currentBlock = editor.getTextCursorPosition().block;
      editor.insertBlocks(
        [{ type: 'paragraph', content: [{ type: 'text', text: sampleId }] }],
        currentBlock,
        'after'
      );
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
