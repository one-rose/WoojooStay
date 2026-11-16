import { hangulRatio, hasFinalConsonant, isKorean, josa } from './korean.js';

describe('조사 고르기', () => {
  it('받침 있으면 을·이·은·과, 없으면 를·가·는·와', () => {
    expect(josa('객실', '을/를')).toBe('객실을');
    expect(josa('우주스테이', '을/를')).toBe('우주스테이를');
    expect(josa('조식', '이/가')).toBe('조식이');
    expect(josa('위치', '이/가')).toBe('위치가');
    expect(josa('침구', '은/는')).toBe('침구는');
    expect(josa('청결', '은/는')).toBe('청결은');
    expect(josa('빠른 체크인', '과/와')).toBe('빠른 체크인과');
    expect(josa('직원 응대', '과/와')).toBe('직원 응대와');
  });

  it('숫자는 읽는 소리로, 영문은 판단할 수 없어 둘 다 적는다', () => {
    expect(josa('301', '을/를')).toBe('301을');
    expect(josa('202', '을/를')).toBe('202를');
    expect(josa('Orbit', '을/를')).toBe('Orbit을(를)');
    expect(hasFinalConsonant('')).toBeNull();
    expect(hasFinalConsonant('오르빗!')).toBe(true);
  });

  it('한글 비율로 한국어 리뷰인지 본다', () => {
    expect(isKorean('방이 깨끗했어요')).toBe(true);
    expect(isKorean('Great location, clean room.')).toBe(false);
    expect(isKorean('位置很方便，房间干净。')).toBe(false);
    expect(isKorean('Wi-Fi 가 빨라요 good')).toBe(true);
    expect(hangulRatio('123 !!')).toBe(0);
  });
});
