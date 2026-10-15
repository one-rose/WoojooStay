/**
 * 브랜드 칼라 시안(Color Scheme) 도메인 모델.
 *
 * 시안 = "디자인 토큰 이름 → 값" 묶음. 화면의 모든 색은 토큰만 참조하므로
 * 시안을 바꾸면 사이트 전체 색이 바뀐다. 실제 값은 infrastructure 레이어에 있다.
 */

export const SCHEME_IDS = ["purple", "a", "b", "c", "d", "e"] as const;
export type SchemeId = (typeof SCHEME_IDS)[number];

/** CSS 커스텀 프로퍼티 이름 (예: "--primary") */
export type DesignToken = `--${string}`;

export interface ColorScheme {
  id: SchemeId;
  /** 전환 버튼에 표시하는 짧은 코드 ("원본", "A" …) */
  code: string;
  name: string;
  description: string;
  /** 전환 버튼 미리보기 점에 쓰는 대표 색 3개 */
  swatch: readonly [string, string, string];
  tokens: Readonly<Record<DesignToken, string>>;
}

export function isSchemeId(value: unknown): value is SchemeId {
  return typeof value === "string" && (SCHEME_IDS as readonly string[]).includes(value);
}
