import { cache } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import {
  hasUrgentAlert,
  type NotificationItem,
  type PortfolioData,
  type PortfolioPeople,
  type PortfolioReport,
  type PropertyOption,
  type ReviewInbox,
} from "@/core";
import {
  ApiAuthError,
  DEMO_DEFAULT_PROPERTY,
  demoPortfolio,
  demoNotifications,
  demoPeople,
  demoPortfolioReport,
  demoPropertyOptions,
  demoReviewInbox,
  isLiveApi,
  pmsRepository,
  toNotification,
  toPortfolio,
  toPortfolioPeople,
  toPortfolioReport,
  toReviewInbox,
  toPropertyType,
} from "@/infrastructure";
import { COOKIE, loadMe, readSession, redirectToRefresh, requireSession, serverApi } from "./session";

/** 여러 업장 통합 현황 — 체험 모드는 예시 10곳. 한 요청 안에서는 한 번만 부른다 */
export const loadPortfolio = cache(async (): Promise<PortfolioData> => {
  if (!isLiveApi) {
    await connection();
    return demoPortfolio();
  }
  const s = await requireSession();
  try {
    return toPortfolio(await (await serverApi(s.accessToken)).portfolio());
  } catch (e) {
    if (e instanceof ApiAuthError) await redirectToRefresh({ stale: true });
    throw e;
  }
});

/** 직원·권한 — 내가 사장님인 업장 전부 */
export async function loadPeople(): Promise<PortfolioPeople> {
  if (!isLiveApi) {
    await connection();
    return demoPeople();
  }
  const s = await requireSession();
  try {
    return toPortfolioPeople(await (await serverApi(s.accessToken)).portfolioPeople());
  } catch (e) {
    if (e instanceof ApiAuthError) await redirectToRefresh({ stale: true });
    throw e;
  }
}

/** 업장 비교 리포트 — month 가 없으면 이번 달 (오늘까지) */
export async function loadPortfolioReport(month?: string): Promise<PortfolioReport> {
  if (!isLiveApi) {
    await connection();
    return demoPortfolioReport(month);
  }
  const s = await requireSession();
  try {
    return toPortfolioReport(await (await serverApi(s.accessToken)).portfolioReport(month));
  } catch (e) {
    if (e instanceof ApiAuthError) await redirectToRefresh({ stale: true });
    throw e;
  }
}

/** 통합 리뷰함 — 체험 모드는 예시 리뷰를 업장 10곳에 나눠서 */
export async function loadReviewInbox(): Promise<ReviewInbox> {
  if (!isLiveApi) {
    await connection();
    const [reviews, channels] = await Promise.all([pmsRepository.getReviews(), pmsRepository.getChannels()]);
    return demoReviewInbox(reviews, channels);
  }
  const s = await requireSession();
  try {
    return toReviewInbox(await (await serverApi(s.accessToken)).portfolioReviews());
  } catch (e) {
    if (e instanceof ApiAuthError) await redirectToRefresh({ stale: true });
    throw e;
  }
}

export interface PropertySwitcherData {
  /** 지금 고른 업장 */
  currentId: string | undefined;
  /** 사장님·매니저인 업장 (직원으로만 속한 업장 제외) */
  options: PropertyOption[];
  /** 업장 전부의 미답변 리뷰 수 (통합 리뷰함 메뉴 숫자) — 업장 1곳이면 0 */
  unanswered: number;
  /** 업장 전부의 알림 (업장 이름이 붙은 통합 알림) — 업장 1곳이거나 못 불러오면 null (그 업장 알림을 쓴다) */
  notifications: NotificationItem[] | null;
}

/**
 * 업장 전환 목록 — 업장이 2곳 이상일 때만 통합 현황을 불러 빨간 점(연동 끊김·결제 실패)을 붙인다.
 * 실패해도 화면은 그대로 (점 없이).
 */
export const loadPropertySwitcher = cache(async (): Promise<PropertySwitcherData> => {
  if (!isLiveApi) {
    return {
      currentId: (await cookies()).get(COOKIE.property)?.value ?? DEMO_DEFAULT_PROPERTY,
      options: demoPropertyOptions(),
      unanswered: demoPortfolio().totals.reviews.unanswered,
      notifications: demoNotifications(),
    };
  }
  const s = await readSession();
  if (!s.accessToken) return { currentId: s.propertyId, options: [], unanswered: 0, notifications: null };
  const me = await loadMe(s.accessToken).catch(() => null);
  const mine = (me?.properties ?? []).filter((p) => p.role !== "STAFF");
  const options: PropertyOption[] = mine.map((p) => ({
    id: p.id,
    name: p.name,
    type: toPropertyType(p.type),
    rooms: p.rooms,
    role: p.role === "OWNER" ? "owner" : "manager",
  }));
  let unanswered = 0;
  let notifications: NotificationItem[] | null = null;
  if (options.length >= 2) {
    const api = await serverApi(s.accessToken);
    const [portfolio, notices] = await Promise.all([
      loadPortfolio().catch(() => null),
      api.notifications().catch(() => null),
    ]);
    notifications = notices?.items.map(toNotification) ?? null;
    const urgent = new Set(portfolio?.properties.filter(hasUrgentAlert).map((p) => p.id));
    for (const o of options) o.urgent = urgent.has(o.id);
    unanswered = portfolio?.totals.reviews.unanswered ?? 0;
  }
  return { currentId: s.propertyId, options, unanswered, notifications };
});
