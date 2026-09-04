/**
 * Obsidian-side i18n: reuse the extension's Korean bundle through the shared
 * {@link createTranslator} primitive from core.
 *
 * The exact same `l10n/bundle.l10n.ko.json` the VS Code extension ships is
 * imported here (esbuild inlines the JSON), so there is a single source of
 * translated strings across both platforms. English is the identity locale
 * (keys are the English source strings by convention).
 */
import { createTranslator, type Translator } from '@labnotev/core';
// Reuse the extension's Korean catalog verbatim (single source of truth).
import koBundle from '../../../l10n/bundle.l10n.ko.json';

/** Resolve Obsidian's active UI language (e.g. 'en', 'ko'). */
export function getObsidianLanguage(): string {
  try {
    return window.localStorage.getItem('language') ?? 'en';
  } catch {
    return 'en';
  }
}

/** Build a {@link Translator} appropriate for the current Obsidian locale. */
export function createObsidianTranslator(lang = getObsidianLanguage()): Translator {
  if (lang === 'ko') {
    return createTranslator(koBundle as Record<string, string>);
  }
  return createTranslator();
}
