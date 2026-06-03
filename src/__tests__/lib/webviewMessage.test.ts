import { describe, it, expect } from 'vitest';
import { isValidSectionEditorMessage } from '../../lib/webviewMessage';

describe('isValidSectionEditorMessage', () => {
  it('accepts a message with a non-empty string type and object data', () => {
    expect(isValidSectionEditorMessage({ type: 'save', data: { foo: 1 } })).toBe(true);
  });

  it('accepts a message with type and no data', () => {
    expect(isValidSectionEditorMessage({ type: 'ready' })).toBe(true);
  });

  it('rejects null and non-objects', () => {
    expect(isValidSectionEditorMessage(null)).toBe(false);
    expect(isValidSectionEditorMessage(undefined)).toBe(false);
    expect(isValidSectionEditorMessage('save')).toBe(false);
    expect(isValidSectionEditorMessage(42)).toBe(false);
  });

  it('rejects a missing or non-string type', () => {
    expect(isValidSectionEditorMessage({ data: {} })).toBe(false);
    expect(isValidSectionEditorMessage({ type: 123 })).toBe(false);
  });

  it('rejects an empty string type', () => {
    expect(isValidSectionEditorMessage({ type: '' })).toBe(false);
  });

  it('rejects data that is a primitive when present', () => {
    expect(isValidSectionEditorMessage({ type: 'x', data: 'nope' })).toBe(false);
    expect(isValidSectionEditorMessage({ type: 'x', data: 5 })).toBe(false);
  });
});
