/** 한국어 조사·언어 판별 도우미 */

const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;
/** 숫자를 한국어로 읽을 때 받침이 있는지 (0 영, 1 일, 3 삼, 6 육, 7 칠, 8 팔) */
const DIGIT_HAS_FINAL = [true, true, false, true, false, false, true, true, true, false];

export type Particle = '을/를' | '이/가' | '은/는' | '과/와';

/** 마지막 글자에 받침이 있는지 — 한글·숫자가 아니면 null (판단 불가) */
export function hasFinalConsonant(word: string): boolean | null {
  const ch = word
    .trim()
    .replace(/[\s.,!?)\]"'’”]+$/u, '')
    .slice(-1);
  if (!ch) return null;
  const code = ch.charCodeAt(0);
  if (code >= HANGUL_FIRST && code <= HANGUL_LAST) return (code - HANGUL_FIRST) % 28 !== 0;
  if (/\d/.test(ch)) return DIGIT_HAS_FINAL[Number(ch)];
  return null;
}

/** 단어 + 알맞은 조사 — josa('우주스테이', '을/를') → '우주스테이를'. 판단할 수 없으면 '을(를)' */
export function josa(word: string, particle: Particle): string {
  const [withFinal, withoutFinal] = particle.split('/');
  const f = hasFinalConsonant(word);
  if (f === null) return `${word}${withFinal}(${withoutFinal})`;
  return `${word}${f ? withFinal : withoutFinal}`;
}

/** 글자(숫자·기호 빼고) 중 한글 비율 0~1 */
export function hangulRatio(text: string): number {
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  if (letters === 0) return 0;
  return (text.match(/\p{Script=Hangul}/gu)?.length ?? 0) / letters;
}

/** 한국어 리뷰로 볼지 — 한글이 글자의 30% 이상 */
export function isKorean(text: string): boolean {
  return hangulRatio(text) >= 0.3;
}
