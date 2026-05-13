/**
 * Inserts `link` into `content` at `pos`, returning the resulting text and the
 * caret position immediately after the inserted link. `pos` is clamped to
 * `[0, content.length]` so callers do not need to range-check.
 *
 * The insertion is intentionally raw/inline: callers that want extra padding
 * (e.g. trailing newline when appending at the end) must apply it themselves.
 */
export function insertAttachmentLinkAt(
  content: string,
  pos: number,
  link: string,
): { text: string; newPos: number } {
  const clamped = Math.max(0, Math.min(pos, content.length));
  const text = content.slice(0, clamped) + link + content.slice(clamped);
  return { text, newPos: clamped + link.length };
}
