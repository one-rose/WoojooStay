import type { ChannelConnection, Property, RateCell, RoomType, GuestReview, SettlementItem } from "@/core";
import { addDays, weekday } from "@/shared";

/**
 * 앱 화면용 예시 데이터 — 실제 채널 연동(F0-04~07) 전까지 사용
 * 숫자는 랜딩 히어로 대시보드와 맞춤 (오늘 예약매출 4,820,000 / 미답변 8 / 정산 예정 12,640,000)
 */

export const TODAY = "2026-11-10";

export const PROPERTY: Property = { id: "p1", name: "스테이 오르빗 을지로", type: "hotel", rooms: 42 };

export const CHANNELS: readonly ChannelConnection[] = [
  { channel: "yanolja", name: "야놀자", replyMode: "copy", status: "ok", lastSyncedAt: "01:10" },
  { channel: "yeogi", name: "여기어때", replyMode: "copy", status: "ok", lastSyncedAt: "01:08" },
  { channel: "naver", name: "네이버", replyMode: "copy", status: "syncing", lastSyncedAt: "00:40" },
  { channel: "agoda", name: "아고다", replyMode: "copy", status: "ok", lastSyncedAt: "01:02" },
  { channel: "trip", name: "트립닷컴", replyMode: "copy", status: "ok", lastSyncedAt: "00:58" },
  { channel: "hotels", name: "호텔스닷컴", replyMode: "api", status: "error", lastSyncedAt: "11.09 18:20" },
  { channel: "onda", name: "온다", replyMode: "copy", status: "ok", lastSyncedAt: "01:05" },
  { channel: "kkul", name: "꿀스테이", replyMode: "copy", status: "ok", lastSyncedAt: "00:55" },
  { channel: "ddnayo", name: "떠나요", replyMode: "copy", status: "ok", lastSyncedAt: "00:51" },
];

export const TODAY_SALES = { amount: 4_820_000, yesterday: 4_288_000, bookings: 31 };

export const CHANNEL_SALES = [
  { channel: "yanolja", amount: 1_240_000 },
  { channel: "yeogi", amount: 980_000 },
  { channel: "naver", amount: 720_000 },
  { channel: "agoda", amount: 610_000 },
  { channel: "trip", amount: 420_000 },
  { channel: "hotels", amount: 330_000 },
  { channel: "onda", amount: 260_000 },
  { channel: "kkul", amount: 150_000 },
  { channel: "ddnayo", amount: 110_000 },
] as const;

export const SETTLEMENTS: readonly SettlementItem[] = [
  { date: "2026-11-11", channel: "yanolja", amount: 3_120_000 },
  { date: "2026-11-12", channel: "yeogi", amount: 2_480_000 },
  { date: "2026-11-13", channel: "agoda", amount: 1_960_000 },
  { date: "2026-11-14", channel: "naver", amount: 2_240_000 },
  { date: "2026-11-16", channel: "trip", amount: 1_410_000 },
  { date: "2026-11-17", channel: "onda", amount: 1_430_000 },
];

const SIGN = "스테이 오르빗 을지로 드림";

export const REVIEWS: readonly GuestReview[] = [
  {
    id: "r1",
    channel: "yanolja",
    author: "여행하는**",
    rating: 5,
    postedAt: "2026-11-10 00:42",
    stayDate: "2026-11-08",
    roomType: "디럭스 트윈",
    body: "늦게 도착했는데도 체크인이 정말 빨랐어요. 프런트 직원분이 근처 야식집까지 알려주셔서 감동이었습니다. 방도 깨끗하고 침구가 포근했어요!",
    photos: ["lobby", "room"],
    status: "unanswered",
    sentiment: "positive",
    aiDraft: `늦은 시간 도착에도 빠른 체크인과 응대를 기억해 주셔서 감사합니다. 저희 직원의 작은 안내가 즐거운 밤이 되었다니 정말 기쁩니다. 포근한 침구와 깨끗한 객실은 늘 신경 쓰는 부분인데 알아봐 주셔서 힘이 납니다. 다음 여행에도 편히 쉬어 가실 수 있도록 준비해 두겠습니다.\n\n${SIGN}`,
    aiKeywords: ["빠른 체크인", "친절 응대", "청결", "침구"],
  },
  {
    id: "r2",
    channel: "yeogi",
    author: "출장러",
    rating: 4,
    postedAt: "2026-11-09 22:15",
    stayDate: "2026-11-07",
    roomType: "스탠다드 더블",
    body: "출장으로 2박 했습니다. 역에서 가깝고 책상이 넓어서 일하기 좋았어요. 다만 아침에 엘리베이터 대기가 길었습니다.",
    photos: ["cityroom"],
    status: "unanswered",
    sentiment: "positive",
    aiDraft: `바쁜 출장 일정 중 저희 호텔에서 2박 머물러 주셔서 감사합니다. 넓은 책상과 역 접근성이 업무에 도움이 되었다니 다행입니다. 아침 엘리베이터 대기는 말씀 주신 대로 출근 시간대 운영 방식을 점검하겠습니다. 다음 출장 때도 편하게 일하고 쉬실 수 있도록 준비해 두겠습니다.\n\n${SIGN}`,
    aiKeywords: ["출장", "역 근처", "업무 공간", "엘리베이터 대기"],
  },
  {
    id: "r3",
    channel: "naver",
    author: "dlwlgus",
    rating: 2,
    postedAt: "2026-11-09 19:03",
    stayDate: "2026-11-08",
    roomType: "스탠다드 더블",
    body: "옆방 소음이 너무 커서 새벽에 몇 번이나 깼어요. 프런트에 말했는데 해결이 안 됐습니다. 위치는 좋은데 아쉽네요.",
    photos: [],
    status: "unanswered",
    sentiment: "improve",
    aiDraft: `편히 쉬셔야 할 밤에 소음으로 불편을 드려 진심으로 죄송합니다. 말씀해 주셨을 때 바로 해결해 드리지 못한 점도 사과드립니다. 해당 층 방음 상태를 점검하고, 야간 소음 문의 시 객실 이동을 바로 안내하도록 직원 교육을 강화하겠습니다. 다시 찾아주신다면 조용한 객실로 꼭 준비해 두겠습니다.\n\n${SIGN}`,
    aiKeywords: ["소음", "프런트 대응", "위치"],
  },
  {
    id: "r4",
    channel: "agoda",
    author: "Emily R.",
    rating: 5,
    postedAt: "2026-11-09 16:47",
    stayDate: "2026-11-06",
    roomType: "디럭스 트윈",
    body: "Great location near the subway. The breakfast had a nice selection of Korean dishes and the staff spoke good English. Would stay again!",
    photos: ["breakfast"],
    status: "unanswered",
    sentiment: "positive",
    aiDraft: `Thank you so much for staying with us, Emily! We're glad the subway access and our Korean breakfast dishes made your trip easier. Our team will be happy to hear your kind words about their English. We look forward to welcoming you back to Seoul soon.\n\nStay Orbit Euljiro`,
    aiKeywords: ["location", "breakfast", "English-speaking staff"],
  },
  {
    id: "r5",
    channel: "yanolja",
    author: "주말여행",
    rating: 3,
    postedAt: "2026-11-09 11:20",
    stayDate: "2026-11-08",
    roomType: "패밀리 스위트",
    body: "방은 넓고 좋았는데 화장실 배수가 느렸어요. 주차도 생각보다 좁았습니다.",
    photos: ["hall"],
    status: "unanswered",
    sentiment: "improve",
    aiDraft: `가족 여행으로 저희 패밀리 스위트를 찾아주셔서 감사합니다. 넓은 객실이 마음에 드셨다니 다행이지만, 화장실 배수와 주차 공간으로 불편을 드려 죄송합니다. 해당 객실 배수는 바로 점검을 마쳤고, 주차 안내도 체크인 때 더 자세히 드리겠습니다.\n\n${SIGN}`,
    aiKeywords: ["넓은 객실", "배수", "주차"],
  },
  {
    id: "r6",
    channel: "trip",
    author: "旅行者 王",
    rating: 4,
    postedAt: "2026-11-08 21:10",
    stayDate: "2026-11-05",
    roomType: "스탠다드 더블",
    body: "位置很方便，房间干净。早餐可以更丰富一些。",
    photos: [],
    status: "unanswered",
    sentiment: "positive",
    aiDraft: `感谢您选择入住我们酒店！很高兴您喜欢便利的位置和干净的房间。关于早餐的建议我们已经记下，会继续丰富菜品。期待您再次光临首尔。\n\nStay Orbit Euljiro`,
    aiKeywords: ["位置", "干净", "早餐"],
  },
  {
    id: "r7",
    channel: "yeogi",
    author: "쿠키맘",
    rating: 1,
    postedAt: "2026-11-08 15:33",
    stayDate: "2026-11-07",
    roomType: "디럭스 트윈",
    body: "직원 ○○○ 씨 태도가 정말 불쾌했어요. 연락처 010-****-**** 로 연락 달라고 했는데 아무도 안 했네요.",
    photos: [],
    status: "unanswered",
    sentiment: "improve",
    needsReview: true,
    aiDraft: `불쾌한 경험을 드려 진심으로 사과드립니다. 말씀 주신 응대 내용은 담당 매니저가 직접 확인하고 있으며, 남겨주신 연락처로 곧 연락드리겠습니다. 같은 일이 반복되지 않도록 응대 교육을 다시 점검하겠습니다.\n\n${SIGN}`,
    aiKeywords: ["직원 응대", "연락 요청"],
  },
  {
    id: "r8",
    channel: "naver",
    author: "hj_lee",
    rating: 5,
    postedAt: "2026-11-08 09:12",
    stayDate: "2026-11-07",
    roomType: "스탠다드 더블",
    body: "가격 대비 최고예요. 루프탑 라운지에서 본 야경이 기억에 남아요.",
    photos: [],
    status: "unanswered",
    sentiment: "positive",
    aiDraft: `소중한 후기 감사합니다. 루프탑 라운지 야경을 좋게 기억해 주셔서 저희도 뿌듯합니다. 다음에 오시면 해 질 무렵 라운지도 꼭 들러보세요.\n\n${SIGN}`,
    aiKeywords: ["가성비", "루프탑 야경"],
  },
  {
    id: "r9",
    channel: "yanolja",
    author: "한강뷰좋아",
    rating: 5,
    postedAt: "2026-11-07 20:40",
    stayDate: "2026-11-06",
    roomType: "디럭스 트윈",
    body: "조식이 맛있고 직원분들이 친절했어요. 다음에도 올게요.",
    photos: ["breakfast"],
    status: "posted",
    sentiment: "positive",
    aiDraft: "",
    aiKeywords: ["조식", "친절"],
    reply: `맛있는 조식과 친절한 응대를 기억해 주셔서 감사합니다. 다음 방문 때도 따뜻하게 맞이하겠습니다.\n\n${SIGN}`,
  },
  {
    id: "r10",
    channel: "agoda",
    author: "Kenji T.",
    rating: 4,
    postedAt: "2026-11-07 08:05",
    stayDate: "2026-11-04",
    roomType: "스탠다드 더블",
    body: "Clean and compact room. Check-in was quick.",
    photos: [],
    status: "posted",
    sentiment: "positive",
    aiDraft: "",
    aiKeywords: ["clean", "quick check-in"],
    reply:
      "Thank you for your stay, Kenji! We're glad the quick check-in made your arrival easy.\n\nStay Orbit Euljiro",
  },
];

/* ── 요금·재고 ─────────────────────────────────────── */

export const RATE_DAYS = 21;

export const ROOM_TYPES: readonly RoomType[] = [
  {
    id: "std",
    name: "스탠다드 더블",
    plans: [
      { id: "std-ro", name: "룸온리" },
      {
        id: "std-bf",
        name: "조식 포함",
        meal: "조식 2인",
        derived: { from: "std-ro", sign: 1, value: 20_000, unit: "won" },
      },
    ],
  },
  {
    id: "dlx",
    name: "디럭스 트윈",
    plans: [
      { id: "dlx-ro", name: "룸온리" },
      {
        id: "dlx-bf",
        name: "조식 포함",
        meal: "조식 2인",
        derived: { from: "dlx-ro", sign: 1, value: 20_000, unit: "won" },
      },
      { id: "dlx-nr", name: "환불불가 특가", derived: { from: "dlx-ro", sign: -1, value: 10, unit: "percent" } },
    ],
  },
  {
    id: "fam",
    name: "패밀리 스위트",
    plans: [{ id: "fam-ro", name: "룸온리" }],
  },
];

const BASE_PRICE: Record<string, [weekday: number, weekend: number]> = {
  "std-ro": [89_000, 129_000],
  "dlx-ro": [119_000, 169_000],
  "fam-ro": [189_000, 259_000],
};
const BASE_STOCK: Record<string, number> = { "std-ro": 6, "dlx-ro": 4, "fam-ro": 3 };

/** 예시 칸 데이터: 금·토 주말가, 마지막 며칠은 아직 미입력, 몇 칸은 마감·매진 */
export function sampleCells(start: string = TODAY): Record<string, RateCell[]> {
  const cells: Record<string, RateCell[]> = {};
  for (const [planId, [weekdayPrice, weekendPrice]] of Object.entries(BASE_PRICE)) {
    cells[planId] = Array.from({ length: RATE_DAYS }, (_, i) => {
      const date = addDays(start, i);
      const day = weekday(date);
      const weekend = day === 5 || day === 6;
      if (i >= RATE_DAYS - 4) return { stock: null, price: null, open: false };
      const stock = Math.max(0, BASE_STOCK[planId] - ((i * 7 + planId.length) % 3) - (weekend ? 2 : 0));
      return { stock, price: weekend ? weekendPrice : weekdayPrice, open: true };
    });
  }
  // 예시: 패밀리 스위트 닷새째 판매 마감, 디럭스 나흘째 매진
  cells["fam-ro"][4] = { ...cells["fam-ro"][4], open: false };
  cells["dlx-ro"][3] = { ...cells["dlx-ro"][3], stock: 0 };
  return cells;
}
