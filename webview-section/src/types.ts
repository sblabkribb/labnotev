// Shared types between extension and webview (mirrored from sectionTypes.ts)
export interface LabNoteFrontMatter {
  title: string;
  author: string;
  experiment_type: string;
  sample_tracking: boolean;
  created_date: string;
  last_updated_date: string;
  [key: string]: unknown;
}

export interface WorkflowReference {
  title: string;
  link: string;
  checked: boolean;
}

export type LabNoteSection =
  | { type: 'heading'; level: number; text: string }
  | { type: 'objective'; content: string }
  | { type: 'workflows'; items: WorkflowReference[] }
  | { type: 'results'; content: string }
  | { type: 'freeform'; heading: string; content: string };

export interface LabNoteDocument {
  frontMatter: LabNoteFrontMatter;
  sections: LabNoteSection[];
}

export interface WorkflowFrontMatter {
  title: string;
  experimenter: string;
  created_date: string;
  last_updated_date: string;
  end_date: string;
  [key: string]: unknown;
}

export interface UnitOpSection {
  heading: string;
  content: string;
}

export interface UnitOperationBlock {
  id: string;
  opId: string;
  opName: string;
  opDescription: string;
  opType: 'hw' | 'sw';
  alias?: string;
  sections: UnitOpSection[];
}

export interface WorkflowDocument {
  frontMatter: WorkflowFrontMatter;
  workflowHeader: string;
  workflowDescription: string;
  unitOperations: UnitOperationBlock[];
  tailContent: string;
}

// Extension <-> Webview message types
export type ExtensionToWebviewMessage =
  | { type: 'init'; data: { mode: string; labNote?: LabNoteDocument; workflow?: WorkflowDocument; linkedWorkflows?: WorkflowDocument[]; parentLabNotePath?: string; docBaseUri?: string; availableTypes?: string[] } }
  | { type: 'unitOpAdded'; data: UnitOperationBlock }
  | { type: 'sampleInserted'; data: { text: string } }
  | { type: 'textInserted'; data: { text: string } }
  | { type: 'workflowAdded'; data: WorkflowReference & { workflow?: WorkflowDocument } }
  | { type: 'sampleDefinitionCreated'; data: { definitionText: string; opIndex: number; secIndex: number } }
  | { type: 'documentChanged'; data: { labNote?: LabNoteDocument; workflow?: WorkflowDocument } }
  | { type: 'saveCompleted' }
  | { type: 'imagePasted'; data: { markdownText: string } }
  | { type: 'productSearchResult'; data: { alias: string; description: string } }
  | { type: 'customTypesUpdated'; data: { availableTypes: string[] } };

export type WebviewToExtensionMessage =
  | { type: 'ready' }
  | { type: 'save'; data: any }
  | { type: 'openAsText' }
  | { type: 'openImagePreview'; data: { imagePath: string; altText?: string } }
  | { type: 'createSampleFromModal'; data: { sampleType: string; alias: string; description: string; opIndex: number; secIndex: number } }
  | { type: 'searchProducts'; data: { sampleType: string } }
  | { type: 'addCustomType'; data: { typeName: string } }
  | { type: 'navigateToSample'; data: { sampleId: string; sampleType: string } }
  | { type: 'openWorkflow'; data: { link: string } }
  | { type: 'pasteImage'; data: { imageBase64: string; mimeType: string } };
