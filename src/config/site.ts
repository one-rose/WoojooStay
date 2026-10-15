import { isSchemeId, type SchemeId } from "@/core";

/**
 * 배포 환경 설정 (.env 참고)
 * - NEXT_PUBLIC_DEFAULT_SCHEME  : 처음 보여줄 칼라 시안 (기본 purple)
 * - NEXT_PUBLIC_SCHEME_SWITCHER : "off" 면 하단 시안 전환 버튼을 숨긴다 (시안 확정 후 사용)
 */
const rawDefault = process.env.NEXT_PUBLIC_DEFAULT_SCHEME;

export const siteConfig = {
  defaultScheme: (isSchemeId(rawDefault) ? rawDefault : "purple") as SchemeId,
  schemeSwitcherEnabled: process.env.NEXT_PUBLIC_SCHEME_SWITCHER !== "off",
} as const;
