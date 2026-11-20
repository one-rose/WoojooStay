import type { ChannelId } from "./pms";

/**
 * 금융 미리보기 (WOOJOO ORBIT, 2단계 — IBK기업은행 협력 준비 중).
 * 신청·돈 이동은 없다. 실제 정산 예정 금액으로 "선정산을 쓰면 오늘 받을 수 있는 금액"을 예시로 보여 준다.
 */

/** 사업소개서 가정 — 선정산 수수료 하루 0.03% ~ 0.045% (실제 수수료는 심사로 정해짐) */
export const ADVANCE_FEE_DAILY = { min: 0.0003, max: 0.00045 } as const;

export type FinanceKind = "settle" | "advance";

export interface FinanceSettlement {
  /** 정산 예정일 YYYY-MM-DD */
  date: string;
  channel: ChannelId;
  channelName: string;
  amount: number;
}

export interface FinancePreviewData {
  /** 기준일 YYYY-MM-DD */
  date: string;
  propertyName: string;
  /** 아직 들어오지 않은 정산 — 오늘부터 30일 안, 날짜순 */
  settlements: readonly FinanceSettlement[];
  /** 이번 달 남은 입실 예정 매출 (내일 ~ 말일) — 실서버만 */
  upcomingSales: number | null;
  /** 최근 달 매출 (마지막이 이번 달, 진행 중) */
  trend: readonly { month: string; sales: number }[];
}

/** 정산 예정 한 건을 오늘 미리 받을 때 — 남은 날 × 하루 수수료 */
export function advanceQuote(amount: number, days: number) {
  const d = Math.max(0, days);
  const feeMin = Math.round(amount * ADVANCE_FEE_DAILY.min * d);
  const feeMax = Math.round(amount * ADVANCE_FEE_DAILY.max * d);
  return { days: d, feeMin, feeMax, getMin: amount - feeMax, getMax: amount - feeMin };
}

/** 정산 예정 합계 — within 일 안 (오늘 포함) */
export function settleWithin(list: readonly FinanceSettlement[], today: string, within: number): number {
  const end = Date.parse(`${today}T00:00:00Z`) + within * 86_400_000;
  return list.filter((s) => Date.parse(`${s.date}T00:00:00Z`) <= end).reduce((sum, s) => sum + s.amount, 0);
}
