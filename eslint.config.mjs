// Flat ESLint config for the host extension (src/**). Introduced as an
// advisory check: CI runs it with continue-on-error so the (large) existing
// codebase is not blocked while violations are addressed incrementally.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'out/**',
      'coverage/**',
      'node_modules/**',
      'webview-section/**',
      'esbuild.js',
      '**/*.mjs',
      '**/*.cjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    rules: {
      // TypeScript already checks for undefined identifiers and unreachable
      // globals; ESLint's no-undef duplicates that and misfires on ambient
      // test/Node globals.
      'no-undef': 'off',
      'no-empty': 'off',
      'no-control-regex': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // This file's exported function returns source that Playwright injects
    // into a page via page.evaluate(), so it runs in a browser, not Node.
    files: ['tools/demo-recorder/lib/highlight.js'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
      },
    },
  }
);
