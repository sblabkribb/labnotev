/**
 * Structural validation for messages posted by the Section Editor webview.
 *
 * VS Code only delivers `onDidReceiveMessage` events from the panel's own
 * webview (there is no cross-origin sender to authenticate), so the meaningful
 * hardening is schema validation: reject anything that is not a plain object
 * carrying a non-empty string `type`, and — when present — an object `data`
 * payload. This gives the message handler a single, well-defined entry guard
 * instead of relying on each case to defensively re-check the envelope.
 *
 * Returns a boolean (not a type predicate) on purpose so callers can keep the
 * loosely typed `message` value for their existing per-case field access.
 */
export function isValidSectionEditorMessage(message: unknown): boolean {
  if (typeof message !== 'object' || message === null) {
    return false;
  }
  const { type, data } = message as { type?: unknown; data?: unknown };
  if (typeof type !== 'string' || type.length === 0) {
    return false;
  }
  if (data !== undefined && (typeof data !== 'object' || data === null)) {
    return false;
  }
  return true;
}
