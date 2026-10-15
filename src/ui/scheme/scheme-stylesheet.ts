import type { ColorScheme, SchemeId } from "@/core";
import { ILLUSTRATIONS, illustrationToken } from "../media";
import type { IllustrationId } from "@/core";

/** 시안 하나의 CSS 변수 선언부 (색 토큰 + 일러스트 이미지 주소) */
function declarations(scheme: ColorScheme): string {
  const colors = Object.entries(scheme.tokens).map(([name, value]) => `${name}:${value}`);
  const images = (Object.keys(ILLUSTRATIONS[scheme.id]) as IllustrationId[]).map(
    (id) => `${illustrationToken(id)}:url("${ILLUSTRATIONS[scheme.id][id].src}")`,
  );
  return [...colors, ...images].join(";");
}

/**
 * 모든 시안의 스타일시트를 만든다.
 *   :root                   → 기본 시안 (data-scheme 이 없을 때)
 *   [data-scheme="<id>"]    → 해당 시안
 * 레이아웃의 <head> 에 그대로 넣는다 (서버에서 생성, 자바스크립트 불필요).
 */
export function buildSchemeStylesheet(schemes: readonly ColorScheme[], defaultId: SchemeId): string {
  return schemes
    .map((scheme) => {
      const selector = scheme.id === defaultId ? `:root,[data-scheme="${scheme.id}"]` : `[data-scheme="${scheme.id}"]`;
      return `${selector}{${declarations(scheme)}}`;
    })
    .join("\n");
}
