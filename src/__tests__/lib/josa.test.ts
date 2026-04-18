import { hasBatchim, josa, withJosa } from '../../lib/josa';

describe('josa helper', () => {
  describe('hasBatchim', () => {
    it('returns true for syllables ending with 받침', () => {
      expect(hasBatchim('샘플')).toBe(true); // ㄹ
      expect(hasBatchim('문서')).toBe(false); // no 받침 after '서'
      expect(hasBatchim('ID')).toBe(false);
    });

    it('returns false for empty or non-Hangul input', () => {
      expect(hasBatchim('')).toBe(false);
      expect(hasBatchim('123')).toBe(false);
      expect(hasBatchim('DNA-1737000000000')).toBe(false);
    });
  });

  describe('josa', () => {
    it('picks 을/를 by 받침 presence', () => {
      expect(josa('샘플', '을/를')).toBe('을'); // 받침 있음
      expect(josa('문서', '을/를')).toBe('를'); // 받침 없음
    });

    it('picks 이/가 by 받침 presence', () => {
      expect(josa('책상', '이/가')).toBe('이');
      expect(josa('사과', '이/가')).toBe('가');
    });

    it('picks 은/는 by 받침 presence', () => {
      expect(josa('강남', '은/는')).toBe('은');
      expect(josa('서울', '은/는')).toBe('은'); // ㄹ 받침
      expect(josa('학교', '은/는')).toBe('는');
    });

    it('handles 으로/로 with ㄹ 받침 special case', () => {
      expect(josa('서울', '으로/로')).toBe('로'); // ㄹ 받침 → 로
      expect(josa('책상', '으로/로')).toBe('으로'); // 다른 받침 → 으로
      expect(josa('학교', '으로/로')).toBe('로'); // 받침 없음 → 로
    });

    it('defaults to no-batchim form for non-Hangul input', () => {
      expect(josa('DNA-1737000000000', '을/를')).toBe('를');
      expect(josa('DNA-1737000000000', '이/가')).toBe('가');
      expect(josa('DNA-1737000000000', '으로/로')).toBe('로');
    });
  });

  describe('withJosa', () => {
    it('appends the correct particle to the word', () => {
      expect(withJosa('샘플', '을/를')).toBe('샘플을');
      expect(withJosa('문서', '을/를')).toBe('문서를');
      expect(withJosa('DNA-123', '을/를')).toBe('DNA-123를');
    });
  });
});
