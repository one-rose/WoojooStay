/**
 * 홈(브랜드 랜딩) 화면의 콘텐츠 모델.
 *
 * 화면에 보이는 문구·수치는 전부 이 타입을 따르는 데이터로 관리한다.
 * - 문구 수정 → infrastructure/home/home-content.ko.ts 만 고친다.
 * - 나중에 CMS·API로 옮길 때도 이 타입은 그대로 두고 저장소 구현만 바꾼다.
 *
 * 줄바꿈이 의미 있는 문구는 `Lines`(문자열 배열)로 둔다. 각 원소가 한 줄이다.
 */

export type Lines = readonly string[];

/** 예약 플랫폼 (4대 플랫폼) */
export type PlatformId = "yanolja" | "yeogi" | "naver" | "agoda";
/** 예약 채널 — 플랫폼 + 기타 판매 채널 */
export type ChannelId = PlatformId | "kkulstay" | "bear" | "airbnb" | "other";

/** 시안별로 색조가 바뀌는 3D 일러스트 */
export type IllustrationId =
  | "chat"
  | "ledger"
  | "wallet"
  | "people"
  | "receipt"
  | "robot"
  | "mock-ledger"
  | "mock-finance"
  | "mock-ops"
  | "join"
  | "data"
  | "finance"
  | "ops"
  | "revisit";

/** 로드맵 카드 아이콘. "brand" 는 로고의 O 마크 */
export type RoadmapIconId = "brand" | "book" | "wallet" | "people" | "receipt";

export interface Link {
  label: string;
  href: string;
}

/** 원 단위 금액 */
export type Won = number;

/* ───────── 헤더 · 푸터 ───────── */

export interface SiteHeaderContent {
  nav: readonly Link[];
  cta: Link;
}

export interface SiteFooterContent {
  descriptor: string;
  cta: Link;
  slogan: string;
  keywords: readonly string[];
  copyright: string;
}

/* ───────── 히어로 ───────── */

export interface OrbitItem {
  illustration: IllustrationId;
  title: string;
  caption: string;
}

export interface HeroKpi {
  label: string;
  value: { amount: Won } | { count: number; unit: string };
  note: string;
  /** 보조 문구 강조 정도 */
  noteTone: "strong" | "soft";
}

export interface HeroContent {
  badge: string;
  title: Lines;
  lead: Lines;
  primaryCta: Link;
  secondaryCta: Link;
  orbit: readonly OrbitItem[];
  dashboard: {
    brand: string;
    liveLabel: string;
    kpis: readonly HeroKpi[];
    channelChart: {
      title: string;
      /** value 는 상대 크기(최댓값 대비 막대 높이) */
      channels: readonly { channel: ChannelId; value: number }[];
    };
    aiReview: {
      title: string;
      quote: Lines;
      replyLabel: string;
      reply: Lines;
      action: string;
    };
    currentStep: { eyebrow: string; title: string };
    nextStep: { eyebrow: string; title: string };
  };
}

export interface PlatformStripContent {
  lead: { before: string; emphasis: string; after: string };
  platforms: readonly PlatformId[];
}

/* ───────── 서비스 섹션 공통 ───────── */

export interface SectionIntro {
  eyebrow: string;
  title: Lines;
  description: Lines;
  illustration?: IllustrationId;
}

/* SERVICE 01 */
export interface Review {
  platform: PlatformId;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  aiNote: string;
}

export interface AiReviewContent {
  intro: SectionIntro;
  features: readonly { title: string; description: string }[];
  panel: {
    title: string;
    status: string;
    tabs: readonly { label: string; count: number; active?: boolean }[];
    reviews: readonly Review[];
  };
  callout: {
    eyebrow: string;
    /** 화살표(→)로 이어지는 문장 조각 */
    flow: readonly string[];
    mascotAlt: string;
  };
}

/* SERVICE 02 */
export interface LedgerContent {
  intro: SectionIntro;
  dashboard: {
    title: string;
    period: string;
    kpis: readonly { label: string; amount: Won; note: string }[];
    trendTitle: string;
    settlement: { label: string; amount: Won; note: string };
    adEfficiency: { label: string; caption: string; ratio: number };
  };
  bridge: string;
}

/* SERVICE 03 */
export interface FinanceProduct {
  name: string;
  description: Lines;
  metricLabel: string;
  amount: Won;
}

export interface FinanceContent {
  intro: SectionIntro;
  brandPrefix: string;
  products: readonly FinanceProduct[];
  flowCaption: string;
  flow: readonly string[];
  orbitBand: { label: string; flow: readonly string[]; tagline: string };
}

/* SERVICE 04 */
export interface OperationsContent {
  intro: SectionIntro;
  brandPrefix: string;
  staffing: {
    name: string;
    description: Lines;
    panelTitle: string;
    staff: readonly { name: string; role: string; hours: number; pay: Won }[];
  };
  expenses: {
    name: string;
    description: Lines;
    panelTitle: string;
    items: readonly { label: string; amount: Won }[];
  };
}

/* 로드맵 */
export interface RoadmapStep {
  badge?: "NOW" | "NEXT";
  name: string;
  tags: readonly [string, string];
  icon: RoadmapIconId;
}

export interface RoadmapContent {
  eyebrow: string;
  title: string;
  description: Lines;
  brandPrefix: string;
  steps: readonly RoadmapStep[];
  growth: {
    label: string;
    flow: readonly string[];
    nodes: readonly { illustration: IllustrationId; label: string }[];
  };
}

/* 핵심 가치 */
export interface ValuesContent {
  eyebrow: string;
  title: Lines;
  description: Lines;
  items: readonly { title: string; description: Lines }[];
  band: { eyebrow: string; message: string };
}

/* ───────── 홈 전체 ───────── */

export interface HomeContent {
  meta: { title: string; description: string };
  header: SiteHeaderContent;
  hero: HeroContent;
  platformStrip: PlatformStripContent;
  aiReview: AiReviewContent;
  ledger: LedgerContent;
  finance: FinanceContent;
  operations: OperationsContent;
  roadmap: RoadmapContent;
  values: ValuesContent;
  footer: SiteFooterContent;
}
