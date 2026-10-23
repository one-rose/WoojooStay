/**
 * 홈 화면 콘텐츠 모델.
 * 문구·숫자는 전부 여기 정의된 모양으로 언어별 파일(infrastructure/home/content/*.ts)에 들어간다.
 * 화면(ui)은 이 타입만 알고, 데이터가 어디서 오는지는 모른다.
 */

/* ───────── 공통 ───────── */

/** 줄바꿈 단위로 나눈 문장. 화면에서 <br> 로 이어 붙인다. */
export type Lines = readonly string[];

/** 원 단위 금액 */
export type Won = number;

export interface Link {
  label: string;
  href: string;
}

/** 연동 숙박 예약 채널 */
export type PlatformId = "yanolja" | "yeogi" | "agoda" | "naver" | "trip" | "hotels" | "onda" | "kkul" | "ddnayo";

/** 고객 리뷰 카드에 붙는 사진 */
export type ReviewPhotoId = "lobby" | "hall" | "breakfast" | "room" | "cityroom";

/** 3D 일러스트. `-notext` 는 그림 속 한글이 없는 버전(외국어 페이지용) */
type TextIllustration = "robot" | "mock-ledger" | "mock-finance" | "mock-ops";
export type IllustrationId =
  | "chat"
  | "data"
  | "finance"
  | "join"
  | "ledger"
  | "ops"
  | "people"
  | "receipt"
  | "revisit"
  | "wallet"
  | TextIllustration
  | `${TextIllustration}-notext`;

/** 로드맵 단계 아이콘 (brand = 우주스테이 오브 마크) */
export type StepIconId = "brand" | "book" | "wallet" | "people" | "receipt";

/** 숙박 유형 탭 아이콘 */
export type PropertyTypeId = "hotel" | "motel" | "pension" | "guesthouse";

/** 섹션 머리말 (이름표 + 제목 + 설명 + 오른쪽 일러스트) */
export interface SectionIntro {
  eyebrow: string;
  title: Lines;
  description: Lines;
  illustration?: IllustrationId;
}

/* ───────── 헤더 · 푸터 ───────── */

export interface SiteHeaderContent {
  navLabel: string;
  nav: readonly Link[];
  cta: Link;
}

export interface SiteFooterContent {
  descriptor: string;
  cta: Link;
  slogan: string;
  keywords: string;
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
  noteTone: "strong" | "soft";
}

export interface HeroContent {
  badge: string;
  title: Lines;
  lead: Lines;
  orbitLabel: string;
  orbit: readonly OrbitItem[];
  primaryCta: Link;
  secondaryCta: Link;
  dashboard: {
    brand: string;
    liveLabel: string;
    kpis: readonly HeroKpi[];
    channelChart: { title: string; channels: readonly { platform: PlatformId; value: number }[] };
    aiReview: { title: string; quote: Lines; replyLabel: string; reply: Lines; action: string };
    currentStep: { label: string; text: string };
    nextStep: { label: string; text: string };
  };
}

/* ───────── 플랫폼 · 신뢰 지표 ───────── */

export interface PlatformStripContent {
  /** before + <b>emphasis</b> + after (공백 포함 그대로 이어 붙임) */
  lead: { before: string; emphasis: string; after: string };
  platforms: readonly { platform: PlatformId; label: string }[];
}

export interface TrustStatsContent {
  label: string;
  items: readonly { value: number; unit: string; label: string; description: string }[];
  note: string;
}

/* ───────── SERVICE 01 · AI 고객 리뷰 ───────── */

export interface Review {
  platform: PlatformId;
  tag: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  aiNote: string;
  photos: readonly [ReviewPhotoId, ReviewPhotoId];
  morePhotos: number;
}

export interface AiReviewContent {
  eyebrow: string;
  title: string;
  description: Lines;
  features: readonly { title: string; description: string }[];
  panel: {
    title: string;
    status: string;
    tabs: readonly { label: string; active?: boolean }[];
    ratingLabel: string;
    photoAlt: string;
    reviews: readonly Review[];
  };
  callout: { eyebrow: string; flow: readonly [string, string]; robot: IllustrationId; robotAlt: string };
}

/* ───────── SERVICE 02 · 디지털매출장부 ───────── */

export interface LedgerContent {
  intro: SectionIntro;
  dashboard: {
    title: string;
    period: string;
    kpis: readonly { label: string; amount: Won; note: string }[];
    trend: { title: string; axis: readonly string[] };
    settlement: { label: string; amount: Won; note: string };
    adEfficiency: { label: string; caption: string; ratio: number };
  };
  bridge: string;
}

/* ───────── SERVICE 03 · 금융 ───────── */

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

/* ───────── SERVICE 04 · 운영 ───────── */

export interface OperationsContent {
  intro: SectionIntro;
  brandPrefix: string;
  staffing: {
    name: string;
    description: Lines;
    panelTitle: string;
    staff: readonly { initial: string; name: string; role: string; hours: number; pay: Won }[];
  };
  expenses: {
    name: string;
    description: Lines;
    panelTitle: string;
    items: readonly { label: string; amount: Won }[];
  };
}

/* ───────── 숙박 유형별 활용 ───────── */

export interface UseCasesContent {
  eyebrow: string;
  title: string;
  description: string;
  recommendLabel: string;
  cases: readonly {
    type: PropertyTypeId;
    label: string;
    headline: string;
    points: readonly string[];
    services: readonly string[];
  }[];
}

/* ───────── 로드맵 ───────── */

export interface RoadmapStep {
  badge?: string;
  name: string;
  tags: readonly [string, string];
  icon: StepIconId;
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

/* ───────── 도입 · 가치 ───────── */

export interface EasyStartContent {
  eyebrow: string;
  title: string;
  steps: readonly { title: string; description: string }[];
  primaryCta: Link;
  secondaryCta: Link;
}

export interface ValuesContent {
  eyebrow: string;
  title: Lines;
  description: Lines;
  items: readonly { title: string; description: Lines }[];
  band: { eyebrow: string; message: string };
}

/* ───────── 홈 전체 ───────── */

export interface HomeContent {
  meta: { title: string; description: string; ogTitle: string; ogDescription: string };
  /** 채널 이름 (그래프 대체 텍스트 등) */
  platformNames: Readonly<Record<PlatformId, string>>;
  header: SiteHeaderContent;
  hero: HeroContent;
  platformStrip: PlatformStripContent;
  trustStats: TrustStatsContent;
  aiReview: AiReviewContent;
  ledger: LedgerContent;
  finance: FinanceContent;
  operations: OperationsContent;
  useCases: UseCasesContent;
  roadmap: RoadmapContent;
  easyStart: EasyStartContent;
  values: ValuesContent;
  footer: SiteFooterContent;
}
