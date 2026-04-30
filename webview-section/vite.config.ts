import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    cssCodeSplit: false,
    // The webview ships as a single iife bundle loaded from disk inside the
    // VS Code Custom Editor. There's no network cost, so the default 500KB
    // warning is noise. Raise to 700KB which still flags genuine bloat.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: 'src/index.tsx',
      output: {
        entryFileNames: 'index.js',
        assetFileNames: 'index[extname]',
        format: 'iife',
      },
    },
  },
});
