import { useState, useEffect, useCallback, useRef } from 'react';
import { MantineProvider, Stack, Button, Group, Title, Loader, Center, Text, Paper, Alert, Badge } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import '@mantine/core/styles.css';
import { FrontMatterForm } from './components/FrontMatterForm';
import { SectionEditor } from './components/SectionEditor';
import { WorkflowChecklist } from './components/WorkflowChecklist';
import { UnitOpAccordion } from './components/UnitOpAccordion';
import type {
  LabNoteDocument,
  WorkflowDocument,
  LabNoteSection,
  WorkflowReference,
  UnitOperationBlock,
  ExtensionToWebviewMessage,
} from './types';
import { postMessage } from './vscodeApi';

const LABNOTE_FM_FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'author', label: 'Author' },
  { key: 'experiment_type', label: 'Experiment Type', type: 'readonly' as const },
  { key: 'sample_tracking', label: 'Sample Tracking', type: 'boolean' as const },
  { key: 'created_date', label: 'Created Date', type: 'readonly' as const },
  { key: 'last_updated_date', label: 'Last Updated', type: 'readonly' as const },
];

const WORKFLOW_FM_FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'experimenter', label: 'Experimenter' },
  { key: 'created_date', label: 'Created Date', type: 'readonly' as const },
  { key: 'last_updated_date', label: 'Last Updated', type: 'readonly' as const },
  { key: 'end_date', label: 'End Date', type: 'datetime' as const },
];

type FocusTarget =
  | { area: 'labnoteSection'; sectionIndex: number }
  | { area: 'unitOp'; opIndex: number; secIndex: number; linkedWfIndex?: number };

type SaveStatus = 'saved' | 'saving' | 'unsaved';

export default function App() {
  const [mode, setMode] = useState<string | null>(null);
  const [labNote, setLabNote] = useState<LabNoteDocument | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowDocument | null>(null);
  const [linkedWorkflows, setLinkedWorkflows] = useState<WorkflowDocument[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const activeSectionRef = useRef<FocusTarget | null>(null);
  const modeRef = useRef<string | null>(null);
  const labNoteRef = useRef<LabNoteDocument | null>(null);
  const workflowRef = useRef<WorkflowDocument | null>(null);

  const performSave = useCallback(() => {
    const m = modeRef.current;
    const ln = labNoteRef.current;
    const wf = workflowRef.current;
    if (m === 'labnote' && ln) {
      setSaveStatus('saving');
      postMessage({ type: 'save', data: { labNote: ln } });
    } else if (m === 'workflow' && wf) {
      setSaveStatus('saving');
      postMessage({ type: 'save', data: { workflow: wf } });
    }
  }, []);

  const debouncedSave = useDebouncedCallback(performSave, 1500);

  const markDirty = useCallback(() => {
    setSaveStatus('unsaved');
    debouncedSave();
  }, [debouncedSave]);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { labNoteRef.current = labNote; }, [labNote]);
  useEffect(() => { workflowRef.current = workflow; }, [workflow]);

  useEffect(() => {
    const handler = (event: MessageEvent<ExtensionToWebviewMessage>) => {
      const message = event.data;
      switch (message.type) {
        case 'init':
          setMode(message.data.mode);
          if (message.data.labNote) setLabNote(message.data.labNote);
          if (message.data.workflow) setWorkflow(message.data.workflow);
          if (message.data.linkedWorkflows) setLinkedWorkflows(message.data.linkedWorkflows);
          break;

        case 'unitOpAdded':
          setWorkflow(prev => prev ? {
            ...prev,
            unitOperations: [...prev.unitOperations, message.data],
          } : prev);
          markDirty();
          break;

        case 'workflowAdded':
          setLabNote(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              sections: prev.sections.map(s =>
                s.type === 'workflows'
                  ? { ...s, items: [...s.items, message.data as WorkflowReference] }
                  : s
              ),
            };
          });
          markDirty();
          break;

        case 'sampleInserted':
        case 'textInserted': {
          const text = message.data.text;
          const target = activeSectionRef.current;
          if (!target) break;

          if (target.area === 'labnoteSection') {
            setLabNote(prev => {
              if (!prev) return prev;
              const sections = [...prev.sections];
              const sec = sections[target.sectionIndex];
              if (sec && 'content' in sec) {
                sections[target.sectionIndex] = { ...sec, content: sec.content + text };
              }
              return { ...prev, sections };
            });
          } else if (target.area === 'unitOp') {
            if (target.linkedWfIndex !== undefined) {
              setLinkedWorkflows(prev => {
                const updated = [...prev];
                const wf = updated[target.linkedWfIndex!];
                if (!wf) return prev;
                const ops = [...wf.unitOperations];
                const op = ops[target.opIndex];
                if (!op) return prev;
                const secs = [...op.sections];
                secs[target.secIndex] = { ...secs[target.secIndex], content: secs[target.secIndex].content + text };
                ops[target.opIndex] = { ...op, sections: secs };
                updated[target.linkedWfIndex!] = { ...wf, unitOperations: ops };
                return updated;
              });
            } else {
              setWorkflow(prev => {
                if (!prev) return prev;
                const ops = [...prev.unitOperations];
                const op = ops[target.opIndex];
                if (!op) return prev;
                const secs = [...op.sections];
                secs[target.secIndex] = { ...secs[target.secIndex], content: secs[target.secIndex].content + text };
                ops[target.opIndex] = { ...op, sections: secs };
                return { ...prev, unitOperations: ops };
              });
            }
          }
          markDirty();
          break;
        }

        case 'saveCompleted':
          setSaveStatus('saved');
          break;

        case 'documentChanged':
          if (message.data.labNote) setLabNote(message.data.labNote);
          if (message.data.workflow) setWorkflow(message.data.workflow);
          break;
      }
    };

    window.addEventListener('message', handler);
    postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', handler);
  }, [markDirty]);

  const handleOpenAsText = useCallback(() => {
    postMessage({ type: 'openAsText' });
  }, []);

  if (!mode) {
    return (
      <MantineProvider>
        <Center h="100vh">
          <Loader />
        </Center>
      </MantineProvider>
    );
  }

  const updateLabNoteFm = (key: string, value: unknown) => {
    if (!labNote) return;
    setLabNote({ ...labNote, frontMatter: { ...labNote.frontMatter, [key]: value } });
    markDirty();
  };

  const updateLabNoteSection = (index: number, updated: LabNoteSection) => {
    if (!labNote) return;
    const sections = [...labNote.sections];
    sections[index] = updated;
    setLabNote({ ...labNote, sections });
    markDirty();
  };

  const updateWorkflowFm = (key: string, value: unknown) => {
    if (!workflow) return;
    setWorkflow({ ...workflow, frontMatter: { ...workflow.frontMatter, [key]: value } });
    markDirty();
  };

  return (
    <MantineProvider>
      <Stack p="md" gap="md">
        <Group justify="space-between">
          <Group gap="sm">
            <Title order={2}>
              {mode === 'labnote' ? '📓 Lab Note' : '🔬 Workflow'} Section Editor
            </Title>
            <Badge
              size="sm"
              variant="light"
              color={saveStatus === 'saved' ? 'green' : saveStatus === 'saving' ? 'yellow' : 'orange'}
            >
              {saveStatus === 'saved' ? '저장됨' : saveStatus === 'saving' ? '저장 중...' : '변경사항 있음'}
            </Badge>
          </Group>
          <Button size="xs" variant="subtle" onClick={handleOpenAsText}>
            텍스트로 열기
          </Button>
        </Group>

        <Alert variant="light" color="blue" styles={{ root: { padding: '8px 12px' } }}>
          <Text size="xs">이 문서는 편집 시 자동 저장됩니다. "텍스트로 열기" 버튼으로 원본 Markdown을 확인할 수 있습니다.</Text>
        </Alert>

        {mode === 'labnote' && labNote && (
          <>
            <Paper p="sm" withBorder>
              <Title order={3} mb="xs">Front Matter</Title>
              <FrontMatterForm
                data={labNote.frontMatter as Record<string, unknown>}
                fields={LABNOTE_FM_FIELDS}
                onChange={updateLabNoteFm}
              />
            </Paper>

            {labNote.sections.map((section, index) => {
              switch (section.type) {
                case 'objective':
                  return (
                    <SectionEditor
                      key={`sec-${index}`}
                      heading="🎯 Experiment Objective"
                      content={section.content}
                      onChange={(c) => updateLabNoteSection(index, { ...section, content: c })}
                      onFocus={() => { activeSectionRef.current = { area: 'labnoteSection', sectionIndex: index }; }}
                    />
                  );
                case 'workflows':
                  return (
                    <WorkflowChecklist
                      key={`sec-${index}`}
                      items={section.items}
                      onChange={(items) => updateLabNoteSection(index, { ...section, items })}
                    />
                  );
                case 'results':
                  return (
                    <SectionEditor
                      key={`sec-${index}`}
                      heading="📊 Results & Discussion"
                      content={section.content}
                      onChange={(c) => updateLabNoteSection(index, { ...section, content: c })}
                      onFocus={() => { activeSectionRef.current = { area: 'labnoteSection', sectionIndex: index }; }}
                    />
                  );
                case 'freeform':
                  return (
                    <SectionEditor
                      key={`sec-${index}`}
                      heading={section.heading}
                      content={section.content}
                      onChange={(c) => updateLabNoteSection(index, { ...section, content: c })}
                      onFocus={() => { activeSectionRef.current = { area: 'labnoteSection', sectionIndex: index }; }}
                    />
                  );
                default:
                  return null;
              }
            })}

            {linkedWorkflows.length > 0 && (
              <Paper p="sm" withBorder>
                <Title order={3} mb="xs">Linked Workflow Unit Operations</Title>
                {linkedWorkflows.map((wf, wi) => (
                  <div key={wi}>
                    <Text fw={600} mb="xs">{wf.frontMatter.title}</Text>
                    <UnitOpAccordion
                      unitOperations={wf.unitOperations}
                      onChange={(ops) => {
                        const updated = [...linkedWorkflows];
                        updated[wi] = { ...wf, unitOperations: ops };
                        setLinkedWorkflows(updated);
                        markDirty();
                      }}
                      onSectionFocus={(opIndex, secIndex) => {
                        activeSectionRef.current = { area: 'unitOp', opIndex, secIndex, linkedWfIndex: wi };
                      }}
                    />
                  </div>
                ))}
              </Paper>
            )}
          </>
        )}

        {mode === 'workflow' && workflow && (
          <>
            <Paper p="sm" withBorder>
              <Title order={3} mb="xs">Front Matter</Title>
              <FrontMatterForm
                data={workflow.frontMatter as Record<string, unknown>}
                fields={WORKFLOW_FM_FIELDS}
                onChange={updateWorkflowFm}
              />
            </Paper>

            <Paper p="sm" withBorder>
              <Title order={3} mb="xs">Workflow Header</Title>
              <Text>{workflow.workflowHeader}</Text>
              {workflow.workflowDescription && (
                <Text c="dimmed" fs="italic">{workflow.workflowDescription}</Text>
              )}
            </Paper>

            <Paper p="sm" withBorder>
              <Title order={3} mb="xs">Unit Operations</Title>
              <UnitOpAccordion
                unitOperations={workflow.unitOperations}
                onChange={(ops) => {
                  setWorkflow({ ...workflow, unitOperations: ops });
                  markDirty();
                }}
                onSectionFocus={(opIndex, secIndex) => {
                  activeSectionRef.current = { area: 'unitOp', opIndex, secIndex };
                }}
              />
            </Paper>

            {workflow.tailContent !== undefined && (
              <SectionEditor
                heading="📝 Conclusion / Summary"
                content={workflow.tailContent}
                onChange={(c) => {
                  setWorkflow({ ...workflow, tailContent: c });
                  markDirty();
                }}
                headingLevel="h2"
                minRows={3}
              />
            )}
          </>
        )}

        {mode === 'unknown' && (
          <Paper p="md" withBorder>
            <Text>이 파일은 Lab Note 또는 Workflow 형식이 아닙니다.</Text>
            <Button mt="sm" onClick={handleOpenAsText}>텍스트 에디터로 열기</Button>
          </Paper>
        )}
      </Stack>
    </MantineProvider>
  );
}
