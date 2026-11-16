import type {
  PmsRepository,
  PortfolioAlert,
  PortfolioData,
  PortfolioProperty,
  PropertyOption,
  PropertyType,
} from "@/core";
import { hasUrgentAlert } from "@/core";
import { kstToday } from "./demo-clock";
import { PROPERTY } from "./sample-data";

/**
 * 체험 모드(서버 없이 배포) — 업장 10곳 예시.
 * 업장을 고르면 기존 예시 화면을 그 업장 이름·객실 수로 보여준다 (데이터 내용은 공통 예시).
 * 첫 업장 RAINBOW HOTEL 의 숫자는 예시 홈(오늘 예약매출 4,820,000 · 미답변 8 · 정산 12,640,000)과 같다.
 */

interface DemoProperty {
  id: string;
  name: string;
  type: PropertyType;
  rooms: number;
  address: string;
  today: [sales: number, bookings: number, yesterday: number];
  month: [sales: number, prevToDate: number];
  reviews: [unanswered: number, lowRated: number];
  settle7: number;
  /** 판매가능 · 청소 필요 · 청소 중 · 점검 · 투숙 · 판매 중지 · 청소 지연 */
  rooms7: [number, number, number, number, number, number, number];
  staff: [onDuty: number, missingClockOut: number];
  channels: [connected: number, error: number, authExpired: number];
  billing: PortfolioProperty["billing"];
  /** 끊긴 채널 이름 */
  broken?: { auth?: string; error?: string };
}

const P = (d: DemoProperty) => d;

export const DEMO_PROPERTIES: readonly DemoProperty[] = [
  P({
    id: "demo-rainbow",
    name: "RAINBOW HOTEL",
    type: "hotel",
    rooms: 48,
    address: "대전 서구 둔산동 OO로 21",
    today: [4_820_000, 31, 4_288_000],
    month: [74_350_000, 69_120_000],
    reviews: [8, 2],
    settle7: 12_640_000,
    rooms7: [12, 9, 3, 2, 21, 1, 4],
    staff: [3, 1],
    channels: [8, 0, 1],
    billing: "active",
    broken: { auth: "호텔스닷컴" },
  }),
  P({
    id: "demo-justsleep",
    name: "저스트슬립호텔 대전유성온천점",
    type: "hotel",
    rooms: 62,
    address: "대전 유성구 봉명동 OO길 8",
    today: [6_130_000, 38, 5_870_000],
    month: [96_480_000, 91_200_000],
    reviews: [5, 1],
    settle7: 15_920_000,
    rooms7: [18, 6, 4, 2, 31, 1, 0],
    staff: [4, 0],
    channels: [5, 0, 0],
    billing: "past_due",
  }),
  P({
    id: "demo-luo",
    name: "루오 호텔 대흥점",
    type: "hotel",
    rooms: 35,
    address: "대전 중구 대흥동 OO로 5",
    today: [2_410_000, 17, 2_690_000],
    month: [38_760_000, 41_030_000],
    reviews: [6, 3],
    settle7: 6_180_000,
    rooms7: [9, 5, 2, 1, 18, 0, 1],
    staff: [2, 0],
    channels: [2, 0, 1],
    billing: "trial",
    broken: { auth: "여기어때" },
  }),
  P({
    id: "demo-browndot",
    name: "브라운도트 호텔 대덕점",
    type: "hotel",
    rooms: 40,
    address: "대전 대덕구 오정동 OO로 40",
    today: [2_780_000, 19, 2_550_000],
    month: [42_910_000, 40_150_000],
    reviews: [7, 3],
    settle7: 7_030_000,
    rooms7: [11, 4, 2, 2, 20, 1, 0],
    staff: [2, 0],
    channels: [1, 1, 0],
    billing: "trial",
    broken: { error: "아고다" },
  }),
  P({
    id: "demo-n7",
    name: "N7 호텔",
    type: "hotel",
    rooms: 28,
    address: "대전 동구 정동 OO길 7",
    today: [0, 0, 0],
    month: [0, 0],
    reviews: [0, 0],
    settle7: 0,
    rooms7: [16, 2, 0, 0, 10, 0, 0],
    staff: [1, 0],
    channels: [0, 0, 0],
    billing: "trial",
  }),
  P({
    id: "demo-onsaemi",
    name: "호텔 온새미 천안",
    type: "hotel",
    rooms: 54,
    address: "충남 천안시 서북구 불당동 OO로 18",
    today: [5_240_000, 33, 4_910_000],
    month: [81_620_000, 77_480_000],
    reviews: [2, 0],
    settle7: 13_480_000,
    rooms7: [15, 3, 3, 1, 32, 0, 0],
    staff: [3, 0],
    channels: [5, 0, 0],
    billing: "active",
  }),
  P({
    id: "demo-hanbat",
    name: "스테이 한밭 둔산",
    type: "motel",
    rooms: 30,
    address: "대전 서구 탄방동 OO길 33",
    today: [1_960_000, 24, 1_740_000],
    month: [29_870_000, 31_420_000],
    reviews: [4, 1],
    settle7: 4_310_000,
    rooms7: [5, 11, 2, 0, 12, 0, 9],
    staff: [1, 0],
    channels: [3, 0, 0],
    billing: "trial",
  }),
  P({
    id: "demo-musim",
    name: "청주 무심천 호텔",
    type: "hotel",
    rooms: 44,
    address: "충북 청주시 상당구 남주동 OO로 9",
    today: [3_120_000, 22, 3_380_000],
    month: [52_340_000, 49_870_000],
    reviews: [3, 1],
    settle7: 8_260_000,
    rooms7: [13, 4, 2, 1, 23, 1, 0],
    staff: [2, 2],
    channels: [4, 0, 0],
    billing: "trial",
  }),
  P({
    id: "demo-sejong",
    name: "세종 호수공원 스테이",
    type: "guesthouse",
    rooms: 24,
    address: "세종 연기면 OO로 55",
    today: [1_180_000, 14, 1_060_000],
    month: [18_920_000, 17_640_000],
    reviews: [2, 0],
    settle7: 2_870_000,
    rooms7: [8, 2, 1, 0, 13, 0, 0],
    staff: [1, 0],
    channels: [3, 0, 0],
    billing: "trial",
  }),
  P({
    id: "demo-geumgang",
    name: "공주 금강 한옥펜션",
    type: "pension",
    rooms: 12,
    address: "충남 공주시 웅진동 OO길 4",
    today: [640_000, 4, 520_000],
    month: [9_830_000, 10_270_000],
    reviews: [1, 0],
    settle7: 1_420_000,
    rooms7: [4, 1, 0, 0, 7, 0, 0],
    staff: [0, 0],
    channels: [3, 0, 0],
    billing: "active",
  }),
];

/** 체험 모드 기본 업장 (쿠키가 없을 때) */
export const DEMO_DEFAULT_PROPERTY = DEMO_PROPERTIES[0].id;

export function findDemoProperty(id: string | undefined): DemoProperty | undefined {
  return DEMO_PROPERTIES.find((p) => p.id === id);
}

/** API 의 alertsFor 와 같은 규칙 — 급한 순 */
function alertsOf(d: DemoProperty): PortfolioAlert[] {
  const out: PortfolioAlert[] = [];
  if (d.broken?.auth)
    out.push({
      kind: "channel-auth",
      message: `${d.broken.auth} 연동이 끊겼어요. 다시 로그인해 주세요.`,
      link: "/app/settings/channels",
    });
  if (d.broken?.error)
    out.push({
      kind: "channel-error",
      message: `${d.broken.error}에서 예약·리뷰를 가져오지 못하고 있어요.`,
      link: "/app/settings/channels",
    });
  if (d.billing === "past_due")
    out.push({
      kind: "payment-failed",
      message: "구독 결제가 실패했어요. 결제 카드를 확인해 주세요.",
      link: "/app/settings/billing",
    });
  if (d.reviews[1] > 0)
    out.push({
      kind: "low-rated",
      message: `별점 3점 이하 리뷰 ${d.reviews[1]}건이 답글을 기다려요.`,
      link: "/app/reviews",
    });
  if (d.rooms7[6] > 0)
    out.push({
      kind: "stale-dirty",
      message: `청소 필요 객실 ${d.rooms7[6]}실이 2시간 넘게 그대로예요.`,
      link: "/app/ops",
    });
  if (d.staff[1] > 0)
    out.push({
      kind: "missing-clock-out",
      message: `퇴근 기록이 빠진 근무가 ${d.staff[1]}건 있어요.`,
      link: "/app/staff",
    });
  if (d.channels.every((c) => c === 0))
    out.push({ kind: "no-channel", message: "채널이 아직 연결되지 않았어요.", link: "/app/settings/channels" });
  return out;
}

function toPortfolioProperty(d: DemoProperty): PortfolioProperty {
  const [ready, dirty, cleaning, inspect, occupied, outOfOrder, staleDirty] = d.rooms7;
  return {
    id: d.id,
    name: d.name,
    type: d.type,
    rooms: d.rooms,
    role: "owner",
    today: { sales: d.today[0], bookings: d.today[1], yesterdaySales: d.today[2] },
    month: { sales: d.month[0], prevToDate: d.month[1] },
    reviews: { unanswered: d.reviews[0], lowRated: d.reviews[1] },
    settle7: d.settle7,
    roomStatus: { ready, dirty, cleaning, inspect, occupied, outOfOrder, staleDirty },
    staff: { onDuty: d.staff[0], missingClockOut: d.staff[1] },
    channels: { connected: d.channels[0], error: d.channels[1], authExpired: d.channels[2] },
    billing: d.billing,
    alerts: alertsOf(d),
  };
}

/** 체험 모드 통합 현황 — 날짜는 오늘(한국) */
export function demoPortfolio(today = kstToday()): PortfolioData {
  const properties = DEMO_PROPERTIES.map(toPortfolioProperty);
  const sum = (f: (p: PortfolioProperty) => number) => properties.reduce((s, p) => s + f(p), 0);
  return {
    date: today,
    properties,
    totals: {
      properties: properties.length,
      needsAttention: properties.filter((p) => p.alerts.length > 0).length,
      today: {
        sales: sum((p) => p.today.sales),
        bookings: sum((p) => p.today.bookings),
        yesterdaySales: sum((p) => p.today.yesterdaySales),
      },
      month: { sales: sum((p) => p.month.sales), prevToDate: sum((p) => p.month.prevToDate) },
      reviews: { unanswered: sum((p) => p.reviews.unanswered), lowRated: sum((p) => p.reviews.lowRated) },
      settle7: sum((p) => p.settle7),
    },
  };
}

/** 체험 모드 업장 전환 목록 */
export function demoPropertyOptions(): PropertyOption[] {
  return DEMO_PROPERTIES.map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    rooms: d.rooms,
    urgent: hasUrgentAlert({ alerts: alertsOf(d) }),
  }));
}

const SAMPLE_NAME = PROPERTY.name;
const SAMPLE_ADDRESS = "서울 중구 을지로 OO길 12";

/** 예시 데이터 안의 업장 이름·주소를 고른 업장 것으로 (운영자 화면은 그대로) */
function rename<T>(value: T, d: DemoProperty): T {
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return v.replaceAll(SAMPLE_NAME, d.name).replaceAll(SAMPLE_ADDRESS, d.address);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}

/**
 * 고른 업장으로 보이게 감싼 예시 저장소 — 이름·주소는 모든 화면에서, 업장 종류·객실 수는 홈·설정에서 바꾼다.
 */
export function demoPropertyRepository(inner: PmsRepository, propertyId: string | undefined): PmsRepository {
  const d = findDemoProperty(propertyId) ?? DEMO_PROPERTIES[0];
  return new Proxy(inner, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      if (typeof value !== "function" || key === "getAdmin") return value;
      return async (...args: unknown[]) => {
        const out = rename(await value.apply(target, args), d);
        if (key === "getDashboard") {
          const dash = out as Awaited<ReturnType<PmsRepository["getDashboard"]>>;
          return { ...dash, property: { id: d.id, name: d.name, type: d.type, rooms: d.rooms } };
        }
        if (key === "getSettings") {
          const s = out as Awaited<ReturnType<PmsRepository["getSettings"]>>;
          return { ...s, profile: { ...s.profile, type: d.type, rooms: d.rooms } };
        }
        return out;
      };
    },
  });
}
