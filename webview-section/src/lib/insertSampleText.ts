/**
 * Splice `text` into `original` at `cursorPos`, returning the resulting content
 * and the caret offset immediately after the inserted text.
 *
 * `cursorPos` is clamped to `[0, original.length]`; when undefined the text is
 * appended at the end.
 *
 * Prefix collapsing: if `text` begins with a sample prefix (`@type;` / `@type:`)
 * and the user already typed the SAME-type prefix immediately before the caret,
 * that existing prefix is removed so a TreeView pick does not produce
 * `@dna;@dna;DNA-123`.
 *
 * The caret is derived from the same splice as the content, so the two can
 * never drift apart (the previous inline implementation computed them
 * separately, which is how a stale value could land the caret at column 0).
 */
export function insertSampleText(
  original: string,
  cursorPos: number | undefined,
  text: string,
): { content: string; caret: number } {
  const pos = Math.max(0, Math.min(cursorPos ?? original.length, original.length));

  let cutStart = pos;
  const prefixMatch = /^@([a-z]+)[;:]/i.exec(text);
  if (prefixMatch) {
    const typeLower = prefixMatch[1];
    const before = original.slice(0, pos);
    const existingRe = new RegExp(`@${typeLower}[;:]$`, 'i');
    const m = existingRe.exec(before);
    if (m) cutStart = before.length - m[0].length;
  }

  const content = original.slice(0, cutStart) + text + original.slice(pos);
  return { content, caret: cutStart + text.length };
}
