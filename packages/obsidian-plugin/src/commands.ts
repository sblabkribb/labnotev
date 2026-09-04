/**
 * Obsidian command implementations.
 *
 * These are thin orchestrators: all domain logic (structure/content generation,
 * checklist parsing, TOC building, path validation) lives in `@labnotev/core`
 * and is unit-tested there. Each command wires core functions to the
 * {@link LabnoteHost} (modals/notices) and the {@link VaultFileSystem}.
 *
 * Vault root is the empty string: core path helpers join it away, so
 * `join('', 'labnote', ...)` yields vault-relative `labnote/...` paths that the
 * adapter understands.
 */
import type { App } from 'obsidian';
import type {
  LabnoteHost,
  WorkflowItem,
  UnitOperationItem,
  PickItem,
  InsertUnitOperationInput,
} from '@labnotev/core';
import {
  insertUnitOperationAtCursor,
  appendUnitOpToWorkflowToc,
} from '@labnotev/core';
import * as posix from '@labnotev/core/posix';
import { createLabnoteStructure } from '@labnotev/core/lib/labnoteStructure';
import {
  ensureWorkflowResources,
  loadWorkflows,
  loadUnitOperations,
} from '@labnotev/core/lib/workflowDataLoader';
import {
  getNextWorkflowNumber,
  createWorkflowFileName,
  createWorkflowContent,
  parseWorkflowChecklistFromReadme,
  generateWorkflowChecklist,
  updateReadmeWorkflowSection,
  parseExperimenterFromReadme,
} from '@labnotev/core/lib/workflowStructure';

// Vault root sentinel. Core loaders treat a falsy root as "no workspace" and
// bail, so we use '.' — it is truthy yet normalises away, keeping every derived
// path clean and vault-relative (e.g. `resources/workflows/...`, `labnote/...`).
const VAULT_ROOT = '.';
const README = 'README.labnote.md';

/** Derive the `labnote/{###_Name}` experiment dir from a vault-relative path. */
function labnoteDirFromPath(p: string): string | undefined {
  const parts = posix.normalize(p).split('/');
  const idx = parts.lastIndexOf('labnote');
  if (idx === -1 || idx + 1 >= parts.length) return undefined;
  const exp = parts[idx + 1];
  if (!/^\d{3}_/.test(exp)) return undefined;
  return parts.slice(0, idx + 2).join('/');
}

/**
 * Resolve the target experiment folder: prefer the active note's folder, else
 * let the user pick from `labnote/###_*`. Returns undefined if none / cancelled.
 */
async function resolveLabnoteDir(host: LabnoteHost): Promise<string | undefined> {
  const active = host.editTarget()?.path;
  if (active) {
    const dir = labnoteDirFromPath(active);
    if (dir) return dir;
  }

  const entries = await host.fs.list('labnote');
  const folders = entries.filter(name => /^\d{3}_/.test(name));
  if (folders.length === 0) {
    host.notify('warn', host.t('No experiment folder found. Create one first.'));
    return undefined;
  }
  const picked = await host.pick(
    folders.map<PickItem<string>>(name => ({ label: name, value: name })),
    { title: host.t('Select experiment folder') }
  );
  return picked ? posix.join('labnote', picked) : undefined;
}

/** Create a new experiment folder (labnote/###_Title) + README scaffold. */
export async function createExperimentCommand(app: App, host: LabnoteHost): Promise<void> {
  const title = await host.prompt({
    title: host.t('New experiment'),
    prompt: host.t('Experiment title'),
    validate: v => (v.trim() ? null : host.t('Title is required.')),
  });
  if (!title) return;

  const existing = await host.fs.list('labnote');
  const structure = createLabnoteStructure(VAULT_ROOT, title.trim(), existing);

  await host.fs.mkdir(structure.labnoteFolder);
  await host.fs.mkdir(structure.imagesFolder);
  await host.fs.mkdir(structure.resourcesFolder);
  await host.fs.write(structure.readmePath, structure.readmeContent);

  await host.openFile(structure.readmePath);
  host.notify('info', host.t('Experiment created: {0}', posix.basename(structure.labnoteFolder)));
}

/** Create a new workflow file inside an experiment + register it in the README. */
export async function createWorkflowCommand(app: App, host: LabnoteHost): Promise<void> {
  const labnoteDir = await resolveLabnoteDir(host);
  if (!labnoteDir) return;

  await ensureWorkflowResources(host.fs, VAULT_ROOT);
  const catalog = await loadWorkflows(host.fs, VAULT_ROOT);
  const chosen = await host.pick(
    catalog.workflows.map<PickItem<WorkflowItem>>(wf => ({
      label: `${wf.id}: ${wf.name}`,
      description: wf.category,
      detail: wf.description,
      value: wf,
    })),
    { title: host.t('Select workflow'), placeholder: host.t('Search workflows') }
  );
  if (!chosen) return;

  const readmePath = posix.join(labnoteDir, README);
  let experimenter = '';
  if (await host.fs.exists(readmePath)) {
    experimenter = parseExperimenterFromReadme(await host.fs.read(readmePath));
  }

  const existingFiles = await host.fs.list(labnoteDir);
  const sequence = getNextWorkflowNumber(existingFiles);
  const info = { id: chosen.id, name: chosen.name, description: chosen.description };
  const fileName = createWorkflowFileName(sequence, info);
  const workflowPath = posix.join(labnoteDir, fileName);

  await host.fs.write(workflowPath, createWorkflowContent(info, experimenter));

  // Register in the README "Related Workflows" checklist (non-destructive).
  if (await host.fs.exists(readmePath)) {
    const readme = await host.fs.read(readmePath);
    const items = parseWorkflowChecklistFromReadme(readme);
    items.push({ done: false, title: `${chosen.id} ${chosen.name}`, fileName });
    const updated = updateReadmeWorkflowSection(readme, generateWorkflowChecklist(items));
    await host.fs.write(readmePath, updated);
  }

  await host.openFile(workflowPath);
  host.notify('info', host.t('Workflow created: {0}', fileName));
}

/**
 * Insert a unit-operation block at the cursor, then non-lossily append its
 * entry to the `## Related Unit Operations` TOC. Shared by the command and the
 * workflow sidebar's context menu.
 */
export async function insertUnitOpAndUpdateToc(
  host: LabnoteHost,
  input: InsertUnitOperationInput
): Promise<boolean> {
  const ok = await insertUnitOperationAtCursor(host, input);
  if (!ok) return false;
  const target = host.editTarget();
  if (target) {
    const md = await target.getText();
    const updated = appendUnitOpToWorkflowToc(md, input.opId, input.opName);
    if (updated !== md) {
      await target.replaceRange(0, md.length, updated);
    }
  }
  return true;
}

/** Insert a unit-operation block at the cursor + update the workflow TOC. */
export async function insertUnitOperationCommand(app: App, host: LabnoteHost): Promise<void> {
  await ensureWorkflowResources(host.fs, VAULT_ROOT);
  const hw = await loadUnitOperations(host.fs, VAULT_ROOT, 'hw');
  const sw = await loadUnitOperations(host.fs, VAULT_ROOT, 'sw');

  const items: PickItem<{ op: UnitOperationItem; kind: 'hw' | 'sw' }>[] = [
    ...hw.unitOperations.map(op => ({
      label: `${op.id}: ${op.name}`,
      description: 'HW',
      detail: op.description,
      value: { op, kind: 'hw' as const },
    })),
    ...sw.unitOperations.map(op => ({
      label: `${op.id}: ${op.name}`,
      description: 'SW',
      detail: op.description,
      value: { op, kind: 'sw' as const },
    })),
  ];

  const chosen = await host.pick(items, {
    title: host.t('Insert unit operation'),
    placeholder: host.t('Search unit operations'),
  });
  if (!chosen) return;

  const { op, kind } = chosen;
  await insertUnitOpAndUpdateToc(host, {
    opId: op.id,
    opName: op.name,
    opDescription: op.description,
    opType: kind,
    equipment: op.equipment,
    software: op.software,
  });
}
