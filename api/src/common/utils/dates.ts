/** 한국 시간(KST) 기준 날짜 계산 */
const KST = 9 * 60 * 60 * 1000;

/** Date → "YYYY-MM-DD" (KST) */
export function kstDate(d: Date = new Date()): string {
  return new Date(d.getTime() + KST).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → 그날 00:00 UTC Date (DB @db.Date 비교용) */
export function dateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function addDaysIso(iso: string, days: number): string {
  const d = dateOnly(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** KST 기준 시(0~23) */
export function kstHour(d: Date = new Date()): number {
  return new Date(d.getTime() + KST).getUTCHours();
}

/** "YYYY-MM" (KST 이번 달) */
export function kstMonth(d: Date = new Date()): string {
  return kstDate(d).slice(0, 7);
}

/** "YYYY-MM" → 그 달 1일 Date */
export function monthStart(month: string): Date {
  return dateOnly(`${month}-01`);
}

export function addMonths(month: string, n: number): string {
  const d = monthStart(month);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}

/** Date(@db.Date) → "YYYY-MM-DD" */
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * '지난달 같은 날까지' 비교의 끝(미포함) — 진행 중인 이번 달을 지난달 전체와 비교하지 않도록.
 * 이번 달(KST)이면 지난달의 오늘과 같은 날 다음 날, 지난 달을 볼 때는 그 달 1일(= 지난달 전체).
 */
export function prevToDateEnd(month: string, today = kstDate()): Date {
  const prev = addMonths(month, -1);
  if (month !== today.slice(0, 7)) return monthStart(month);
  const prevLast = new Date(Date.UTC(Number(prev.slice(0, 4)), Number(prev.slice(5, 7)), 0)).getUTCDate();
  const day = Math.min(Number(today.slice(8, 10)), prevLast);
  return dateOnly(addDaysIso(`${prev}-${String(day).padStart(2, '0')}`, 1));
}
