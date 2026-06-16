import { useState, useEffect, useCallback, useRef } from 'react';
import { MantineProvider, Stack, Button, Group, Title, Loader, Center, Text, Paper, Alert, Badge, Anchor, ActionIcon, Tooltip, TextInput, Textarea } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import '@mantine/core/styles.css';

type ColorScheme = 'light' | 'dark';
function loadColorScheme(): ColorScheme {
  try { const v = localStorage.getItem('labnotev-color-scheme'); if (v === 'dark') return 'dark'; } catch { /* localStorage unavailable; fall back to default */ }
  return 'light';
}
import { FrontMatterForm } from './components/FrontMatterForm';
import { SectionEditor } from './components/SectionEditor';
import { WorkflowChecklist } from './components/WorkflowChecklist';
import { UnitOpAccordion } from './components/UnitOpAccordion';
import type {
  LabNoteDocument,
  WorkflowDocument,
  WorkflowReference,
  UnitOperationBlock,
  ExtensionToWebviewMessage,
  SampleDefMap,
} from './types';
import { postMessage } from './vscodeApi';
import { resolveInsertPosition, type FocusTarget } from './lib/resolveInsertPosition';
import { insertAttachmentLinkAt } from './lib/insertAttachmentLink';
import { insertSampleText } from './lib/insertSampleText';
import { isFocusedOn, type AttachPayload } from './lib/isFocusedOn';
import { FindBar } from './components/FindBar';
import { SearchHighlightLayer } from './components/SearchHighlightLayer';
import { collectMatches, type FindMatch } from './lib/findMatches';
import { getTextareaCaretRect, scrollCaretIntoView } from './utils/caretPosition';

// The focused section's identity plus its live textarea DOM node. Storing the
// node alongside the identity (rather than in a separate ref) guarantees they
// move together, so we never read a different section's textarea.
type ActiveSection = FocusTarget & { el?: HTMLTextAreaElement | null };

// Read the live value/caret straight from the focused textarea. This is the
// single source of truth at insertion time: it always matches what the user
// sees, even right after a programmatic insertion, so insertions never splice
// into a stale snapshot (issues #33, #34). Returns null when no connected node
// is available (e.g. after a `scrollToSample` that only set the identity), in
// which case callers fall back to committed content.
function readLive(el: HTMLTextAreaElement | null | undefined): { value: string; caret: number } | null {
  if (el && el.isConnected) return { value: el.value, caret: el.selectionStart };
  return null;
}

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

type SaveStatus = 'saved' | 'saving' | 'unsaved';

export default function App() {
  const [mode, setMode] = useState<string | null>(null);
  const [labNote, setLabNote] = useState<LabNoteDocument | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowDocument | null>(null);
  const [linkedWorkflows, setLinkedWorkflows] = useState<WorkflowDocument[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [parentLabNotePath, setParentLabNotePath] = useState<string | null>(null);
  const [docBaseUri, setDocBaseUri] = useState<string>('');
  // Tracks the focused section's identity AND its live textarea DOM node. The
  // node (`el`) and the identity are always set together (on focus) so they can
  // never desync — a separate node ref would go stale on identity-only changes
  // like `scrollToSample`, risking a read of the wrong section's textarea.
  const activeSectionRef = useRef<ActiveSection | null>(null);
  const [pendingCursor, setPendingCursor] = useState<{ pos: number; tick: number; scroll?: 'none' | 'nearest' | 'center' } | null>(null);
  // Controlled opened state for the UnitOp accordion. Currently only used
  // to auto-expand the target UnitOp when "Go to definition" lands inside a
  // collapsed section; user-driven opens fall through `onOpenedChange`
  // without the App overriding them.
  const [openedOpIds, setOpenedOpIds] = useState<string[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [sampleTypeColors, setSampleTypeColors] = useState<Record<string, string>>({});
  const [sampleDefs, setSampleDefs] = useState<SampleDefMap>({});
  const [productSearchResult, setProductSearchResult] = useState<{ alias: string; description: string } | null>(null);
  // Reflects whether the system clipboard currently holds a valid
  // `labnotev/unit-operation` envelope (resolved by the extension on
  // `queryClipboardState`). Drives Paste below / empty-state button
  // enablement so users see ahead of time whether a paste will work.
  const [clipboardHasUnitOp, setClipboardHasUnitOp] = useState(false);
  const [colorScheme, setColorScheme] = useState<ColorScheme>(loadColorScheme);
  const [insertWarning, setInsertWarning] = useState<string | null>(null);
  const insertWarningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Editor-mode find (#30). Matches are collected from the live DOM
  // (textareas/inputs) so collapsed UnitOps are expanded on open to make their
  // content searchable. `findContainerRef` is the position:relative wrapper the
  // highlight layer paints into.
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findCaseSensitive, setFindCaseSensitive] = useState(false);
  const [findMatches, setFindMatches] = useState<FindMatch[]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1);
  const findContainerRef = useRef<HTMLDivElement>(null);

  const showInsertWarning = useCallback((message: string) => {
    setInsertWarning(message);
    if (insertWarningTimerRef.current) clearTimeout(insertWarningTimerRef.current);
    insertWarningTimerRef.current = setTimeout(() => {
      setInsertWarning(null);
      insertWarningTimerRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => () => {
    if (insertWarningTimerRef.current) clearTimeout(insertWarningTimerRef.current);
  }, []);

  // Suppress the default browser context menu outside text-editing surfaces.
  // VS Code webviews show a generic cut/copy/paste menu that only works inside
  // textareas/inputs/contentEditable, so exposing it on accordion headers and
  // background areas confuses users. We keep the native menu intact wherever
  // text editing is actually possible.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName?.toLowerCase();
      if (tag === 'textarea' || tag === 'input' || t.isContentEditable) return;
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, []);

  const toggleColorScheme = useCallback(() => {
    setColorScheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      try { localStorage.setItem('labnotev-color-scheme', next); } catch { /* ignore persistence failure */ }
      return next;
    });
  }, []);
  // Stable identity so it can be passed as `onCursorActivity` to memoized
  // children (UnitOpAccordion, HighlightedTextarea) without retriggering
  // their re-renders on every parent state change.
  // Updated on every keystroke/caret move of the focused section. Writes to a
  // ref only (no setState) so it stays off the typing hot path. The spread
  // preserves `el` (the live textarea node) set on focus. `cursorPos` is only a
  // fallback; insertions read the live caret from `el` directly.
  const updateCursorPos = useCallback((pos: number) => {
    if (activeSectionRef.current) {
      activeSectionRef.current = { ...activeSectionRef.current, cursorPos: pos };
    }
  }, []);

  const getCursorForArea = useCallback((area: string, extra?: Record<string, number>) => {
    const active = activeSectionRef.current;
    if (!pendingCursor || !active || active.area !== area) return undefined;
    if (extra) {
      for (const [k, v] of Object.entries(extra)) {
        if ((active as any)[k] !== v) return undefined;
      }
    }
    return pendingCursor;
  }, [pendingCursor]);
  const modeRef = useRef<string | null>(null);
  const labNoteRef = useRef<LabNoteDocument | null>(null);
  const workflowRef = useRef<WorkflowDocument | null>(null);
  const linkedWorkflowsRef = useRef<WorkflowDocument[]>([]);

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
  useEffect(() => { linkedWorkflowsRef.current = linkedWorkflows; }, [linkedWorkflows]);

  // --- Editor-mode find (#30) ---------------------------------------------

  // Ctrl/Cmd+F opens the find bar (capture phase so it wins over child
  // handlers); opening expands every UnitOp so collapsed textareas mount and
  // become searchable. Escape closes — left to bubble so modals still get it.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        e.stopPropagation();
        setFindOpen(true);
        const wf = workflowRef.current;
        if (wf) setOpenedOpIds(wf.unitOperations.map((o) => o.id));
      } else if (e.key === 'Escape') {
        setFindOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);

  // Clear matches when the find bar closes or the query empties. This effect
  // intentionally does NOT depend on document state, so typing under a closed
  // find bar never re-runs it. The functional updaters preserve the existing
  // reference when already cleared, so closing twice is a no-op.
  useEffect(() => {
    if (!findOpen || findQuery.length === 0) {
      setFindMatches(prev => (prev.length === 0 ? prev : []));
      setActiveMatchIndex(prev => (prev === -1 ? prev : -1));
    }
  }, [findOpen, findQuery]);

  // Recompute matches (debounced) whenever the query/options change, or the
  // document content / opened panels change underneath an open find bar. The
  // closed path returns without any setState, so a keystroke while find is
  // closed does not schedule an extra App render pass.
  useEffect(() => {
    if (!findOpen || findQuery.length === 0) return;
    const handle = setTimeout(() => {
      const next = collectMatches(findQuery, findCaseSensitive);
      setFindMatches(next);
      setActiveMatchIndex(next.length > 0 ? 0 : -1);
    }, 150);
    return () => clearTimeout(handle);
  }, [findOpen, findQuery, findCaseSensitive, labNote, workflow, linkedWorkflows, openedOpIds]);

  const scrollToMatch = useCallback((match: FindMatch | undefined) => {
    if (!match || !document.contains(match.el)) return;
    if (match.el.tagName === 'TEXTAREA') {
      const rect = getTextareaCaretRect(match.el as HTMLTextAreaElement, match.start);
      if (rect) scrollCaretIntoView(rect, 'center');
    } else {
      match.el.scrollIntoView({ block: 'center' });
    }
  }, []);

  // Scroll the active match into view. Focus is intentionally NOT moved here
  // (it would steal focus from the find input while typing); the highlight
  // layer's active box / native selection convey position instead.
  useEffect(() => {
    if (!findOpen || activeMatchIndex < 0 || activeMatchIndex >= findMatches.length) return;
    scrollToMatch(findMatches[activeMatchIndex]);
  }, [activeMatchIndex, findMatches, findOpen, scrollToMatch]);

  const gotoNextMatch = useCallback(() => {
    setActiveMatchIndex((i) => (findMatches.length === 0 ? -1 : ((i < 0 ? -1 : i) + 1) % findMatches.length));
  }, [findMatches]);

  const gotoPrevMatch = useCallback(() => {
    setActiveMatchIndex((i) => (findMatches.length === 0 ? -1 : ((i < 0 ? 0 : i) - 1 + findMatches.length) % findMatches.length));
  }, [findMatches]);

  const closeFind = useCallback(() => {
    setFindOpen(false);
    // Hand editing focus to the active match so the user resumes where they
    // searched.
    const match = findMatches[activeMatchIndex];
    if (match && document.contains(match.el)) {
      match.el.focus({ preventScroll: true });
      try { match.el.setSelectionRange(match.start, match.end); } catch { /* detached */ }
    }
  }, [findMatches, activeMatchIndex]);

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
          if (message.data.sampleTypeColors) setSampleTypeColors(message.data.sampleTypeColors);
          if (message.data.sampleDefs) setSampleDefs(message.data.sampleDefs);
          break;

        case 'sampleDefsUpdated':
          setSampleDefs(message.data.sampleDefs);
          break;

        case 'unitOpAdded':
          setWorkflow(prev => prev ? {
            ...prev,
            unitOperations: [...prev.unitOperations, message.data],
          } : prev);
          markDirty();
          break;

        case 'unitOpPasted': {
          const { afterOpIndex, unitOp } = message.data;
          // Generate a fresh React key so a paste-twice-in-a-row doesn't
          // collide with the source op's parser-assigned `unitop-N` id.
          const newId = `unitop-paste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          setWorkflow(prev => {
            if (!prev) return prev;
            const ops = [...prev.unitOperations];
            const insertAt = Math.max(0, Math.min(afterOpIndex + 1, ops.length));
            ops.splice(insertAt, 0, { ...unitOp, id: newId });
            return { ...prev, unitOperations: ops };
          });
          setOpenedOpIds(prev => (prev.includes(newId) ? prev : [...prev, newId]));
          markDirty();
          break;
        }

        case 'clipboardStateUpdated':
          setClipboardHasUnitOp(!!message.data?.hasUnitOp);
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
          if (!target) {
            showInsertWarning('Click the textarea of the section you want to insert into first.');
            break;
          }
          // Read the base content and caret straight from the focused textarea
          // DOM node, which always matches what the user sees — even right after
          // a previous programmatic insertion (issues #33, #34). Only fall back
          // to App's committed content when no live node is available.
          // Phase C-2: when `text` starts with a `@type;`/`@type:` prefix and
          // the user already typed the same prefix at the caret, the helper
          // collapses it so we don't produce `@dna;@dna;DNA-123`.
          const live = readLive(target.el);
          let committed = '';
          if (target.area === 'labnoteSection') {
            const sec = labNoteRef.current?.sections?.[target.sectionIndex];
            if (sec && 'content' in sec && typeof (sec as { content?: unknown }).content === 'string') {
              committed = (sec as { content: string }).content;
            }
          } else if (target.area === 'unitOp') {
            const srcList = target.linkedWfIndex !== undefined
              ? linkedWorkflowsRef.current[target.linkedWfIndex]?.unitOperations
              : workflowRef.current?.unitOperations;
            committed = srcList?.[target.opIndex]?.sections?.[target.secIndex]?.content ?? '';
          } else if (target.area === 'tailContent') {
            committed = workflowRef.current?.tailContent ?? '';
          }
          const original = live ? live.value : committed;
          const caretPos = live ? live.caret : target.cursorPos;

          const { content: nextContent, caret } = insertSampleText(original, caretPos, text);

          if (target.area === 'labnoteSection') {
            setLabNote(prev => {
              if (!prev) return prev;
              const sections = [...prev.sections];
              const sec = sections[target.sectionIndex];
              if (sec && 'content' in sec) {
                sections[target.sectionIndex] = { ...sec, content: nextContent };
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
                secs[target.secIndex] = { ...secs[target.secIndex], content: nextContent };
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
                secs[target.secIndex] = { ...secs[target.secIndex], content: nextContent };
                ops[target.opIndex] = { ...op, sections: secs };
                return { ...prev, unitOperations: ops };
              });
            }
          } else if (target.area === 'tailContent') {
            setWorkflow(prev => {
              if (!prev) return prev;
              return { ...prev, tailContent: nextContent };
            });
          }
          setPendingCursor({ pos: caret, tick: Date.now(), scroll: 'nearest' });
          // Clear pendingCursor after the next render cycle consumes it.
          // Without this, a stale pendingCursor is re-applied whenever the
          // textarea component remounts (e.g. when the accordion is folded
          // and unfolded), causing the caret to jump unexpectedly.
          setTimeout(() => {
            setPendingCursor(null);
          }, 100);
          markDirty();
          break;
        }

        case 'sampleDefinitionCreated': {
          // Phase C-1: Route by opId + section heading (preferred) and fall
          // back to opIndex/secIndex when the extension hasn't supplied them
          // (older versions / stale message shape). Between the user clicking
          // "Create Sample" and the extension echoing the definition back, the user
          // may have reordered or removed unit operations, which would shift
          // the numeric indices. Looking up by id/heading keeps the definition
          // attached to the right section no matter what.
          const { definitionText, opIndex, secIndex, opId, uoId, secHeading } = message.data;
          const curTarget = activeSectionRef.current;
          // Read the focused textarea's live value/caret once, synchronously, so
          // both the pre-resolve (for pendingCursor) and the setState updater
          // splice into the same up-to-date string. When the focused section is
          // the resolved one, this is the user's true content/caret — even right
          // after a prior insertion (issues #33, #34); otherwise we fall back to
          // committed content + the tracked caret via resolveInsertPosition.
          const live = readLive(curTarget?.el);
          // `resolvedUoId` is the unique id of the op we routed to. Issue #34:
          // guard the live read by uoId (not the reusable opId code) so we only
          // splice live content when the focused textarea is that exact op.
          const resolveBaseAndPos = (resolvedUoId: string | undefined, oid: string, heading: string, committedContent: string): { base: string; pos: number } => {
            const idMatches = resolvedUoId !== undefined && curTarget?.area === 'unitOp' && curTarget.uoId !== undefined
              ? curTarget.uoId === resolvedUoId
              : curTarget?.area === 'unitOp' && curTarget.opId === oid;
            if (
              live &&
              curTarget &&
              curTarget.area === 'unitOp' &&
              idMatches &&
              curTarget.secHeading === heading
            ) {
              return { base: live.value, pos: Math.max(0, Math.min(live.caret, live.value.length)) };
            }
            return {
              base: committedContent,
              pos: resolveInsertPosition(curTarget, { opId: oid, secHeading: heading, uoId: resolvedUoId }, committedContent),
            };
          };
          // Pre-resolve target section synchronously (same lookup logic as
          // the updater below) so we can compute the final caret position
          // before React batches the setState. Mirrors v0.48.2's fix for
          // sampleInserted: `pendingCursor` must be computed from data
          // visible at call time, not from an updater's mutated closure.
          const preWf = workflowRef.current;
          let preOp: UnitOperationBlock | undefined;
          if (preWf) {
            // Issue #34: route by the unique instance id first (uoId), then the
            // submit-time position (opIndex), and only fall back to the opId
            // *code* last — the code can repeat across unit ops, so matching it
            // would target the first duplicate and corrupt the wrong section.
            let idx = typeof uoId === 'string' && uoId.length > 0
              ? preWf.unitOperations.findIndex(o => o.id === uoId)
              : -1;
            if (idx < 0 && typeof opIndex === 'number') idx = opIndex;
            if (idx < 0 && typeof opId === 'string' && opId.length > 0) {
              idx = preWf.unitOperations.findIndex(o => o.opId === opId);
            }
            preOp = preWf.unitOperations[idx];
          }
          let preSec: { heading: string; content: string } | undefined;
          if (preOp) {
            let sIdx = typeof secHeading === 'string' && secHeading.length > 0
              ? preOp.sections.findIndex(s => s.heading === secHeading)
              : -1;
            if (sIdx < 0 && typeof secIndex === 'number') sIdx = secIndex;
            preSec = preOp.sections[sIdx];
          }
          let pendingDefCursorPos: number | null = null;
          if (preOp && preSec) {
            const { base: preBase, pos: pPos } = resolveBaseAndPos(preOp.id, preOp.opId, preSec.heading, preSec.content);
            const pSep = pPos > 0 && preBase[pPos - 1] !== '\n' ? '\n' : '';
            pendingDefCursorPos = pPos + pSep.length + definitionText.length;
          }
          setWorkflow(prev => {
            if (!prev) return prev;
            const ops = [...prev.unitOperations];
            let resolvedOpIndex = typeof uoId === 'string' && uoId.length > 0
              ? ops.findIndex(o => o.id === uoId)
              : -1;
            if (resolvedOpIndex < 0 && typeof opIndex === 'number') {
              resolvedOpIndex = opIndex;
            }
            if (resolvedOpIndex < 0 && typeof opId === 'string' && opId.length > 0) {
              resolvedOpIndex = ops.findIndex(o => o.opId === opId);
            }
            const op = ops[resolvedOpIndex];
            if (!op) return prev;
            const sections = [...op.sections];
            let resolvedSecIndex = -1;
            if (typeof secHeading === 'string' && secHeading.length > 0) {
              resolvedSecIndex = sections.findIndex(s => s.heading === secHeading);
            }
            if (resolvedSecIndex < 0 && typeof secIndex === 'number') {
              resolvedSecIndex = secIndex;
            }
            const sec = sections[resolvedSecIndex];
            if (!sec) return prev;
            // Only reuse the tracked cursor position when the focused textarea
            // actually corresponds to the resolved section; otherwise fall
            // back to end-of-section so we don't splice into an unrelated
            // location (e.g. clicking +Sample in section B while the caret
            // lived in section A).
            const { base, pos } = resolveBaseAndPos(op.id, op.opId, sec.heading, sec.content);
            const separator = pos > 0 && base[pos - 1] !== '\n' ? '\n' : '';
            sections[resolvedSecIndex] = {
              ...sec,
              content: base.slice(0, pos) + separator + definitionText + base.slice(pos),
            };
            ops[resolvedOpIndex] = { ...op, sections };
            return { ...prev, unitOperations: ops };
          });
          if (pendingDefCursorPos !== null) {
            setPendingCursor({ pos: pendingDefCursorPos, tick: Date.now(), scroll: 'nearest' });
            setTimeout(() => setPendingCursor(null), 100);
          }
          markDirty();
          break;
        }

        case 'productSearchResult': {
          setProductSearchResult(message.data);
          break;
        }

        case 'customTypesUpdated': {
          setAvailableTypes(message.data.availableTypes);
          if (message.data.sampleTypeColors) {
            setSampleTypeColors(message.data.sampleTypeColors);
          }
          break;
        }

        case 'imagePasted': {
          const imgText = message.data.markdownText;
          const target = activeSectionRef.current;
          if (!target) break;
          // Phase A-4: mirror sampleInserted — keep actualPos in sync with the
          // pos we actually used inside insertImg so pendingCursor always lands
          // at the end of the just-inserted text (empty sections included).
          let actualPos = 0;
          const live = readLive(target.el);
          const insertImg = (committedContent: string) => {
            // Splice into the live textarea content/caret (issues #33, #34):
            // pasting while the section has uncommitted edits must land where the
            // user sees the caret, not in App's lagging committed content.
            const base = live ? live.value : committedContent;
            const caretPos = live ? live.caret : (target.cursorPos ?? base.length);
            const pos = Math.max(0, Math.min(caretPos, base.length));
            actualPos = pos;
            return base.slice(0, pos) + imgText + base.slice(pos);
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
          setPendingCursor({ pos: actualPos + imgText.length, tick: Date.now(), scroll: 'nearest' });
          setTimeout(() => setPendingCursor(null), 100);
          markDirty();
          break;
        }

        case 'fileAttached': {
          const { markdownLink, area, opIndex, secIndex, sectionIndex, linkedWfIndex, cursorPos } = message.data;
          // Issue #20: when the extension echoes back a valid caret position
          // (set by handleAttachFile only after isFocusedOn), splice the link
          // at that position inline. Otherwise fall back to appending at the
          // section end with the previous newline-padded behaviour so casual
          // attachments still look right in non-textarea contexts.
          const hasCursor = typeof cursorPos === 'number' && Number.isFinite(cursorPos);
          let nextCaret = -1;

          const insertInline = (content: string): string => {
            const { text, newPos } = insertAttachmentLinkAt(content, cursorPos as number, markdownLink);
            nextCaret = newPos;
            return text;
          };

          const appendAtEnd = (content: string): string => {
            if (!content.trim()) return `${markdownLink}\n`;
            return content.endsWith('\n') ? `${content}${markdownLink}\n` : `${content}\n${markdownLink}\n`;
          };

          const apply = hasCursor ? insertInline : appendAtEnd;

          if (area === 'labnoteSection' && sectionIndex !== undefined) {
            setLabNote(prev => {
              if (!prev) return prev;
              const sections = [...prev.sections];
              const sec = sections[sectionIndex];
              if (!sec || !('content' in sec)) return prev;
              sections[sectionIndex] = { ...sec, content: apply(sec.content) };
              return { ...prev, sections };
            });
            markDirty();
          } else if (area === 'tailContent') {
            setWorkflow(prev => {
              if (!prev) return prev;
              return { ...prev, tailContent: apply(prev.tailContent ?? '') };
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
              secs[secIndex] = { ...sec, content: apply(sec.content) };
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
              secs[secIndex] = { ...sec, content: apply(sec.content) };
              ops[opIndex] = { ...op, sections: secs };
              updated[linkedWfIndex] = { ...wf, unitOperations: ops };
              return updated;
            });
            markDirty();
          }

          if (hasCursor && nextCaret >= 0) {
            setPendingCursor({ pos: nextCaret, tick: Date.now(), scroll: 'nearest' });
            setTimeout(() => setPendingCursor(null), 100);
          }
          break;
        }

        case 'saveCompleted':
          setSaveStatus('saved');
          break;

        case 'saveFailed':
          // The extension showed the error; leave the editor marked unsaved so
          // the user knows their changes are not persisted (and a later edit
          // will retrigger the debounced save).
          setSaveStatus('unsaved');
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

          // If the target lives inside a UnitOp accordion that is currently
          // collapsed, the target textarea isn't in the DOM yet and
          // `requestFocusAt` would be a no-op. Expand the accordion first
          // and defer the cursor/scroll to the next frame so the textarea
          // has time to mount.
          let needsDefer = false;
          if (area === 'unitOp' && opIndex !== undefined) {
            const wf = workflowRef.current;
            const targetOpId = wf?.unitOperations[opIndex]?.id;
            if (targetOpId) {
              setOpenedOpIds(prev => (prev.includes(targetOpId) ? prev : [...prev, targetOpId]));
              needsDefer = true;
            }
          }

          const applyCursor = () => {
            setPendingCursor({ pos: localOffset, tick: Date.now(), scroll: 'center' });
            setTimeout(() => setPendingCursor(null), 100);
          };
          if (needsDefer) {
            // Two rAFs: first to let React commit the openedOpIds change and
            // Mantine mount the panel; second to run after layout so
            // scrollIntoView sees the final textarea position.
            requestAnimationFrame(() => requestAnimationFrame(applyCursor));
          } else {
            applyCursor();
          }
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
    // Initial Paste-below enablement: ask the extension whether the system
    // clipboard already holds a labnotev unit-op envelope. Subsequent
    // refreshes happen on Menu open and on webview activation.
    postMessage({ type: 'queryClipboardState' });
    return () => {
      window.removeEventListener('message', handler);
      window.removeEventListener('paste', handlePaste);
    };
  }, [markDirty, showInsertWarning]);

  const handleOpenAsText = useCallback(() => {
    postMessage({ type: 'openAsText' });
  }, []);

  const handleCreateSample = useCallback((opIndex: number, secIndex: number, sampleType: string, alias: string, description: string) => {
    setProductSearchResult(null);
    // Phase C-1: resolve stable identifiers (opId + secHeading) *at submit
    // time* so the extension can echo them back in sampleDefinitionCreated.
    // We keep opIndex/secIndex for backwards compatibility, but the webview's
    // handler prefers the id/heading lookup when both are present.
    const wf = workflowRef.current;
    const op = wf?.unitOperations[opIndex];
    const opId = op?.opId;
    // Issue #34: opId is an operation *code* that may repeat across unit ops.
    // Carry the unique instance id (uoId = op.id) so the echoed definition is
    // routed back to the exact op the user edited, not the first opId match.
    const uoId = op?.id;
    const secHeading = op?.sections[secIndex]?.heading;
    postMessage({
      type: 'createSampleFromModal',
      data: { sampleType, alias, description, opIndex, secIndex, opId, uoId, secHeading },
    });
  }, []);

  const handleSearchProducts = useCallback((sampleType: string) => {
    setProductSearchResult(null);
    postMessage({ type: 'searchProducts', data: { sampleType } });
  }, []);

  const handleAddCustomType = useCallback((typeName: string) => {
    postMessage({ type: 'addCustomType', data: { typeName } });
  }, []);

  const handleAttachFile = useCallback(
    (payload: AttachPayload) => {
      // Issue #20: forward the textarea caret position to the extension so it
      // can echo it back with `fileAttached`. Only do this when the currently
      // focused textarea unambiguously matches the click target — otherwise a
      // stale caret from another section would be applied to this one.
      const active = activeSectionRef.current;
      const cursorPos = isFocusedOn(payload, active) ? active!.cursorPos : undefined;
      postMessage({ type: 'attachFile', data: { ...payload, cursorPos } });
    },
    []
  );

  const handleCopyUnitOp = useCallback((opIndex: number) => {
    const op = workflowRef.current?.unitOperations[opIndex];
    if (!op) return;
    // The React-only `id` is regenerated on every load, so it must not travel
    // through the clipboard — otherwise pasting twice in a row would create
    // two ops with the same Accordion/DnD key. The extension serialises only
    // the data fields the parser produces.
    const { id: _drop, ...rest } = op;
    const payload = JSON.stringify({
      kind: 'labnotev/unit-operation',
      version: 1,
      data: rest,
    });
    postMessage({ type: 'copyUnitOp', data: { payload } });
  }, []);

  const handleRequestPaste = useCallback((afterOpIndex: number) => {
    postMessage({ type: 'requestPasteUnitOp', data: { afterOpIndex } });
  }, []);

  // Stable wrappers for the UnitOpAccordion props. Without these, every
  // keystroke in any textarea recreates the inline arrows inside the
  // <UnitOpAccordion .../> JSX block, defeating React.memo on its children.
  // setWorkflow's functional form lets us avoid putting `workflow` in deps.
  const handleUnitOpsChange = useCallback((ops: UnitOperationBlock[]) => {
    setWorkflow(prev => {
      if (!prev) return prev;
      // Only a removal can reduce the op count (edits/alias/description/reorder
      // preserve ids and length; additions arrive via the extension message
      // path, not here). Gate the O(N) id-set cleanup on a length decrease so
      // the per-keystroke edit path skips the Set/scan entirely.
      const hasRemoval = ops.length < prev.unitOperations.length;
      if (hasRemoval) {
        const newIds = new Set(ops.map(o => o.id));
        setOpenedOpIds(prevIds => prevIds.filter(id => newIds.has(id)));
        const a = activeSectionRef.current;
        if (a?.area === 'unitOp') {
          // Issue #34: track the focused op by its unique id (uoId) so that
          // removing one of several ops sharing the same opId code re-points
          // to the correct surviving instance, not the first code match.
          const newIdx = a.uoId
            ? ops.findIndex(o => o.id === a.uoId)
            : (a.opId ? ops.findIndex(o => o.opId === a.opId) : -1);
          if (newIdx < 0) {
            activeSectionRef.current = null;
          } else if (newIdx !== a.opIndex) {
            activeSectionRef.current = { ...a, opIndex: newIdx };
          }
        }
      }
      return { ...prev, unitOperations: ops };
    });
    markDirty();
  }, [markDirty]);

  const handleUnitOpSectionFocus = useCallback((opIndex: number, secIndex: number, opId: string, secHeading: string, uoId?: string, el?: HTMLTextAreaElement | null) => {
    activeSectionRef.current = { area: 'unitOp', opIndex, secIndex, opId, uoId, secHeading, el };
  }, []);

  const getCursorForUnitOpSection = useCallback((opI: number, secI: number) => {
    return getCursorForArea('unitOp', { opIndex: opI, secIndex: secI });
  }, [getCursorForArea]);

  const handleUnitOpAttachFile = useCallback((opI: number, secI: number) => {
    handleAttachFile({ area: 'unitOp', opIndex: opI, secIndex: secI });
  }, [handleAttachFile]);

  // Stable per-concern handlers for labnote SectionEditors (mirrors the
  // workflow path's handleUnitOps* callbacks). Passing one stable handler that
  // takes `index`, instead of a fresh inline closure per section, is what keeps
  // each memoized SectionEditor from re-rendering on every keystroke in another
  // section. The functional setLabNote update keeps `labNote` out of the deps.
  const handleLabNoteSectionChange = useCallback((index: number, content: string) => {
    setLabNote(prev => {
      if (!prev) return prev;
      const cur = prev.sections[index];
      // Only content-bearing sections (objective/results/freeform) reach a
      // SectionEditor; guard the `heading`/`workflows` variants that have no
      // `content` field so the narrowed spread stays a valid LabNoteSection.
      if (!cur || !('content' in cur)) return prev;
      const sections = [...prev.sections];
      sections[index] = { ...cur, content };
      return { ...prev, sections };
    });
    markDirty();
  }, [markDirty]);

  const handleLabNoteSectionFocus = useCallback((index: number, el?: HTMLTextAreaElement | null) => {
    activeSectionRef.current = { area: 'labnoteSection', sectionIndex: index, el };
  }, []);

  const handleLabNoteSectionAttachFile = useCallback((index: number) => {
    handleAttachFile({ area: 'labnoteSection', sectionIndex: index });
  }, [handleAttachFile]);

  // Workflow mode reuses SectionEditor for the single `tailContent` block.
  // It has no sections-array index, so these dedicated handlers ignore the
  // bound index argument (a placeholder index={0} is passed at the call site).
  const handleTailContentChange = useCallback((_index: number, content: string) => {
    setWorkflow(prev => (prev ? { ...prev, tailContent: content } : prev));
    markDirty();
  }, [markDirty]);

  const handleTailContentFocus = useCallback((_index: number, el?: HTMLTextAreaElement | null) => {
    activeSectionRef.current = { area: 'tailContent', el };
  }, []);

  const handleTailContentAttachFile = useCallback(() => {
    handleAttachFile({ area: 'tailContent' });
  }, [handleAttachFile]);

  const handleQueryClipboardOnMenuOpen = useCallback(() => {
    postMessage({ type: 'queryClipboardState' });
  }, []);

  // Front Matter / workflows-section handlers. Stable identities (functional
  // setState, deps [markDirty]) so the memoized FrontMatterForm /
  // WorkflowChecklist skip re-rendering while the user types in a section.
  // These must stay above the early return below to satisfy rules-of-hooks.
  const updateLabNoteFm = useCallback((key: string, value: unknown) => {
    setLabNote(prev => (prev ? { ...prev, frontMatter: { ...prev.frontMatter, [key]: value } } : prev));
    markDirty();
  }, [markDirty]);

  const handleLabNoteWorkflowsChange = useCallback((items: WorkflowReference[]) => {
    setLabNote(prev => {
      if (!prev) return prev;
      const idx = prev.sections.findIndex(s => s.type === 'workflows');
      const cur = idx >= 0 ? prev.sections[idx] : undefined;
      if (!cur || cur.type !== 'workflows') return prev;
      const sections = [...prev.sections];
      sections[idx] = { ...cur, items };
      return { ...prev, sections };
    });
    markDirty();
  }, [markDirty]);

  const updateWorkflowFm = useCallback((key: string, value: unknown) => {
    setWorkflow(prev => {
      if (!prev) return prev;
      if (key === 'title' && typeof value === 'string') {
        const idx = value.indexOf(' - ');
        const idName = (idx >= 0 ? value.slice(0, idx) : value).trim();
        const desc = idx >= 0 ? value.slice(idx + 3).trim() : '';
        const newHeader = desc ? `[${idName}] ${desc}` : `[${idName}]`;
        return {
          ...prev,
          frontMatter: { ...prev.frontMatter, title: value },
          workflowHeader: newHeader,
        };
      }
      return { ...prev, frontMatter: { ...prev.frontMatter, [key]: value } };
    });
    markDirty();
  }, [markDirty]);

  if (!mode) {
    return (
      <MantineProvider forceColorScheme={colorScheme}>
        <Center h="100vh">
          <Loader />
        </Center>
      </MantineProvider>
    );
  }

  return (
    <MantineProvider forceColorScheme={colorScheme}>
      {findOpen && (
        <FindBar
          query={findQuery}
          onQueryChange={setFindQuery}
          caseSensitive={findCaseSensitive}
          onToggleCase={() => setFindCaseSensitive((v) => !v)}
          count={findMatches.length}
          activeIndex={activeMatchIndex}
          onNext={gotoNextMatch}
          onPrev={gotoPrevMatch}
          onClose={closeFind}
        />
      )}
      <div ref={findContainerRef} style={{ position: 'relative' }}>
        {findOpen && (
          <SearchHighlightLayer
            matches={findMatches}
            activeIndex={activeMatchIndex}
            containerRef={findContainerRef}
          />
        )}
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
              {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved changes'}
            </Badge>
            {insertWarning && (
              <Badge size="sm" variant="filled" color="orange" role="alert">
                {insertWarning}
              </Badge>
            )}
          </Group>
          <Group gap="xs">
            <Tooltip label={colorScheme === 'light' ? 'Dark mode' : 'Light mode'} position="bottom" withArrow>
              <ActionIcon variant="subtle" size="md" onClick={toggleColorScheme} aria-label="Toggle theme">
                {colorScheme === 'light' ? <MoonIcon /> : <SunIcon />}
              </ActionIcon>
            </Tooltip>
            <Button size="xs" variant="subtle" onClick={handleOpenAsText}>
              Open as text
            </Button>
          </Group>
        </Group>

        <Alert variant="light" color="blue" styles={{ root: { padding: '8px 12px' } }}>
          <Text size="xs">This document is auto-saved as you edit. Use "Open as text" to view the raw Markdown.</Text>
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
                      index={index}
                      heading="🎯 Experiment Objective"
                      content={section.content}
                      onChange={handleLabNoteSectionChange}
                      onFocus={handleLabNoteSectionFocus}
                      onCursorActivity={updateCursorPos}
                      docBaseUri={docBaseUri}
                      requestFocusAt={getCursorForArea('labnoteSection', { sectionIndex: index })}
                      availableTypes={availableTypes}
                      sampleTypeColors={sampleTypeColors}
                      sampleDefs={sampleDefs}
                      onAttachFile={handleLabNoteSectionAttachFile}
                    />
                  );
                case 'workflows':
                  return (
                    <WorkflowChecklist
                      key={`sec-${index}`}
                      items={section.items}
                      onChange={handleLabNoteWorkflowsChange}
                    />
                  );
                case 'results':
                  return (
                    <SectionEditor
                      key={`sec-${index}`}
                      index={index}
                      heading="📊 Results & Discussion"
                      content={section.content}
                      onChange={handleLabNoteSectionChange}
                      onFocus={handleLabNoteSectionFocus}
                      onCursorActivity={updateCursorPos}
                      docBaseUri={docBaseUri}
                      requestFocusAt={getCursorForArea('labnoteSection', { sectionIndex: index })}
                      availableTypes={availableTypes}
                      sampleTypeColors={sampleTypeColors}
                      sampleDefs={sampleDefs}
                      onAttachFile={handleLabNoteSectionAttachFile}
                    />
                  );
                case 'freeform':
                  return (
                    <SectionEditor
                      key={`sec-${index}`}
                      index={index}
                      heading={section.heading}
                      content={section.content}
                      onChange={handleLabNoteSectionChange}
                      onFocus={handleLabNoteSectionFocus}
                      onCursorActivity={updateCursorPos}
                      docBaseUri={docBaseUri}
                      requestFocusAt={getCursorForArea('labnoteSection', { sectionIndex: index })}
                      availableTypes={availableTypes}
                      sampleTypeColors={sampleTypeColors}
                      sampleDefs={sampleDefs}
                      onAttachFile={handleLabNoteSectionAttachFile}
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
              <Textarea
                size="sm"
                variant="unstyled"
                placeholder="Add workflow description"
                value={workflow.workflowDescription ?? ''}
                onChange={(e) => {
                  setWorkflow({ ...workflow, workflowDescription: e.currentTarget.value });
                  markDirty();
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.preventDefault(); }}
                autosize
                minRows={1}
                styles={{ input: { fontStyle: 'italic', color: 'var(--mantine-color-dimmed)' } }}
              />
            </Paper>

            <Paper p="sm" withBorder>
              <Title order={3} mb="xs">Unit Operations</Title>
              <UnitOpAccordion
                unitOperations={workflow.unitOperations}
                onChange={handleUnitOpsChange}
                onSectionFocus={handleUnitOpSectionFocus}
                onCursorActivity={updateCursorPos}
                onCreateSample={handleCreateSample}
                onSearchProducts={handleSearchProducts}
                productSearchResult={productSearchResult}
                availableTypes={availableTypes}
                sampleTypeColors={sampleTypeColors}
                sampleDefs={sampleDefs}
                onAddCustomType={handleAddCustomType}
                docBaseUri={docBaseUri}
                getCursorForSection={getCursorForUnitOpSection}
                onAttachFile={handleUnitOpAttachFile}
                openedOpIds={openedOpIds}
                onOpenedChange={setOpenedOpIds}
                onCopy={handleCopyUnitOp}
                onPasteBelow={handleRequestPaste}
                clipboardHasUnitOp={clipboardHasUnitOp}
                onMenuOpen={handleQueryClipboardOnMenuOpen}
              />
            </Paper>

            {workflow.tailContent !== undefined && (
              <SectionEditor
                index={0}
                heading="📝 Conclusions and Discussion"
                content={workflow.tailContent}
                onChange={handleTailContentChange}
                onFocus={handleTailContentFocus}
                onCursorActivity={updateCursorPos}
                headingLevel="h2"
                minRows={3}
                docBaseUri={docBaseUri}
                requestFocusAt={getCursorForArea('tailContent')}
                availableTypes={availableTypes}
                sampleTypeColors={sampleTypeColors}
                sampleDefs={sampleDefs}
                onAttachFile={handleTailContentAttachFile}
              />
            )}
          </>
        )}

        {mode === 'unknown' && (
          <Paper p="md" withBorder>
            <Text>This file is not in Lab Note or Workflow format.</Text>
            <Button mt="sm" onClick={handleOpenAsText}>Open in text editor</Button>
          </Paper>
        )}
        </Stack>
      </div>
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
