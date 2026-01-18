import { BlockNoteEditor, isStyledTextInlineContent } from '@blocknote/core';
import { ReactSlashMenuItem } from '@blocknote/react';
import { getSeoulDateString, getSeoulDateTimeString } from '@lib/dateUtils';
import { SAMPLE_TYPES, generateSampleId } from '@lib/sampleUtils';
import type { SampleType } from '@lib/sampleUtils';
import { WORKFLOWS } from './data/workflows';
import { UNIT_OPERATIONS } from './data/unitOperations';

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
 * Uses BlockNote's ReactSlashMenuItem interface: title, execute, subtext
 */
export function createDateSlashItem(editor: BlockNoteEditor<any, any, any>): ReactSlashMenuItem {
  return {
    title: 'Insert Date',
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
    subtext: 'Insert current date (YYYY-MM-DD)',
  };
}

/**
 * Create a slash menu item for inserting the current date and time
 * Uses BlockNote's ReactSlashMenuItem interface: title, execute, subtext
 */
export function createDateTimeSlashItem(editor: BlockNoteEditor<any, any, any>): ReactSlashMenuItem {
  return {
    title: 'Insert DateTime',
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
    subtext: 'Insert current date and time (YYYY-MM-DD HH:mm)',
  };
}

/**
 * Create slash menu items for sample ID generation
 * Uses BlockNote's ReactSlashMenuItem interface: title, execute, subtext
 */
export function createSampleIdSlashItems(editor: BlockNoteEditor<any, any, any>): ReactSlashMenuItem[] {
  return SAMPLE_TYPES.map(type => ({
    title: `Insert ${type} Sample ID`,
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
    subtext: `Generate a new ${type} sample ID`,
  }));
}

/**
 * Create slash menu items for workflow templates
 * Uses BlockNote's ReactSlashMenuItem interface: title, execute, subtext
 */
export function createWorkflowSlashItems(editor: BlockNoteEditor<any, any, any>): ReactSlashMenuItem[] {
  return WORKFLOWS.map(workflow => ({
    title: `${workflow.id}: ${workflow.name}`,
    execute: (editor: BlockNoteEditor<any, any, any>) => {
      // Insert workflow template as a heading with description
      const blocks = [
        {
          type: 'heading',
          props: { level: 2 },
          content: [{ type: 'text', text: `${workflow.id}: ${workflow.name}`, styles: {} }],
        },
        {
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: workflow.description, styles: { italic: true } }],
        },
        {
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: '', styles: {} }],
        },
      ];

      const currentBlock = editor.getTextCursorPosition().block;
      const isSlashOnly = Array.isArray(currentBlock.content) &&
        ((currentBlock.content.length === 1 &&
          isStyledTextInlineContent(currentBlock.content[0]) &&
          currentBlock.content[0].type === 'text' &&
          currentBlock.content[0].text === '/') ||
          currentBlock.content.length === 0);

      const insertedBlocks = editor.insertBlocks(blocks, currentBlock, 'after');

      if (insertedBlocks.length > 0) {
        editor.setTextCursorPosition(insertedBlocks[insertedBlocks.length - 1], 'end');
        
        if (isSlashOnly) {
          try {
            editor.removeBlocks([currentBlock]);
          } catch (e) {
            // Ignore removal errors
          }
        }
      }
    },
    aliases: [
      workflow.id.toLowerCase(),
      workflow.name.toLowerCase().replace(/\s+/g, '-'),
      `workflow-${workflow.id.toLowerCase()}`,
    ],
    group: 'Workflow',
    subtext: `${workflow.category}: ${workflow.description}`,
  }));
}

/**
 * Generate full operation template blocks with all required sections
 * Includes: Meta, Input, Reagent, Consumables, Equipment, Method, Output, Results & Discussions
 */
export function generateOperationTemplateBlocks(operation: { id: string; name: string; description: string }): any[] {
  const dateTimeStr = getSeoulDateTimeString();
  
  return [
    // Header: [OPHW-001 Acoustic Liquid Handling]
    {
      type: 'heading',
      props: { level: 3 },
      content: [{ type: 'text', text: `[${operation.id} ${operation.name}]`, styles: {} }],
    },
    // Description (italic)
    {
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: operation.description, styles: { italic: true } }],
    },
    // Separator
    {
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: '---', styles: {} }],
    },
    // Meta section
    {
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: 'Meta', styles: { bold: true } }],
    },
    {
      type: 'bulletListItem',
      props: {},
      content: [{ type: 'text', text: 'Experimenter: ', styles: {} }],
    },
    {
      type: 'bulletListItem',
      props: {},
      content: [{ type: 'text', text: `Start_date: '${dateTimeStr}'`, styles: {} }],
    },
    {
      type: 'bulletListItem',
      props: {},
      content: [{ type: 'text', text: "End_date: ''", styles: {} }],
    },
    // Input section
    {
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: 'Input', styles: { bold: true } }],
    },
    {
      type: 'bulletListItem',
      props: {},
      content: [{ type: 'text', text: '(samples from the previous step)', styles: {} }],
    },
    // Reagent section
    {
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: 'Reagent', styles: { bold: true } }],
    },
    {
      type: 'bulletListItem',
      props: {},
      content: [{ type: 'text', text: '(e.g. enzyme, buffer, etc.)', styles: {} }],
    },
    // Consumables section
    {
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: 'Consumables', styles: { bold: true } }],
    },
    {
      type: 'bulletListItem',
      props: {},
      content: [{ type: 'text', text: '(e.g. filter, well-plate, etc.)', styles: {} }],
    },
    // Equipment section
    {
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: 'Equipment', styles: { bold: true } }],
    },
    {
      type: 'bulletListItem',
      props: {},
      content: [{ type: 'text', text: '(e.g. centrifuge, spectrophotometer, etc.)', styles: {} }],
    },
    // Method section
    {
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: 'Method', styles: { bold: true } }],
    },
    {
      type: 'bulletListItem',
      props: {},
      content: [{ type: 'text', text: '(method used in this step)', styles: {} }],
    },
    // Output section
    {
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: 'Output', styles: { bold: true } }],
    },
    {
      type: 'bulletListItem',
      props: {},
      content: [{ type: 'text', text: '(samples to the next step)', styles: {} }],
    },
    // Results & Discussions section
    {
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: 'Results & Discussions', styles: { bold: true } }],
    },
    {
      type: 'bulletListItem',
      props: {},
      content: [{ type: 'text', text: '(Any results and discussions. Link file path if needed)', styles: {} }],
    },
    // Empty line at end
    {
      type: 'paragraph',
      props: {},
      content: [{ type: 'text', text: '', styles: {} }],
    },
  ];
}

/**
 * Create slash menu items for unit operations
 * Uses BlockNote's ReactSlashMenuItem interface: title, execute, subtext
 */
export function createOperationSlashItems(editor: BlockNoteEditor<any, any, any>): ReactSlashMenuItem[] {
  return UNIT_OPERATIONS.map(operation => ({
    title: `${operation.id}: ${operation.name}`,
    execute: (editor: BlockNoteEditor<any, any, any>) => {
      // Generate full operation template with all sections
      const blocks = generateOperationTemplateBlocks(operation);

      const currentBlock = editor.getTextCursorPosition().block;
      const isSlashOnly = Array.isArray(currentBlock.content) &&
        ((currentBlock.content.length === 1 &&
          isStyledTextInlineContent(currentBlock.content[0]) &&
          currentBlock.content[0].type === 'text' &&
          currentBlock.content[0].text === '/') ||
          currentBlock.content.length === 0);

      const insertedBlocks = editor.insertBlocks(blocks, currentBlock, 'after');

      if (insertedBlocks.length > 0) {
        editor.setTextCursorPosition(insertedBlocks[insertedBlocks.length - 1], 'end');
        
        if (isSlashOnly) {
          try {
            editor.removeBlocks([currentBlock]);
          } catch (e) {
            // Ignore removal errors
          }
        }
      }
    },
    aliases: [
      operation.id.toLowerCase(),
      operation.name.toLowerCase().replace(/\s+/g, '-'),
      `operation-${operation.id.toLowerCase()}`,
    ],
    group: 'Operation',
    subtext: `${operation.category}: ${operation.description}`,
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
    ...createWorkflowSlashItems(editor),
    ...createOperationSlashItems(editor),
  ];
}
