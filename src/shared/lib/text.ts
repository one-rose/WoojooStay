/**
 * 받침에 맞는 조사 — josa("야놀자", "을/를") → "야놀자를", josa("여기어때", "은/는") → "여기어때는"
 * 한글이 아니면(영문·숫자) 받침 없는 쪽으로 붙인다. "으로/로" 는 ㄹ 받침도 "로".
 */
export function josa(word: string, pair: "을/를" | "은/는" | "이/가" | "과/와" | "으로/로"): string {
  const code = word.trim().at(-1)?.charCodeAt(0) ?? 0;
  const hangul = code >= 0xac00 && code <= 0xd7a3;
  const jong = hangul ? (code - 0xac00) % 28 : 0;
  const [withBatchim, without] = pair.split("/");
  const useFirst = pair === "으로/로" ? jong !== 0 && jong !== 8 : jong !== 0;
  return word + (useFirst ? withBatchim : without);
}

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
