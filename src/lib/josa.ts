/**
 * Lightweight Korean particle (조사) helper.
 *
 * Phase D-2: we sprinkle strings like `${oldId}를 새 ID로 변경` throughout the
 * sample panel. When `oldId` ends in a consonant (받침 있음) the grammatical
 * particle flips (를→을, 가→이, 는→은, 와→과, …). Doing this correctly avoids
 * the awkward `을(를)` fallback in user-facing messages.
 *
 * We intentionally stay minimal — Unicode Hangul syllable block only
 * (0xAC00–0xD7A3), no Latin/English fallback handling. If the trailing char
 * isn't a Hangul syllable, we default to the no-batchim form so alias-less
 * sample ids like `DNA-123` get the natural-sounding `DNA-123를`.
 */
export type JosaKey = '을/를' | '이/가' | '은/는' | '와/과' | '으로/로';

const JOSA_TABLE: Record<JosaKey, { with: string; without: string }> = {
  '을/를': { with: '을', without: '를' },
  '이/가': { with: '이', without: '가' },
  '은/는': { with: '은', without: '는' },
  '와/과': { with: '과', without: '와' },
  // `으로/로`: 받침이 ㄹ인 경우는 '로'를 쓴다 (특수 케이스).
  '으로/로': { with: '으로', without: '로' },
};

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
const JONGSEONG_COUNT = 28;
const JONGSEONG_RIEUL = 8; // ㄹ

/**
 * Return `true` when the last character of `word` has a 받침.
 * Non-Hangul endings return `false` so default no-batchim particles apply.
 */
export function hasBatchim(word: string): boolean {
  if (!word) return false;
  const last = word.charCodeAt(word.length - 1);
  if (last < HANGUL_START || last > HANGUL_END) return false;
  const jongseong = (last - HANGUL_START) % JONGSEONG_COUNT;
  return jongseong !== 0;
}

/**
 * Pick the correct Korean particle for `word`. For `으로/로` we treat the ㄹ
 * 받침 as if there were no 받침 (because `로` is the natural choice after ㄹ).
 */
export function josa(word: string, key: JosaKey): string {
  if (!word) return JOSA_TABLE[key].without;
  const last = word.charCodeAt(word.length - 1);
  const isHangul = last >= HANGUL_START && last <= HANGUL_END;
  if (!isHangul) return JOSA_TABLE[key].without;
  const jongseong = (last - HANGUL_START) % JONGSEONG_COUNT;
  if (key === '으로/로') {
    // ㄹ 받침은 '로'를 쓰고, 그 외 받침은 '으로'.
    if (jongseong === 0 || jongseong === JONGSEONG_RIEUL) return '로';
    return '으로';
  }
  return jongseong === 0 ? JOSA_TABLE[key].without : JOSA_TABLE[key].with;
}

/** Convenience: append the correct particle directly to the word. */
export function withJosa(word: string, key: JosaKey): string {
  return `${word}${josa(word, key)}`;
}
