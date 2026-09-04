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
  },
});
