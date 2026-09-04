import { defineConfig } from 'vitest/config';
import * as path from 'node:path';

// Array-form aliases so the `@labnotev/core/lib/*` wildcard subpath can be
// resolved via a RegExp (vite/@rollup-plugin-alias only support wildcard
// matching through RegExp `find` entries). Order matters: the most specific
// entries must come first so a shorter prefix does not shadow them.
const coreAlias = [
  {
    find: /^@labnotev\/core\/lib\/(.*)$/,
    replacement: path.resolve(__dirname, 'packages/core/src/lib/$1.ts'),
  },
  {
    find: '@labnotev/core/node',
    replacement: path.resolve(__dirname, 'packages/core/src/node/index.ts'),
  },
  {
    find: '@labnotev/core',
    replacement: path.resolve(__dirname, 'packages/core/src/index.ts'),
  },
];

export default defineConfig({
  resolve: {
    alias: coreAlias,
  },
  test: {
    projects: [
      {
        resolve: {
          alias: coreAlias,
        },
        test: {
          name: 'extension',
          environment: 'node',
          globals: true,
          include: ['src/**/*.{test,spec}.{js,ts}'],
          setupFiles: ['./src/__tests__/setup.ts'],
        },
      },
      {
        resolve: {
          alias: coreAlias,
        },
        test: {
          // Core tests run WITHOUT the vscode mock so nothing accidentally
          // couples pure logic to the extension host.
          name: 'core',
          environment: 'node',
          globals: true,
          include: ['packages/core/src/**/*.{test,spec}.{js,ts}'],
        },
      },
    ],
  },
});
