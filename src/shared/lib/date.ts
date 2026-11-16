/** "YYYY-MM-DD" 날짜 문자열 계산 (시간대 영향 없이 UTC 기준) */

function parse(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** addDays("2026-11-10", 3) → "2026-11-13" */
export function addDays(iso: string, days: number): string {
  const date = parse(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return format(date);
}

/** 0 = 일요일 … 6 = 토요일 */
export function weekday(iso: string): number {
  return parse(iso).getUTCDay();
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function weekdayKo(iso: string): string {
  return WEEKDAY_KO[weekday(iso)];
}

/** "2026-11-13" → "11.13 (금)" */
export function formatShortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}.${Number(d)} (${weekdayKo(iso)})`;
}

/** "2026-11-16" → "11월 16일 월요일" */
export function formatLongDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}월 ${Number(d)}일 ${weekdayKo(iso)}요일`;
}

/** ISO 시각 → 한국 시간 기준 "YYYY-MM-DD" (UTC 로 자르면 오전 0~9시가 전날로 보임) */
export function kstDay(isoDateTime: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDateTime)) return isoDateTime;
  return new Date(Date.parse(isoDateTime) + 9 * 3_600_000).toISOString().slice(0, 10);
}

/** 두 날짜 사이 일수 (b − a) */
export function daysBetween(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}
