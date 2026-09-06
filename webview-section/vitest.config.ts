import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@labnotev/core/headings': resolve(__dirname, '../packages/core/src/sections/unitOpHeading.ts'),
      '@labnotev/core': resolve(__dirname, '../packages/core/src/index.ts'),
    },
  },
  test: {
    root: __dirname,
    globals: true,
    environment: 'jsdom',
    setupFiles: [resolve(__dirname, 'src/__tests__/setup.ts')],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Safety net so a future environment/dependency regression surfaces as a
    // fast failure instead of a multi-minute CI hang. Note: this only fires
    // when the event loop is free; a fully synchronous hang would still block
    // it (as happened with the nwsapi :has() recursion), so it complements —
    // not replaces — keeping problematic deps pinned.
    testTimeout: 15000,
  },
});
