import { useState, useEffect, useCallback, useRef } from 'react';
import { MantineProvider, Stack, Button, Group, Title, Loader, Center, Text, Paper, Alert, Badge, Anchor, ActionIcon, Tooltip, TextInput } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import '@mantine/core/styles.css';

type ColorScheme = 'light' | 'dark';
function loadColorScheme(): ColorScheme {
  try { const v = localStorage.getItem('labnotev-color-scheme'); if (v === 'dark') return 'dark'; } catch {}
  return 'light';
}
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

function appendAttachmentLinkAtEnd(content: string, markdownLink: string): string {
  if (!content.trim()) return `${markdownLink}\n`;
  return content.endsWith('\n') ? `${content}${markdownLink}\n` : `${content}\n${markdownLink}\n`;
}

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
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [productSearchResult, setProductSearchResult] = useState<{ alias: string; description: string } | null>(null);
  const [colorScheme, setColorScheme] = useState<ColorScheme>(loadColorScheme);

  const toggleColorScheme = useCallback(() => {
    setColorScheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      try { localStorage.setItem('labnotev-color-scheme', next); } catch {}
      return next;
    });
  }, []);
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
          if (message.data.availableTypes) setAvailableTypes(message.data.availableTypes);
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

        case 'productSearchResult': {
          setProductSearchResult(message.data);
          break;
        }

        case 'customTypesUpdated': {
          setAvailableTypes(message.data.availableTypes);
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

        case 'fileAttached': {
          const { markdownLink, area, opIndex, secIndex, sectionIndex, linkedWfIndex } = message.data;
          const append = appendAttachmentLinkAtEnd;

          if (area === 'labnoteSection' && sectionIndex !== undefined) {
            setLabNote(prev => {
              if (!prev) return prev;
              const sections = [...prev.sections];
              const sec = sections[sectionIndex];
              if (!sec || !('content' in sec)) return prev;
              sections[sectionIndex] = { ...sec, content: append(sec.content, markdownLink) };
              return { ...prev, sections };
            });
            markDirty();
          } else if (area === 'tailContent') {
            setWorkflow(prev => {
              if (!prev) return prev;
              return { ...prev, tailContent: append(prev.tailContent ?? '', markdownLink) };
            });
            markDirty();
          } else if (area === 'unitOp' && opIndex !== undefined && secIndex !== undefined) {
            setWorkflow(prev => {
              if (!prev) return prev;
              const ops = [...prev.unitOperations];
              const op = ops[opIndex];
              if (!op) return prev;
              const secs = [...op.sections];
              const sec = secs[secIndex];
              if (!sec) return prev;
              secs[secIndex] = { ...sec, content: append(sec.content, markdownLink) };
              ops[opIndex] = { ...op, sections: secs };
              return { ...prev, unitOperations: ops };
            });
            markDirty();
          } else if (area === 'linkedUnitOp' && linkedWfIndex !== undefined && opIndex !== undefined && secIndex !== undefined) {
            setLinkedWorkflows(prev => {
              const updated = [...prev];
              const wf = updated[linkedWfIndex];
              if (!wf) return prev;
              const ops = [...wf.unitOperations];
              const op = ops[opIndex];
              if (!op) return prev;
              const secs = [...op.sections];
              const sec = secs[secIndex];
              if (!sec) return prev;
              secs[secIndex] = { ...sec, content: append(sec.content, markdownLink) };
              ops[opIndex] = { ...op, sections: secs };
              updated[linkedWfIndex] = { ...wf, unitOperations: ops };
              return updated;
            });
            markDirty();
          }
          break;
        }

        case 'saveCompleted':
          setSaveStatus('saved');
          break;

        case 'documentChanged':
          if (message.data.labNote) setLabNote(message.data.labNote);
          if (message.data.workflow) setWorkflow(message.data.workflow);
          break;

        case 'scrollToSample': {
          const { area, sectionIndex, opIndex, secIndex, localOffset } = message.data;
          if (area === 'section' && sectionIndex !== undefined) {
            activeSectionRef.current = { area: 'labnoteSection', sectionIndex };
          } else if (area === 'unitOp' && opIndex !== undefined && secIndex !== undefined) {
            activeSectionRef.current = { area: 'unitOp', opIndex, secIndex };
          } else if (area === 'tail') {
            activeSectionRef.current = { area: 'tailContent' };
          }
          setPendingCursor({ pos: localOffset, tick: Date.now() });
          break;
        }
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

  const handleCreateSample = useCallback((opIndex: number, secIndex: number, sampleType: string, alias: string, description: string) => {
    setProductSearchResult(null);
    postMessage({ type: 'createSampleFromModal', data: { sampleType, alias, description, opIndex, secIndex } });
  }, []);

  const handleSearchProducts = useCallback((sampleType: string) => {
    setProductSearchResult(null);
    postMessage({ type: 'searchProducts', data: { sampleType } });
  }, []);

  const handleAddCustomType = useCallback((typeName: string) => {
    postMessage({ type: 'addCustomType', data: { typeName } });
  }, []);

  const handleAttachFile = useCallback(
    (payload: {
      area: 'unitOp' | 'labnoteSection' | 'tailContent' | 'linkedUnitOp';
      opIndex?: number;
      secIndex?: number;
      sectionIndex?: number;
      linkedWfIndex?: number;
    }) => {
      postMessage({ type: 'attachFile', data: payload });
    },
    []
  );

  if (!mode) {
    return (
      <MantineProvider forceColorScheme={colorScheme}>
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
    <MantineProvider forceColorScheme={colorScheme}>
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
          <Group gap="xs">
            <Tooltip label={colorScheme === 'light' ? '다크 모드' : '라이트 모드'} position="bottom" withArrow>
              <ActionIcon variant="subtle" size="md" onClick={toggleColorScheme} aria-label="테마 전환">
                {colorScheme === 'light' ? <MoonIcon /> : <SunIcon />}
              </ActionIcon>
            </Tooltip>
            <Button size="xs" variant="subtle" onClick={handleOpenAsText}>
              텍스트로 열기
            </Button>
          </Group>
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
                      availableTypes={availableTypes}
                      onAttachFile={() => handleAttachFile({ area: 'labnoteSection', sectionIndex: index })}
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
                      availableTypes={availableTypes}
                      onAttachFile={() => handleAttachFile({ area: 'labnoteSection', sectionIndex: index })}
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
                      availableTypes={availableTypes}
                      onAttachFile={() => handleAttachFile({ area: 'labnoteSection', sectionIndex: index })}
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
              <Group gap="xs" align="center" wrap="nowrap">
                <Text fw={500}>{workflow.workflowHeader.match(/^\[.+?\]/)?.[0] ?? workflow.workflowHeader}</Text>
                <TextInput
                  size="sm"
                  variant="unstyled"
                  placeholder="Add description"
                  value={workflow.workflowHeader.replace(/^\[.+?\]\s*/, '')}
                  onChange={(e) => {
                    const bracketPart = workflow.workflowHeader.match(/^\[.+?\]/)?.[0] ?? '';
                    const desc = e.currentTarget.value;
                    const newHeader = desc ? `${bracketPart} ${desc}` : bracketPart;
                    const idName = bracketPart.replace(/^\[|\]$/g, '');
                    const newTitle = desc ? `${idName} - ${desc}` : idName;
                    setWorkflow({
                      ...workflow,
                      workflowHeader: newHeader,
                      frontMatter: { ...workflow.frontMatter, title: newTitle },
                    });
                    markDirty();
                  }}
                  styles={{ input: { fontSize: '14px', minWidth: 200 } }}
                  style={{ flex: 1 }}
                />
              </Group>
              {workflow.workflowDescription && (
                <Text c="dimmed" fs="italic" size="sm">{workflow.workflowDescription}</Text>
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
                onSearchProducts={handleSearchProducts}
                productSearchResult={productSearchResult}
                availableTypes={availableTypes}
                onAddCustomType={handleAddCustomType}
                docBaseUri={docBaseUri}
                getCursorForSection={(opI, secI) => getCursorForArea('unitOp', { opIndex: opI, secIndex: secI })}
                onAttachFile={(opI, secI) => handleAttachFile({ area: 'unitOp', opIndex: opI, secIndex: secI })}
              />
            </Paper>

            {workflow.tailContent !== undefined && (
              <SectionEditor
                heading="📝 Conclusions and Discussion"
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
                availableTypes={availableTypes}
                onAttachFile={() => handleAttachFile({ area: 'tailContent' })}
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

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}
