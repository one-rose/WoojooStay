import type { PmsRepository, RateGrid } from "@/core";
import { sampleCells } from "./sample-data";

/**
 * 체험 모드(서버 없이 배포) — 예시 데이터는 2026-11-10 을 "오늘" 로 만들어져 있다.
 * 보는 날짜에 맞춰 날짜를 통째로 옮겨서, 언제 열어도 오늘 기준 데이터처럼 보이게 한다.
 */
export const SAMPLE_BASE = "2026-11-10";

const DAY = 86_400_000;
const KST = 9 * 3_600_000;

const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** 한국 시간 오늘 */
export function kstToday(now = Date.now()): string {
  return ymd(now + KST);
}

/** 예시 데이터를 며칠 옮길지 — 예시의 "오늘"(11월 10일)이 실제 오늘이 되도록 */
export function demoOffsetDays(today = kstToday()): number {
  return Math.max(0, Math.round((utc(today) - utc(SAMPLE_BASE)) / DAY));
}

function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

const RE_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** "2026-11-10 00:42" (리뷰 작성 시각 등) */
const RE_DATE_TIME = /^(\d{4}-\d{2}-\d{2})( \d{2}:\d{2})$/;
const RE_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
/** "11.09 18:20" · "11.09" 같은 짧은 표기 */
const RE_SHORT = /^(\d{1,2})\.(\d{1,2})( \d{2}:\d{2})?$/;

function shiftString(v: string, days: number, months: number): string {
  if (RE_DATETIME.test(v)) {
    const t = Date.parse(v);
    return Number.isNaN(t) ? v : new Date(t + days * DAY).toISOString();
  }
  if (RE_DATE.test(v)) return ymd(utc(v) + days * DAY);
  const dt = RE_DATE_TIME.exec(v);
  if (dt) return `${ymd(utc(dt[1]) + days * DAY)}${dt[2]}`;
  if (RE_MONTH.test(v)) return shiftMonth(v, months);
  const m = RE_SHORT.exec(v);
  if (m) {
    const base = Date.UTC(Number(SAMPLE_BASE.slice(0, 4)), Number(m[1]) - 1, Number(m[2]));
    const d = new Date(base + days * DAY);
    const two = (n: number) => String(n).padStart(2, "0");
    return `${two(d.getUTCMonth() + 1)}.${two(d.getUTCDate())}${m[3] ?? ""}`;
  }
  return v;
}

/** 객체 안의 날짜 문자열을 모두 옮긴 복사본 */
export function shiftDates<T>(value: T, days = demoOffsetDays()): T {
  if (days === 0) return value;
  const base = SAMPLE_BASE.slice(0, 7);
  const months =
    (Number(ymd(utc(SAMPLE_BASE) + days * DAY).slice(0, 4)) - Number(base.slice(0, 4))) * 12 +
    (Number(ymd(utc(SAMPLE_BASE) + days * DAY).slice(5, 7)) - Number(base.slice(5, 7)));
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return shiftString(v, days, months);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) out[shiftString(k, days, months)] = walk(x);
      return out;
    }
    return v;
  };
  return walk(value) as T;
}

/** 예시 저장소를 감싸 날짜를 오늘 기준으로 옮겨 돌려준다 */
export function demoRepository(inner: PmsRepository): PmsRepository {
  return new Proxy(inner, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (typeof value !== "function") return value;
      return async (...args: unknown[]) => {
        const out = shiftDates(await value.apply(target, args));
        // 요금표는 주말 요금이 요일을 따라가야 해서, 옮긴 시작일로 다시 만든다
        if (key === "getRateGrid") {
          const grid = out as RateGrid;
          return { ...grid, cells: sampleCells(grid.startDate) };
        }
        return out;
      };
    },
  });
}
