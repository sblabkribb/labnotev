// Type-only augmentation: makes jest-dom matchers (toBeInTheDocument, etc.)
// known to vitest's `expect` for typecheck. Matchers are registered at runtime
// in src/__tests__/setup.ts; this file only provides the type declarations.
import '@testing-library/jest-dom/vitest';
