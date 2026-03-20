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

export interface SampleItem {
  id: string;
  type: string;
  alias?: string;
  description?: string;
}

// Extension <-> Webview message types
export type ExtensionToWebviewMessage =
  | { type: 'init'; data: { mode: string; labNote?: LabNoteDocument; workflow?: WorkflowDocument; linkedWorkflows?: WorkflowDocument[] } }
  | { type: 'unitOpAdded'; data: UnitOperationBlock }
  | { type: 'sampleInserted'; data: { text: string } }
  | { type: 'textInserted'; data: { text: string } }
  | { type: 'workflowAdded'; data: WorkflowReference & { workflow?: WorkflowDocument } }
  | { type: 'samplesLoaded'; data: { sampleType: string; samples: SampleItem[] } }
  | { type: 'sampleIdGenerated'; data: { id: string; type: string } }
  | { type: 'documentChanged'; data: { labNote?: LabNoteDocument; workflow?: WorkflowDocument } }
  | { type: 'saveCompleted' };

export type WebviewToExtensionMessage =
  | { type: 'ready' }
  | { type: 'save'; data: any }
  | { type: 'openAsText' }
  | { type: 'requestSamples'; data: { sampleType: string } }
  | { type: 'openImagePreview'; data: { imagePath: string; altText?: string } }
  | { type: 'generateSampleId'; data: { type: string } }
  | { type: 'navigateToSample'; data: { sampleId: string; sampleType: string } };
