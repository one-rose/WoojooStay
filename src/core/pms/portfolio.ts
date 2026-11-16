import type { PropertyType } from "./pms";

/**
 * 여러 업장 통합 현황 (F8) — 업장을 여러 곳 운영하는 사장님이 로그인하면 먼저 보는 화면.
 * 숫자는 업장마다 API 의 집계 한 번으로 받는다 (GET /portfolio).
 */

/** 확인할 일 종류 — 급한 순서는 PORTFOLIO_ALERT_RANK */
export type PortfolioAlertKind =
  | "channel-auth"
  | "channel-error"
  | "payment-failed"
  | "low-rated"
  | "stale-dirty"
  | "missing-clock-out"
  | "no-channel";

/** 채널 끊김 > 결제 실패 > 저평점 미답변 > 청소 지연 > 퇴근 누락 > 채널 없음 */
export const PORTFOLIO_ALERT_RANK: Record<PortfolioAlertKind, number> = {
  "channel-auth": 0,
  "channel-error": 0,
  "payment-failed": 1,
  "low-rated": 2,
  "stale-dirty": 3,
  "missing-clock-out": 4,
  "no-channel": 5,
};

export interface PortfolioAlert {
  kind: PortfolioAlertKind;
  message: string;
  /** 그 업장 안 화면 경로 ("/app/reviews" 등) — 업장을 바꾼 뒤 연다 */
  link: string;
}

export type PortfolioRole = "owner" | "manager";
export type BillingState = "trial" | "active" | "past_due" | "cancelled";

export interface PortfolioProperty {
  id: string;
  name: string;
  type: PropertyType;
  rooms: number;
  role: PortfolioRole;
  today: { sales: number; bookings: number; yesterdaySales: number };
  /** 이번 달 1일 ~ 오늘 · 지난달 같은 날까지 */
  month: { sales: number; prevToDate: number };
  reviews: { unanswered: number; lowRated: number };
  /** 7일 안 정산 예정 */
  settle7: number;
  roomStatus: {
    ready: number;
    dirty: number;
    cleaning: number;
    inspect: number;
    occupied: number;
    outOfOrder: number;
    /** 청소 필요로 2시간 넘게 */
    staleDirty: number;
  };
  staff: { onDuty: number; missingClockOut: number };
  channels: { connected: number; error: number; authExpired: number };
  /** 사장님인 업장만 (매니저면 null) */
  billing: BillingState | null;
  /** 급한 순 */
  alerts: readonly PortfolioAlert[];
}

export interface PortfolioTotals {
  properties: number;
  needsAttention: number;
  today: { sales: number; bookings: number; yesterdaySales: number };
  month: { sales: number; prevToDate: number };
  reviews: { unanswered: number; lowRated: number };
  settle7: number;
}

export interface PortfolioData {
  /** "YYYY-MM-DD" (한국 날짜) */
  date: string;
  properties: readonly PortfolioProperty[];
  totals: PortfolioTotals;
}

/** 업장 전환 목록 한 줄 */
export interface PropertyOption {
  id: string;
  name: string;
  type: PropertyType;
  rooms: number;
  /** 연동 끊김·결제 실패처럼 바로 손봐야 하는 문제가 있음 (빨간 점) */
  urgent?: boolean;
}

/** 빨간 점을 찍을 만큼 급한 일 — 채널 끊김 · 결제 실패 */
export function hasUrgentAlert(p: Pick<PortfolioProperty, "alerts">): boolean {
  return p.alerts.some((a) => PORTFOLIO_ALERT_RANK[a.kind] <= 1);
}

/** 가장 급한 일의 순위 (없으면 Infinity) */
export function topAlertRank(p: Pick<PortfolioProperty, "alerts">): number {
  return p.alerts.reduce((min, a) => Math.min(min, PORTFOLIO_ALERT_RANK[a.kind]), Infinity);
}

/** 업장 전환 동작 — 업장을 바꾸고 next(그 업장 안 경로)로 이동. 실패하면 메시지 */
export type SwitchPropertyAction = (propertyId: string, next: string) => Promise<{ ok: false; message: string } | void>;
