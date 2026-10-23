/** 지원 언어. 첫 번째가 기본 언어이며 "/" 경로로 열린다. 나머지는 "/en" 처럼 접두사가 붙는다. */
export const LOCALES = ["ko", "en", "ja", "zh"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ko";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** 언어별 홈 경로 — 기본 언어는 "/" */
export function localePath(locale: Locale): string {
  return locale === DEFAULT_LOCALE ? "/" : `/${locale}`;
}
