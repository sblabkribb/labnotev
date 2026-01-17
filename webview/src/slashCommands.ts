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

/**
 * Generate a unique sample ID using timestamp format
 */
export function generateSampleId(type: SampleType): string {
  const timestamp = Date.now();
  return `${type}-${timestamp}`;
}

export interface SlashMenuItem {
  name: string;
  execute: (editor: BlockNoteEditor<any, any, any>) => void;
  aliases?: string[];
  group?: string;
  icon?: React.ReactElement;
  hint?: string;
}

/**
 * Create a slash menu item for inserting the current date
 */
export function createDateSlashItem(editor: BlockNoteEditor<any, any, any>): SlashMenuItem {
  return {
    name: 'Insert Date',
    execute: (ed) => {
      const dateStr = getSeoulDateString();
      const currentBlock = ed.getTextCursorPosition().block;
      ed.insertBlocks(
        [{ type: 'paragraph', content: [{ type: 'text', text: dateStr }] }],
        currentBlock,
        'after'
      );
    },
    aliases: ['date', 'today'],
    group: 'Lab Note',
    hint: 'Insert current date (YYYY-MM-DD)',
  };
}

/**
 * Create a slash menu item for inserting the current date and time
 */
export function createDateTimeSlashItem(editor: BlockNoteEditor<any, any, any>): SlashMenuItem {
  return {
    name: 'Insert DateTime',
    execute: (ed) => {
      const dateTimeStr = getSeoulDateTimeString();
      const currentBlock = ed.getTextCursorPosition().block;
      ed.insertBlocks(
        [{ type: 'paragraph', content: [{ type: 'text', text: dateTimeStr }] }],
        currentBlock,
        'after'
      );
    },
    aliases: ['datetime', 'now', 'timestamp'],
    group: 'Lab Note',
    hint: 'Insert current date and time (YYYY-MM-DD HH:mm)',
  };
}

/**
 * Create slash menu items for sample ID generation
 */
export function createSampleIdSlashItems(editor: BlockNoteEditor<any, any, any>): SlashMenuItem[] {
  return SAMPLE_TYPES.map(type => ({
    name: `Insert ${type} Sample ID`,
    execute: (ed) => {
      const sampleId = generateSampleId(type);
      const currentBlock = ed.getTextCursorPosition().block;
      ed.insertBlocks(
        [{ type: 'paragraph', content: [{ type: 'text', text: sampleId }] }],
        currentBlock,
        'after'
      );
    },
    aliases: [type.toLowerCase(), `sample-${type.toLowerCase()}`],
    group: 'Sample',
    hint: `Generate a new ${type} sample ID`,
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
