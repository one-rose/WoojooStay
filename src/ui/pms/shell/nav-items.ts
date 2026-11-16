import type { IconName } from "../components";

export interface NavItem {
  label: string;
  icon: IconName;
  /** 없으면 아직 만들지 않은 메뉴 (비활성 표시) */
  href?: string;
  /** 이 경로로 시작하면 선택된 것으로 본다 (기본: href) */
  match?: string;
  /** 로드맵 단계 표시 — 랜딩 ROADMAP 과 같은 이름 */
  stage?: string;
  /** "reviews" 면 미답변 수를 배지로 */
  counter?: "reviews";
}

export interface NavGroup {
  label: string;
  items: readonly NavItem[];
}

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
      { label: "매출선정산", icon: "settle", stage: "3단계" },
      { label: "미래매출선지급", icon: "advance", stage: "4단계" },
      { label: "알바관리", icon: "staff", href: "/app/staff" },
      { label: "지출관리", icon: "expense", href: "/app/expenses" },
    ],
  },
];

export const NAV_FOOTER: readonly NavItem[] = [
  { label: "채널 연동", icon: "link", href: "/app/settings/channels" },
  { label: "설정", icon: "settings", href: "/app/settings/property", match: "/app/settings" },
];
