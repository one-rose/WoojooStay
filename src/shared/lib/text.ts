/** 한자 · 히라가나 · 가타카나 · 전각 문장부호 (한글은 포함하지 않음) */
const CJK = /[　-ヿ㐀-䶿一-鿿豈-﫿＀-￯]/;

/**
 * 두 줄을 이어 붙일 때 사이에 띄어쓰기가 필요한지.
 * 한국어·영어는 단어 사이를 띄우고, 일본어·중국어는 붙여 쓴다.
 */
export function needsSpaceBetween(before: string, after: string): boolean {
  const last = before.at(-1) ?? "";
  const first = after.at(0) ?? "";
  return !(CJK.test(last) || CJK.test(first));
}
