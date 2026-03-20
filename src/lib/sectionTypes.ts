// === README.md (랩노트) 섹션 모델 ===
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

// === 워크플로 .md 섹션 모델 ===
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
