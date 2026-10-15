/**
 * 사용자가 고른 시안의 저장·복원 규칙.
 * 같은 규칙을 (1) <head> 인라인 스크립트와 (2) 전환 버튼이 함께 쓰므로 한곳에 둔다.
 */
export const SCHEME_STORAGE_KEY = "woojoostay-color-scheme";
export const SCHEME_ATTRIBUTE = "data-scheme";

/**
 * 첫 화면을 그리기 전에 실행되는 스크립트 본문.
 * 저장된 시안이 있으면 <html data-scheme="..."> 를 먼저 맞춰서 색이 깜빡이지 않게 한다.
 */
export function restoreSchemeScript(allowedIds: readonly string[]): string {
  return `(function(){try{var v=localStorage.getItem(${JSON.stringify(SCHEME_STORAGE_KEY)});if(${JSON.stringify(
    allowedIds,
  )}.indexOf(v)>-1)document.documentElement.setAttribute(${JSON.stringify(SCHEME_ATTRIBUTE)},v)}catch(e){}})()`;
}
