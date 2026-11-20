import type { ActionResult, ChannelConnection, ChannelId, GuestReview, PropertyType } from "./pms";

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
  | "no-staff"
  | "stale-dirty"
  | "missing-clock-out"
  | "no-channel";

/** 채널 끊김 > 결제 실패 > 저평점 미답변 > 근무자 없음 · 청소 지연 > 퇴근 누락 > 채널 없음 */
export const PORTFOLIO_ALERT_RANK: Record<PortfolioAlertKind, number> = {
  "channel-auth": 0,
  "channel-error": 0,
  "payment-failed": 1,
  "low-rated": 2,
  "no-staff": 3,
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

/** 이번 달(리포트는 고른 달) 지출 · 인건비 — 급여는 확정 합, 확정 전이면 계산 중 합 */
export interface MonthCosts {
  expenses: number;
  payroll: number;
  /** CONFIRMED: 확정(발송 포함) · DRAFT: 계산 중 · null: 급여 없음 */
  payrollStatus: "CONFIRMED" | "DRAFT" | null;
  /** (지출 + 인건비) ÷ 매출 — 0.412 = 41.2%, 매출 0 이면 null */
  costRatio: number | null;
}

/** 전체 현황 매출 기간 (입실일 기준) — GET /portfolio?period= */
export type PortfolioPeriod = "today" | "yesterday" | "week";

export const PORTFOLIO_PERIODS: readonly { key: PortfolioPeriod; label: string; prev: string }[] = [
  { key: "today", label: "오늘", prev: "어제보다" },
  { key: "yesterday", label: "어제", prev: "그제보다" },
  { key: "week", label: "이번 주", prev: "지난주 같은 날까지보다" },
];

export function isPortfolioPeriod(v: unknown): v is PortfolioPeriod {
  return PORTFOLIO_PERIODS.some((p) => p.key === v);
}

/** 기간 매출 — API 가 period 를 주지 않으면(예전 서버) 오늘 · 어제만 today 에서 */
export function periodSales(
  p: Pick<PortfolioProperty, "today" | "period">,
  key: PortfolioPeriod,
): { sales: number; bookings: number; prevSales: number | null } {
  if (p.period) return p.period;
  if (key === "yesterday") return { sales: p.today.yesterdaySales, bookings: 0, prevSales: null };
  return { sales: p.today.sales, bookings: p.today.bookings, prevSales: p.today.yesterdaySales };
}
export type BillingState = "trial" | "active" | "past_due" | "cancelled";

export interface PortfolioProperty {
  id: string;
  name: string;
  type: PropertyType;
  rooms: number;
  role: PortfolioRole;
  today: { sales: number; bookings: number; yesterdaySales: number };
  /** 고른 기간(?period=) 매출 · 예약 수 · 앞 기간 매출 — 입실일 기준 */
  period?: { sales: number; bookings: number; prevSales: number };
  /** 이번 달 1일 ~ 오늘 · 지난달 같은 날까지 */
  month: { sales: number; prevToDate: number };
  /** 이번 달 지출 · 인건비 (기간과 상관없이 이번 달) */
  costs?: MonthCosts;
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
  /** scheduledNow: 근무표상 지금 일할 시간인 사람 수 */
  staff: { onDuty: number; missingClockOut: number; scheduledNow?: number };
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
  period?: { sales: number; bookings: number; prevSales: number };
  month: { sales: number; prevToDate: number };
  costs?: MonthCosts;
  reviews: { unanswered: number; lowRated: number };
  settle7: number;
}

export interface PortfolioData {
  /** "YYYY-MM-DD" (한국 날짜) */
  date: string;
  /** 고른 매출 기간 — from ~ to (입실일) */
  period?: { key: PortfolioPeriod; from: string; to: string };
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
  /** 이 업장에서 내 권한 — 사장님인 업장이 하나라도 있어야 '직원·권한' 메뉴가 보인다 */
  role?: "owner" | "manager";
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

/** 통합 리뷰함 (F8) — 내 업장 전부의 미답변 리뷰(전부)와 최근 7일 답글 단 리뷰 */
export interface ReviewInbox {
  properties: readonly { id: string; name: string }[];
  /** 리뷰에 나오는 채널 (이름 · 게시 방식) */
  channels: readonly ChannelConnection[];
  /** propertyId 가 붙은 리뷰 */
  reviews: readonly GuestReview[];
  /** 미답변이 너무 많아 오래된 것이 잘림 */
  truncated: boolean;
}

/** 업장 비교 리포트 (F8) — 한 달 동안 업장마다 같은 기준으로 */
export interface PortfolioReportProperty {
  id: string;
  name: string;
  type: PropertyType;
  rooms: number;
  role: "owner" | "manager";
  /** 확정 예약 매출 (입실일 기준) */
  sales: number;
  /** 지난달 (이번 달이면 지난달 같은 날까지) */
  prevSales: number;
  bookings: number;
  commission: number;
  /** 객실 하나가 하루에 번 매출 (매출 ÷ 객실 수 ÷ 날 수) */
  perRoomDay: number;
  /** 매출 많은 순 */
  channels: readonly { channel: ChannelId; name: string; sales: number }[];
  /** answered: 우리 서비스로 단 답글 · replyBase: 답글률 분모 (채널에 이미 답글이 있던 리뷰 제외, 없으면 count) */
  reviews: { count: number; avgRating: number | null; answered: number; replyBase?: number };
  /** 그 달 지출 · 인건비 */
  costs?: MonthCosts;
  /** months 와 같은 순서의 월 매출 */
  trend: readonly number[];
}

export interface PortfolioReport {
  /** "YYYY-MM" */
  month: string;
  /** 진행 중인 이번 달 (오늘까지) */
  partial: boolean;
  /** 이 달에서 센 날 수 */
  days: number;
  /** 추이 6개월 — 마지막이 month */
  months: readonly string[];
  properties: readonly PortfolioReportProperty[];
}

/** 리포트 합계 — 객실 하루 매출은 전체 객실 기준, 별점은 리뷰 수로 가중 */
export function reportTotals(r: PortfolioReport) {
  const sum = (f: (p: PortfolioReportProperty) => number) => r.properties.reduce((s, p) => s + f(p), 0);
  const rooms = sum((p) => p.rooms);
  const sales = sum((p) => p.sales);
  const reviewCount = sum((p) => p.reviews.count);
  const ratingSum = sum((p) => (p.reviews.avgRating ?? 0) * p.reviews.count);
  return {
    sales,
    prevSales: sum((p) => p.prevSales),
    bookings: sum((p) => p.bookings),
    commission: sum((p) => p.commission),
    rooms,
    perRoomDay: rooms > 0 && r.days > 0 ? Math.round(sales / (rooms * r.days)) : 0,
    reviews: {
      count: reviewCount,
      avgRating: reviewCount ? Math.round((ratingSum / reviewCount) * 10) / 10 : null,
      answered: sum((p) => p.reviews.answered),
      replyBase: sum((p) => p.reviews.replyBase ?? p.reviews.count),
    },
    costs: sum((p) => (p.costs ? p.costs.expenses + p.costs.payroll : 0)),
    trend: r.months.map((_, i) => sum((p) => p.trend[i] ?? 0)),
  };
}

/** 업장별 매니저 권한 (F8) — 사장님인 업장 전부의 사람과 권한 */
export type PeopleRole = "owner" | "manager" | "staff";

export interface PortfolioPeople {
  /** 내가 사장님인 업장 */
  properties: readonly { id: string; name: string }[];
  people: readonly {
    userId: string;
    name: string;
    /** 사장님에게는 전체 번호(010-1234-5678), 그 밖은 가린 번호 (010-****-1234) */
    phone: string;
    /** 업장 ID → 권한 (없으면 그 업장 사람 아님) */
    roles: Readonly<Record<string, PeopleRole>>;
  }[];
  /** 대기 중인 초대 — 번호 · 권한별로 묶음 */
  invitations: readonly {
    phone: string;
    role: "manager" | "staff";
    propertyIds: readonly string[];
    /** 실서버: 업장별 초대 id (propertyIds 와 같은 순서) — 취소·다시 보내기 */
    invitationIds?: readonly string[];
    expiresAt: string;
  }[];
}

export interface PeopleActions {
  /** role null: 그 업장에서 빼기 */
  assign: (
    userId: string,
    assignments: { propertyId: string; role: "manager" | "staff" | null }[],
  ) => Promise<ActionResult<PortfolioPeople>>;
  invite: (
    phone: string,
    role: "manager" | "staff",
    propertyIds: string[],
  ) => Promise<ActionResult<{ invited: string[]; skipped: string[] }>>;
  /** 대기 중인 초대 취소 · 다시 보내기 — 업장별 초대 id */
  cancelInvite?: (invitationId: string, propertyId: string) => Promise<ActionResult>;
  resendInvite?: (invitationId: string, propertyId: string) => Promise<ActionResult>;
}
