import type { IconName } from "../components";

export interface NavItem {
  label: string;
  icon: IconName;
  /** 없으면 아직 만들지 않은 메뉴 (비활성 표시) */
  href?: string;
  /** 이 경로로 시작하면 선택된 것으로 본다 (기본: href) */
  match?: string;
  /** 메뉴 옆 작은 표시 — 아직 열리지 않은 서비스("준비 중") */
  stage?: string;
  /** "reviews" 면 지금 업장 미답변 수, "inbox" 면 업장 전부의 미답변 수를 배지로 */
  counter?: "reviews" | "inbox";
  /** 하위 경로에서는 선택되지 않음 (전체 현황 vs 통합 리뷰함) */
  exact?: boolean;
}

export interface NavGroup {
  label: string;
  items: readonly NavItem[];
}

/** 업장이 2곳 이상일 때만 메뉴 맨 위에 (F8) */
export const NAV_OVERVIEW: NavItem = { label: "전체 현황", icon: "grid", href: "/app/overview", exact: true };
/** 업장 전부의 리뷰를 한 목록에서 (F8) — 업장이 2곳 이상일 때만 */
export const NAV_INBOX: NavItem = {
  label: "통합 리뷰함",
  icon: "inbox",
  href: "/app/overview/reviews",
  counter: "inbox",
};

/** 업장끼리 한 달 매출·별점 비교 (F8) — 업장이 2곳 이상일 때만 */
export const NAV_REPORT: NavItem = { label: "업장 비교", icon: "compare", href: "/app/overview/report" };

/** 업장별 매니저 권한 (F8) — 업장이 2곳 이상일 때만 */
export const NAV_PEOPLE: NavItem = { label: "직원·권한", icon: "shield", href: "/app/overview/people" };

/** 메뉴 구성 — 기능정의서 서비스 순서 */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "운영",
    items: [
      { label: "홈", icon: "home", href: "/app" },
      { label: "리뷰 관리", icon: "review", href: "/app/reviews", counter: "reviews" },
      { label: "현장 업무", icon: "door", href: "/app/ops" },
      { label: "요금·재고", icon: "rates", href: "/app/rates" },
    ],
  },
  {
    label: "경영",
    items: [
      { label: "디지털매출장부", icon: "ledger", href: "/app/ledger" },
      { label: "매출선정산", icon: "settle", href: "/app/finance/settle", stage: "준비 중" },
      { label: "미래매출선지급", icon: "advance", href: "/app/finance/advance", stage: "준비 중" },
      { label: "알바관리", icon: "staff", href: "/app/staff" },
      { label: "지출관리", icon: "expense", href: "/app/expenses" },
    ],
  },
];

export const NAV_FOOTER: readonly NavItem[] = [
  { label: "채널 연동", icon: "link", href: "/app/settings/channels" },
  { label: "설정", icon: "settings", href: "/app/settings/property", match: "/app/settings" },
];
