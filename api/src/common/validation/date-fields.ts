import { ValidateBy, type ValidationOptions } from 'class-validator';
import { kstDate } from '../utils/dates.js';

/** 월 범위 1990 ~ 2100 — 그 밖은 오타로 본다 */
const MIN_YEAR = 1990;
const MAX_YEAR = 2100;

/** 'YYYY-MM-DD' 이고 실제 달력에 있는 날 (2026-02-31·2026-13-45 거절) */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (y < MIN_YEAR || y > MAX_YEAR || m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 'YYYY-MM' 이고 01~12월 */
export function isMonth(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  const y = Number(value.slice(0, 4));
  return y >= MIN_YEAR && y <= MAX_YEAR;
}

export function IsCalendarDate(options?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isCalendarDate',
      validator: { validate: isCalendarDate, defaultMessage: () => '날짜는 YYYY-MM-DD 형식의 실제 날짜여야 해요.' },
    },
    options,
  );
}

export function IsMonth(options?: ValidationOptions) {
  return ValidateBy(
    { name: 'isMonth', validator: { validate: isMonth, defaultMessage: () => '월은 YYYY-MM 형식이에요.' } },
    options,
  );
}

/** 오늘(한국 시간)보다 뒤의 날짜는 거절 — 'YYYY-MM-DD' 끼리 비교 */
export function IsNotFutureDate(options?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isNotFutureDate',
      validator: {
        validate: (value: unknown) => typeof value !== 'string' || value <= kstDate(),
        defaultMessage: () => '오늘 이후 날짜는 넣을 수 없어요.',
      },
    },
    options,
  );
}
