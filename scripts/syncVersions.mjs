#!/usr/bin/env node
/**
 * Single source of truth for the release version.
 *
 * Reads the version from the root `package.json` and propagates it to every
 * place that must agree for a release to be valid:
 *
 *   - packages/core/package.json
 *
 * Run via `npm run sync:versions` (the auto-versioning workflow calls this after
 * bumping the root version). Idempotent: safe to run repeatedly.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

const rootPkgPath = join(root, 'package.json');
const version = readJson(rootPkgPath).version;
if (!version) {
  console.error('[sync:versions] root package.json has no version');
  process.exit(1);
}

const targets = [
  join(root, 'packages/core/package.json'),
];
for (const path of targets) {
  const pkg = readJson(path);
  pkg.version = version;
  writeJson(path, pkg);
}

console.log(`[sync:versions] synced all packages to v${version}`);
