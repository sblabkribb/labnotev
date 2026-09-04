// Shared types now live in @labnotev/core (single source of truth). This file
// is kept as a thin re-export barrel so existing `../types` imports across the
// webview keep resolving. Do NOT re-add hand-copied type definitions here.
export type {
  LabNoteFrontMatter,
  WorkflowReference,
  LabNoteSection,
  LabNoteDocument,
  WorkflowFrontMatter,
  UnitOpSection,
  UnitOperationBlock,
  WorkflowDocument,
  SampleDefMap,
  ExtensionToWebviewMessage,
  WebviewToExtensionMessage,
} from '@labnotev/core';
