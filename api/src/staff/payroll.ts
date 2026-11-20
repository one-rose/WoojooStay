/**
 * 급여 계산 규칙 (F5-04) — 실제 노무 규칙은 노무사 확인 후 확정
 *
 * - 시급제: 근무시간 × 시급 + 야간(22~06시) 50% 가산 + 주휴수당
 * - 주휴수당: 한 주(월~일) 근무 15시간 이상일 때 min(8, 주 근무시간 ÷ 40 × 8)시간분.
 *   그 주는 '일요일이 속한 달'에 준다 — 달이 바뀌는 주도 두 번 주거나 빠뜨리지 않는다.
 *   그래서 근무 기록은 달의 첫 주 월요일 ~ 마지막 주 일요일까지 넘겨야 한다 (monthWeekRange).
 * - 월급제: 그 달 재직일 비율로 (입사·퇴사한 달은 일할), 그 달 이후 입사자는 급여 없음
 */

/** 연도별 최저시급 (고시 기준) — 표에 없는 해는 가장 가까운 앞 해(없으면 가장 이른 해) 값 */
export const MINIMUM_WAGE_BY_YEAR: Readonly<Record<number, number>> = { 2024: 9_860, 2025: 10_030, 2026: 10_320 };
/** 월급제 최저임금 환산 기준 — 주 40시간 + 주휴 8시간 기준 월 소정근로시간 */
export const MONTHLY_STANDARD_HOURS = 209;
const KST = 9 * 3_600_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
/** 주휴수당 대상 최소 주 근무시간 */
export const WEEKLY_HOLIDAY_MIN_HOURS = 15;

/** 그 해(또는 'YYYY-MM' 의 해) 최저시급 */
export function minimumWageFor(when: number | string): number {
  const year = typeof when === 'number' ? when : Number(when.slice(0, 4));
  const years = Object.keys(MINIMUM_WAGE_BY_YEAR)
    .map(Number)
    .sort((a, b) => a - b);
  const y = [...years].reverse().find((k) => k <= year) ?? years[0];
  return MINIMUM_WAGE_BY_YEAR[y];
}

/** 올해 최저시급 (한국 시간 기준) */
export function currentMinimumWage(now = new Date()): number {
  return minimumWageFor(new Date(now.getTime() + KST).getUTCFullYear());
}

export interface Shift {
  workDate: string;
  clockInAt: Date;
  clockOutAt: Date | null;
}

/**
 * 최저시급보다 적은지 — month('YYYY-MM') 의 해 기준 (없으면 올해).
 * 시급제는 시급, 월급제는 월급 ÷ 209시간으로 본다.
 */
export function isBelowMinimumWage(pay: { payType: 'HOURLY' | 'MONTHLY'; payAmount: number }, month?: string): boolean {
  const minimum = month ? minimumWageFor(month) : currentMinimumWage();
  const hourly = pay.payType === 'HOURLY' ? pay.payAmount : pay.payAmount / MONTHLY_STANDARD_HOURS;
  return hourly < minimum;
}

/** 22:00 ~ 06:00 (KST) 와 겹치는 시간 */
export function nightMs(from: Date, to: Date): number {
  let total = 0;
  // 출근 전날 22시부터 퇴근일까지 하루씩 야간 구간을 본다
  const start = new Date(from.getTime() + KST);
  start.setUTCHours(0, 0, 0, 0);
  for (let day = start.getTime() - DAY; day < to.getTime() + KST; day += DAY) {
    const nightFrom = day + 22 * HOUR - KST;
    const nightTo = day + 30 * HOUR - KST;
    total += Math.max(0, Math.min(to.getTime(), nightTo) - Math.max(from.getTime(), nightFrom));
  }
  return total;
}

const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** 그 날이 속한 주(월~일)의 월요일 */
export function weekMonday(iso: string): string {
  const dow = (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(iso, -dow);
}

/** 'YYYY-MM' 의 첫날·마지막 날 */
function monthBounds(month: string) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { first: `${month}-01`, last: `${month}-${String(last).padStart(2, '0')}`, days: last };
}

/** 급여 계산에 필요한 출퇴근 조회 범위 — 그 달 첫 주 월요일 ~ 마지막 주 일요일 */
export function monthWeekRange(month: string): { from: string; to: string } {
  const { first, last } = monthBounds(month);
  return { from: weekMonday(first), to: addDays(weekMonday(last), 6) };
}

/** 주휴 시간 — 주 15시간 미만이면 0, 이상이면 주 근무시간 비례 (최대 8시간) */
export function weeklyHolidayHours(weekHours: number): number {
  if (weekHours < WEEKLY_HOLIDAY_MIN_HOURS) return 0;
  return Math.min(8, (weekHours / 40) * 8);
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const shiftMs = (s: Shift) => (s.clockOutAt ? s.clockOutAt.getTime() - s.clockInAt.getTime() : 0);

/** 근무시간 · 야간시간 (퇴근 기록이 있는 것만) */
export function sumHours(shifts: readonly Shift[]) {
  const done = shifts.filter((s) => s.clockOutAt);
  const ms = done.reduce((s, x) => s + shiftMs(x), 0);
  const night = done.reduce((s, x) => s + nightMs(x.clockInAt, x.clockOutAt!), 0);
  return { hours: round1(ms / HOUR), nightHours: round1(night / HOUR) };
}

/**
 * 그 달에 줄 주휴 — 일요일이 그 달에 있는 주만, 주 전체(앞뒤 달 포함) 근무시간으로 계산.
 * shifts 는 monthWeekRange(month) 범위를 넘겨야 정확하다.
 */
export function weeklyHolidayWeeks(month: string, shifts: readonly Shift[]) {
  const weeks = new Map<string, number>();
  for (const s of shifts) {
    if (!s.clockOutAt) continue;
    const k = weekMonday(s.workDate);
    weeks.set(k, (weeks.get(k) ?? 0) + shiftMs(s) / HOUR);
  }
  return [...weeks]
    .filter(([monday]) => addDays(monday, 6).startsWith(month))
    .map(([monday, hours]) => ({ monday, hours: round1(hours), holidayHours: weeklyHolidayHours(hours) }))
    .sort((a, b) => a.monday.localeCompare(b.monday));
}

/** 월급제 일할 — 그 달 재직일 / 그 달 일수 (재직일이 없으면 0) */
export function employedDays(month: string, hiredDate: string, resignedDate: string | null): number {
  const { first, last } = monthBounds(month);
  const from = hiredDate > first ? hiredDate : first;
  const to = resignedDate && resignedDate < last ? resignedDate : last;
  if (from > to) return 0;
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY) + 1;
}

export interface PayInput {
  month: string;
  payType: 'HOURLY' | 'MONTHLY';
  payAmount: number;
  hiredDate: string;
  resignedDate: string | null;
  /** monthWeekRange(month) 범위의 출퇴근 */
  shifts: readonly Shift[];
}

/** 한 직원의 한 달 급여 */
export function computeMonthlyPay(input: PayInput) {
  const inMonth = input.shifts.filter((s) => s.workDate.startsWith(input.month));
  const h = sumHours(inMonth);
  if (input.payType === 'MONTHLY') {
    const days = employedDays(input.month, input.hiredDate, input.resignedDate);
    const base = Math.round((input.payAmount * days) / monthBounds(input.month).days);
    return { ...h, base, night: 0, weekly: 0, total: base, weeksFull: 0 };
  }
  const weeks = weeklyHolidayWeeks(input.month, input.shifts);
  const base = Math.round(h.hours * input.payAmount);
  const night = Math.round(h.nightHours * input.payAmount * 0.5);
  const weekly = Math.round(weeks.reduce((s, w) => s + w.holidayHours, 0) * input.payAmount);
  return {
    ...h,
    base,
    night,
    weekly,
    total: base + night + weekly,
    /** 주휴수당을 받는 주 수 */
    weeksFull: weeks.filter((w) => w.holidayHours > 0).length,
  };
}
