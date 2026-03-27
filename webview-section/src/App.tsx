import { useState, useEffect, useCallback, useRef } from 'react';
import { MantineProvider, Stack, Button, Group, Title, Loader, Center, Text, Paper, Alert, Badge, Anchor } from '@mantine/core';
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
  { key: 'created_date', label: 'Created Date', type: 'datetime' as const },
  { key: 'last_updated_date', label: 'Last Updated', type: 'datetime' as const },
];

const WORKFLOW_FM_FIELDS = [
  { key: 'title', label: 'Title' },
  { key: 'experimenter', label: 'Experimenter' },
  { key: 'created_date', label: 'Created Date', type: 'datetime' as const },
  { key: 'last_updated_date', label: 'Last Updated', type: 'datetime' as const },
  { key: 'end_date', label: 'End Date', type: 'datetime' as const },
];

type FocusTarget =
  | { area: 'labnoteSection'; sectionIndex: number; cursorPos?: number }
  | { area: 'unitOp'; opIndex: number; secIndex: number; linkedWfIndex?: number; cursorPos?: number }
  | { area: 'tailContent'; cursorPos?: number };

type SaveStatus = 'saved' | 'saving' | 'unsaved';

export default function App() {
  const [mode, setMode] = useState<string | null>(null);
  const [labNote, setLabNote] = useState<LabNoteDocument | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowDocument | null>(null);
  const [linkedWorkflows, setLinkedWorkflows] = useState<WorkflowDocument[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [parentLabNotePath, setParentLabNotePath] = useState<string | null>(null);
  const [docBaseUri, setDocBaseUri] = useState<string>('');
  const activeSectionRef = useRef<FocusTarget | null>(null);
  const [pendingCursor, setPendingCursor] = useState<{ pos: number; tick: number } | null>(null);
  const updateCursorPos = (pos: number) => {
    if (activeSectionRef.current) {
      activeSectionRef.current = { ...activeSectionRef.current, cursorPos: pos };
    }
  };

  const getCursorForArea = (area: string, extra?: Record<string, number>) => {
    const active = activeSectionRef.current;
    if (!pendingCursor || !active || active.area !== area) return undefined;
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        if ((active as any)[k] !== v) return undefined;
      }
    }
    return pendingCursor;
  };
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
          if (message.data.parentLabNotePath) setParentLabNotePath(message.data.parentLabNotePath);
          if (message.data.docBaseUri) setDocBaseUri(message.data.docBaseUri);
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
          const actualPos = target.cursorPos ?? 0;
          const insertAt = (original: string) => {
            const pos = target.cursorPos ?? original.length;
            return original.slice(0, pos) + text + original.slice(pos);
          };

          if (target.area === 'labnoteSection') {
            setLabNote(prev => {
              if (!prev) return prev;
              const sections = [...prev.sections];
              const sec = sections[target.sectionIndex];
              if (sec && 'content' in sec) {
                sections[target.sectionIndex] = { ...sec, content: insertAt(sec.content) };
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
                secs[target.secIndex] = { ...secs[target.secIndex], content: insertAt(secs[target.secIndex].content) };
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
                secs[target.secIndex] = { ...secs[target.secIndex], content: insertAt(secs[target.secIndex].content) };
                ops[target.opIndex] = { ...op, sections: secs };
                return { ...prev, unitOperations: ops };
              });
            }
          } else if (target.area === 'tailContent') {
            setWorkflow(prev => {
              if (!prev) return prev;
              return { ...prev, tailContent: insertAt(prev.tailContent ?? '') };
            });
          }
          setPendingCursor({ pos: actualPos + text.length, tick: Date.now() });
          markDirty();
          break;
        }

        case 'sampleDefinitionCreated': {
          const { definitionText, opIndex, secIndex } = message.data;
          const curTarget = activeSectionRef.current;
          setWorkflow(prev => {
            if (!prev) return prev;
            const ops = [...prev.unitOperations];
            const op = ops[opIndex];
            if (!op) return prev;
            const sections = [...op.sections];
            const sec = sections[secIndex];
            if (!sec) return prev;
            const pos = curTarget?.cursorPos ?? sec.content.length;
            const separator = pos > 0 && sec.content[pos - 1] !== '\n' ? '\n' : '';
            sections[secIndex] = { ...sec, content: sec.content.slice(0, pos) + separator + definitionText + sec.content.slice(pos) };
            ops[opIndex] = { ...op, sections };
            return { ...prev, unitOperations: ops };
          });
          markDirty();
          break;
        }

        case 'imagePasted': {
          const imgText = message.data.markdownText;
          const target = activeSectionRef.current;
          if (!target) break;
          const actualPos = target.cursorPos ?? 0;
          const insertImg = (original: string) => {
            const pos = target.cursorPos ?? original.length;
            return original.slice(0, pos) + imgText + original.slice(pos);
          };

          if (target.area === 'labnoteSection') {
            setLabNote(prev => {
              if (!prev) return prev;
              const sections = [...prev.sections];
              const sec = sections[target.sectionIndex];
              if (sec && 'content' in sec) {
                sections[target.sectionIndex] = { ...sec, content: insertImg(sec.content) };
              }
              return { ...prev, sections };
            });
          } else if (target.area === 'unitOp') {
            setWorkflow(prev => {
              if (!prev) return prev;
              const ops = [...prev.unitOperations];
              const op = ops[target.opIndex];
              if (!op) return prev;
              const secs = [...op.sections];
              secs[target.secIndex] = { ...secs[target.secIndex], content: insertImg(secs[target.secIndex].content) };
              ops[target.opIndex] = { ...op, sections: secs };
              return { ...prev, unitOperations: ops };
            });
          } else if (target.area === 'tailContent') {
            setWorkflow(prev => {
              if (!prev) return prev;
              return { ...prev, tailContent: insertImg(prev.tailContent ?? '') };
            });
          }
          setPendingCursor({ pos: actualPos + imgText.length, tick: Date.now() });
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

    const handlePaste = (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          e.preventDefault();
          const mimeType = items[i].type;
          const blob = items[i].getAsFile();
          if (!blob) return;
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(',')[1];
            postMessage({ type: 'pasteImage', data: { imageBase64: base64, mimeType } });
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
    };

    window.addEventListener('message', handler);
    window.addEventListener('paste', handlePaste);
    postMessage({ type: 'ready' });
    return () => {
      window.removeEventListener('message', handler);
      window.removeEventListener('paste', handlePaste);
    };
  }, [markDirty]);

  const handleOpenAsText = useCallback(() => {
    postMessage({ type: 'openAsText' });
  }, []);

  const handleCreateSample = useCallback((opIndex: number, secIndex: number, sampleType: string) => {
    postMessage({ type: 'createSampleDefinition', data: { sampleType, opIndex, secIndex } });
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
                      onCursorActivity={updateCursorPos}
                      docBaseUri={docBaseUri}
                      requestFocusAt={getCursorForArea('labnoteSection', { sectionIndex: index })}
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
                      onCursorActivity={updateCursorPos}
                      docBaseUri={docBaseUri}
                      requestFocusAt={getCursorForArea('labnoteSection', { sectionIndex: index })}
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
                      onCursorActivity={updateCursorPos}
                      docBaseUri={docBaseUri}
                      requestFocusAt={getCursorForArea('labnoteSection', { sectionIndex: index })}
                    />
                  );
                default:
                  return null;
              }
            })}

          </>
        )}

        {mode === 'workflow' && workflow && (
          <>
            {parentLabNotePath && (
              <Anchor
                size="sm"
                onClick={() => postMessage({ type: 'openWorkflow', data: { link: parentLabNotePath } })}
                style={{ cursor: 'pointer' }}
              >
                &larr; Back to Lab Note
              </Anchor>
            )}

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
                onCursorActivity={updateCursorPos}
                onCreateSample={handleCreateSample}
                docBaseUri={docBaseUri}
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
                onFocus={() => { activeSectionRef.current = { area: 'tailContent' }; }}
                onCursorActivity={updateCursorPos}
                headingLevel="h2"
                minRows={3}
                docBaseUri={docBaseUri}
                requestFocusAt={getCursorForArea('tailContent')}
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
