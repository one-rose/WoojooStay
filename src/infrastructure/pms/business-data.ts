import type {
  AdminData,
  ExpenseItem,
  LedgerChannelRow,
  OpsData,
  OpsNote,
  RoomStatus,
  RoomUnit,
  PriceCompare,
  PurchaseOrder,
  ReplySettings,
  SettingsData,
  SettlementDay,
  ShiftKind,
  StaffMember,
  StayMix,
} from "@/core";

/**
 * 경영 화면(매출장부·알바·지출·설정·운영자)용 예시 데이터
 * 금액·요금제 가격은 모두 임시값 — 기능정의서 '정해야 할 것' 확정 전까지
 */

/* 매출장부 — 10월 */
export const LEDGER_MONTH = "2026-10";
export const PREV_MONTH_SALES = 90_900_000;

export const LEDGER_CHANNELS: readonly LedgerChannelRow[] = [
  { channel: "yanolja", bookings: 214, sales: 25_300_000, feeRate: 0.15, adSpend: 1_800_000 },
  { channel: "yeogi", bookings: 171, sales: 20_100_000, feeRate: 0.15, adSpend: 1_350_000 },
  { channel: "naver", bookings: 126, sales: 14_800_000, feeRate: 0.055, adSpend: 620_000 },
  { channel: "agoda", bookings: 88, sales: 12_500_000, feeRate: 0.17, adSpend: 480_000 },
  { channel: "trip", bookings: 61, sales: 8_600_000, feeRate: 0.16, adSpend: 300_000 },
  { channel: "hotels", bookings: 47, sales: 6_800_000, feeRate: 0.17, adSpend: 210_000 },
  { channel: "onda", bookings: 44, sales: 5_300_000, feeRate: 0.1, adSpend: 160_000 },
  { channel: "kkul", bookings: 29, sales: 3_000_000, feeRate: 0.12, adSpend: 0 },
  { channel: "ddnayo", bookings: 18, sales: 2_000_000, feeRate: 0.12, adSpend: 0 },
];

export const LEDGER_TREND = [
  ["2026-01", 61_200_000],
  ["2026-02", 58_400_000],
  ["2026-03", 66_900_000],
  ["2026-04", 72_300_000],
  ["2026-05", 80_100_000],
  ["2026-06", 84_600_000],
  ["2026-07", 97_800_000],
  ["2026-08", 104_200_000],
  ["2026-09", PREV_MONTH_SALES],
  ["2026-10", 98_400_000],
].map(([month, sales]) => ({ month: month as string, sales: sales as number }));

/* 정산 캘린더 — 11월 */
export const SETTLE_DAYS: readonly SettlementDay[] = [
  { date: "2026-11-03", items: [{ channel: "naver", amount: 2_060_000, done: true }] },
  { date: "2026-11-04", items: [{ channel: "yanolja", amount: 2_940_000, done: true }] },
  { date: "2026-11-05", items: [{ channel: "yeogi", amount: 2_310_000, done: true }] },
  {
    date: "2026-11-06",
    items: [
      { channel: "agoda", amount: 1_820_000, done: true },
      { channel: "onda", amount: 640_000, done: true },
    ],
  },
  { date: "2026-11-11", items: [{ channel: "yanolja", amount: 3_120_000, done: false }] },
  { date: "2026-11-12", items: [{ channel: "yeogi", amount: 2_480_000, done: false }] },
  { date: "2026-11-13", items: [{ channel: "agoda", amount: 1_960_000, done: false }] },
  { date: "2026-11-14", items: [{ channel: "naver", amount: 2_240_000, done: false }] },
  { date: "2026-11-16", items: [{ channel: "trip", amount: 1_410_000, done: false }] },
  { date: "2026-11-17", items: [{ channel: "onda", amount: 1_430_000, done: false }] },
  {
    date: "2026-11-18",
    items: [
      { channel: "yanolja", amount: 2_870_000, done: false },
      { channel: "kkul", amount: 380_000, done: false },
    ],
  },
  { date: "2026-11-19", items: [{ channel: "yeogi", amount: 2_150_000, done: false }] },
  {
    date: "2026-11-20",
    items: [
      { channel: "hotels", amount: 1_250_000, done: false },
      { channel: "ddnayo", amount: 290_000, done: false },
    ],
  },
  { date: "2026-11-24", items: [{ channel: "naver", amount: 1_980_000, done: false }] },
  { date: "2026-11-25", items: [{ channel: "yanolja", amount: 3_050_000, done: false }] },
  { date: "2026-11-27", items: [{ channel: "agoda", amount: 2_110_000, done: false }] },
];

export const PRICE_COMPARE: PriceCompare = {
  date: "2026-11-14",
  rooms: [
    {
      roomType: "스탠다드 더블",
      prices: { yanolja: 132_000, yeogi: 129_000, naver: 125_000, agoda: 138_000, trip: 136_000 },
    },
    {
      roomType: "디럭스 트윈",
      prices: { yanolja: 172_000, yeogi: 169_000, naver: 165_000, agoda: 181_000, trip: 179_000 },
    },
    { roomType: "패밀리 스위트", prices: { yanolja: 265_000, yeogi: 259_000, naver: 255_000, agoda: 274_000 } },
  ],
  competitors: [
    { name: "을지 시티호텔", distance: "350m", roomType: "스탠다드 더블", price: 119_000 },
    { name: "호텔 청계 리버", distance: "600m", roomType: "스탠다드 더블", price: 141_000 },
    { name: "명동 스테이K", distance: "900m", roomType: "스탠다드 더블", price: 127_000 },
  ],
};

export const STAY_MIX: StayMix = {
  date: "2026-11-10",
  rooms: 42,
  dayuse: { count: 18, sales: 702_000 },
  overnight: { count: 31, sales: 4_118_000 },
  hourly: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map((hour, i) => ({
    hour,
    count: [0, 1, 2, 3, 2, 2, 1, 2, 2, 1, 1, 1, 0][i],
  })),
};

/* 알바관리 */
export const MINIMUM_WAGE = 10_320;

export const STAFF: readonly StaffMember[] = [
  {
    id: "s1",
    name: "한상우",
    role: "manager",
    pay: { type: "monthly", amount: 2_800_000 },
    joined: "2024-03-02",
    phone: "010-****-1120",
    contract: "signed",
  },
  {
    id: "s2",
    name: "김민지",
    role: "front",
    pay: { type: "hourly", amount: 11_000 },
    joined: "2025-06-15",
    phone: "010-****-3381",
    contract: "signed",
  },
  {
    id: "s3",
    name: "정다은",
    role: "front",
    pay: { type: "hourly", amount: 11_000 },
    joined: "2026-09-01",
    phone: "010-****-7740",
    contract: "sent",
  },
  {
    id: "s4",
    name: "박준호",
    role: "night",
    pay: { type: "hourly", amount: 12_500 },
    joined: "2025-11-20",
    phone: "010-****-0912",
    contract: "signed",
  },
  {
    id: "s5",
    name: "이수연",
    role: "housekeeping",
    pay: { type: "hourly", amount: 10_500 },
    joined: "2025-02-10",
    phone: "010-****-5563",
    contract: "signed",
  },
  {
    id: "s6",
    name: "최유진",
    role: "housekeeping",
    pay: { type: "hourly", amount: 10_030 },
    joined: "2024-08-05",
    phone: "010-****-2208",
    contract: "none",
  },
];

export const TODAY_ATTENDANCE = [
  { staffId: "s1", in: "08:52", status: "working", method: "gps" },
  { staffId: "s2", in: "08:57", status: "working", method: "qr" },
  { staffId: "s3", status: "off" },
  { staffId: "s4", in: "22:01", out: "07:03", status: "done", method: "gps", outMethod: "request" },
  { staffId: "s5", in: "10:14", status: "late", method: "request" },
  { staffId: "s6", in: "09:58", status: "missing-out", method: "manual" },
] as const;

/** 예시 — 기다리는 출퇴근 요청 (위치·QR 로 못 찍어 사유와 함께 보낸 것) */
export const CLOCK_REQUESTS = [
  {
    id: "cr1",
    staffId: "s3",
    name: "정다은",
    type: "in",
    date: "2026-11-10",
    time: "08:55",
    reason: "휴대폰 위치가 안 잡혀요. 프런트 QR도 떨어져 있어요",
    distanceM: 640,
  },
  {
    id: "cr2",
    staffId: "s6",
    name: "최유진",
    type: "out",
    date: "2026-11-10",
    time: "07:10",
    reason: "배터리가 꺼져서 퇴근을 못 눌렀어요",
    distanceM: null,
  },
] as const;

/** 예시 출근 QR 내용 (체험 모드 — 실제로는 업장 비밀 키로 서명한 값) */
export const CLOCK_QR = {
  propertyName: "스테이 오르빗 을지로",
  payload: "uzustay://clock?p=00000000-0000-4000-8000-000000000001&k=1&s=demo-demo-demo-demo-demo",
  keyVersion: 1,
} as const;

export const MONTH_HOURS: Record<string, [hours: number, nightHours: number, weeksFull: number]> = {
  s1: [176, 0, 4],
  s2: [128, 0, 4],
  s3: [64, 0, 2],
  s4: [140, 98, 4],
  s5: [112, 0, 4],
  s6: [96, 0, 4],
};

export const WEEK_START = "2026-11-09";
export const WEEK_SHIFTS: Record<string, ShiftKind[]> = {
  s1: ["day", "day", "day", "day", "day", "off", "off"],
  s2: ["day", "day", "off", "day", "day", "day", "off"],
  s3: ["off", "off", "day", "off", "day", "unset", "unset"],
  s4: ["night", "night", "night", "off", "off", "night", "night"],
  s5: ["day", "day", "day", "off", "day", "day", "off"],
  s6: ["off", "day", "day", "day", "off", "day", "day"],
};

/* 지출관리 — 10월 */
export const EXPENSE_MONTH = "2026-10";
export const EXPENSE_PREV_TOTAL = 16_840_000;

export const EXPENSES: readonly ExpenseItem[] = [
  { id: "e1", date: "2026-10-02", vendor: "한국전력공사", category: "utility", amount: 3_420_000, source: "card" },
  { id: "e2", date: "2026-10-02", vendor: "서울도시가스", category: "utility", amount: 1_180_000, source: "card" },
  { id: "e3", date: "2026-10-04", vendor: "크린린넨", category: "laundry", amount: 2_860_000, source: "card" },
  { id: "e4", date: "2026-10-07", vendor: "호텔어메니티몰", category: "amenity", amount: 1_540_000, source: "order" },
  { id: "e5", date: "2026-10-09", vendor: "서울시 수도사업소", category: "utility", amount: 640_000, source: "card" },
  {
    id: "e6",
    date: "2026-10-11",
    vendor: "조식 식자재(가락시장)",
    category: "food",
    amount: 1_920_000,
    source: "receipt",
  },
  { id: "e7", date: "2026-10-14", vendor: "크린린넨", category: "laundry", amount: 1_310_000, source: "card" },
  { id: "e8", date: "2026-10-16", vendor: "OO설비", category: "repair", amount: 880_000, source: "receipt" },
  { id: "e9", date: "2026-10-18", vendor: "생수 정기배송", category: "amenity", amount: 420_000, source: "order" },
  {
    id: "e10",
    date: "2026-10-21",
    vendor: "조식 식자재(가락시장)",
    category: "food",
    amount: 1_760_000,
    source: "receipt",
  },
  { id: "e11", date: "2026-10-25", vendor: "재산세(10월분)", category: "tax", amount: 1_260_000, source: "card" },
  { id: "e12", date: "2026-10-28", vendor: "호텔어메니티몰", category: "amenity", amount: 960_000, source: "order" },
  { id: "e13", date: "2026-10-30", vendor: "OO설비", category: "repair", amount: 350_000, source: "card" },
];

export const ORDERS: readonly PurchaseOrder[] = [
  {
    id: "o1",
    date: "2026-11-09",
    item: "일회용 칫솔·치약 세트",
    qty: 1000,
    unit: "개",
    vendor: "호텔어메니티몰",
    amount: 380_000,
    status: "requested",
  },
  {
    id: "o2",
    date: "2026-11-08",
    item: "샤워 타월 (화이트)",
    qty: 120,
    unit: "장",
    vendor: "크린린넨",
    amount: 720_000,
    status: "ordered",
  },
  {
    id: "o3",
    date: "2026-11-06",
    item: "생수 500ml",
    qty: 40,
    unit: "박스",
    vendor: "생수 정기배송",
    amount: 420_000,
    status: "ordered",
  },
  {
    id: "o4",
    date: "2026-11-03",
    item: "샴푸·린스 디스펜서 리필",
    qty: 60,
    unit: "L",
    vendor: "호텔어메니티몰",
    amount: 540_000,
    status: "received",
  },
  {
    id: "o5",
    date: "2026-10-28",
    item: "객실 슬리퍼",
    qty: 500,
    unit: "켤레",
    vendor: "호텔어메니티몰",
    amount: 960_000,
    status: "received",
  },
];

/* 설정 */
export const SETTINGS: SettingsData = {
  profile: {
    name: "스테이 오르빗 을지로",
    type: "hotel",
    address: "서울 중구 을지로 OO길 12",
    rooms: 42,
    bizNo: "123-45-*****",
    owner: "정현",
    phone: "02-****-1234",
    clock: { latitude: 37.5663, longitude: 126.9918, radiusM: 150 },
  },
  accounts: [
    { name: "정현", phone: "010-****-0001", role: "owner", status: "active" },
    { name: "한상우", phone: "010-****-1120", role: "manager", status: "active" },
    { name: "김민지", phone: "010-****-3381", role: "staff", status: "invited" },
  ],
  plans: [
    {
      id: "review",
      name: "AI 리뷰 자동답변",
      price: 29_000,
      desc: "리뷰 통합, AI 답글, 자동 응대",
      stage: "NOW",
      available: true,
    },
    {
      id: "ledger",
      name: "디지털매출장부",
      price: 39_000,
      desc: "월 대시보드, 정산 캘린더, 가격 비교",
      stage: "NEXT",
      available: true,
    },
    {
      id: "staff",
      name: "알바관리",
      price: 19_000,
      desc: "근태, 스케줄, 급여, 근로계약서",
      stage: "5단계",
      available: true,
    },
    {
      id: "expense",
      name: "지출관리",
      price: 19_000,
      desc: "지출 집계, 영수증, 발주",
      stage: "6단계",
      available: true,
    },
    {
      id: "finance",
      name: "매출선정산과 미래매출선지급",
      price: 0,
      desc: "이용 금액에 따른 수수료",
      stage: "3·4단계",
      available: false,
    },
  ],
  subscribed: ["review", "ledger"],
  trialEnds: "2026-11-30",
  nextBilling: "2026-12-01",
  card: "신한카드 ···· 4417",
  billing: [
    { date: "2026-11-01", item: "AI 리뷰 자동답변, 디지털매출장부", amount: 0, status: "paid" },
    { date: "2026-10-01", item: "AI 리뷰 자동답변", amount: 0, status: "paid" },
  ],
  notifications: [
    {
      id: "n1",
      kind: "review",
      text: "여기어때에 별점 1점 리뷰가 올라왔어요. 확인이 필요한 리뷰예요.",
      at: "11.08 15:33",
      unread: true,
    },
    {
      id: "n2",
      kind: "sync",
      text: "호텔스닷컴 연동이 끊겼어요. 다시 로그인해 주세요.",
      at: "11.09 18:20",
      unread: true,
    },
    {
      id: "n3",
      kind: "settle",
      text: "내일 야놀자 정산금 ₩3,120,000 이 입금될 예정이에요.",
      at: "11.10 09:00",
      unread: true,
    },
    { id: "n4", kind: "review", text: "새 리뷰 3건에 AI 답글 초안을 준비했어요.", at: "11.10 00:45", unread: false },
    {
      id: "n5",
      kind: "billing",
      text: "무료 체험이 11월 30일에 끝나요. 결제 카드를 확인해 주세요.",
      at: "11.07 10:00",
      unread: false,
    },
  ],
};

export const REPLY_SETTINGS: ReplySettings = {
  tone: "polite",
  signature: "스테이 오르빗 을지로 드림",
  mustInclude: "다음 방문 때도 편히 쉬어 가실 수 있도록 준비하겠습니다.",
  banned: "무조건, 절대, 환불",
  autoReply: { enabled: false, minRating: 4, hours: "always" },
};

/* 운영자 백오피스 */
export const ADMIN: AdminData = {
  properties: [
    {
      id: "p1",
      name: "스테이 오르빗 을지로",
      type: "hotel",
      region: "서울 중구",
      plans: ["review", "ledger"],
      channels: 9,
      syncErrors: 1,
      joined: "2026-10-02",
      manager: "이도현",
    },
    {
      id: "p2",
      name: "바다곁 펜션",
      type: "pension",
      region: "강원 강릉",
      plans: ["review"],
      channels: 4,
      syncErrors: 0,
      joined: "2026-10-05",
      manager: "이도현",
    },
    {
      id: "p3",
      name: "호텔 루나 수원",
      type: "motel",
      region: "경기 수원",
      plans: ["review", "ledger"],
      channels: 5,
      syncErrors: 2,
      joined: "2026-10-11",
      manager: "김서윤",
    },
    {
      id: "p4",
      name: "제주 하루게스트하우스",
      type: "guesthouse",
      region: "제주 제주시",
      plans: ["review"],
      channels: 3,
      syncErrors: 0,
      joined: "2026-10-19",
      manager: "김서윤",
    },
    {
      id: "p5",
      name: "부산 해운대 스테이7",
      type: "hotel",
      region: "부산 해운대",
      plans: [],
      channels: 0,
      syncErrors: 0,
      joined: "2026-11-08",
      manager: "-",
    },
  ],
  inquiries: [
    {
      id: "q1",
      at: "2026-11-09 21:40",
      name: "오**",
      property: "남해 별빛펜션",
      type: "pension",
      rooms: 8,
      kind: "도입",
      message: "네이버 리뷰 답글을 자동으로 달 수 있나요?",
      status: "new",
    },
    {
      id: "q2",
      at: "2026-11-09 14:02",
      name: "윤**",
      property: "호텔 그랑 대전",
      type: "hotel",
      rooms: 64,
      kind: "도입",
      message: "매출장부에 광고비도 같이 볼 수 있는지 궁금합니다.",
      status: "new",
    },
    {
      id: "q3",
      at: "2026-11-08 10:15",
      name: "(주)스테이링크",
      property: "-",
      type: "hotel",
      rooms: 0,
      kind: "파트너",
      message: "채널매니저 연동 제휴 문의드립니다.",
      status: "contacted",
    },
    {
      id: "q4",
      at: "2026-11-06 17:30",
      name: "강**",
      property: "모텔 오아시스 천안",
      type: "motel",
      rooms: 32,
      kind: "도입",
      message: "대실 매출 따로 집계되나요?",
      status: "done",
    },
  ],
  syncIssues: [
    { property: "스테이 오르빗 을지로", channel: "hotels", since: "11.09 18:20", reason: "로그인 만료 — 재인증 필요" },
    { property: "호텔 루나 수원", channel: "yeogi", since: "11.10 00:10", reason: "2차 인증 요구" },
    { property: "호텔 루나 수원", channel: "yanolja", since: "11.09 23:55", reason: "수집 3회 연속 실패" },
  ],
};

/* 현장 업무 — 11/10 오후 2시, 퇴실 객실 청소가 한창인 시간 (F7) */
const OPS_TYPES = [
  "스탠다드 더블",
  "스탠다드 더블",
  "디럭스 트윈",
  "디럭스 트윈",
  "디럭스 더블",
  "패밀리 트윈",
  "스위트",
];
const OPS_PATTERN: readonly RoomStatus[] = ["occupied", "dirty", "ready", "cleaning", "occupied", "inspect", "ready"];
const OPS_BY = ["이하늘", "김민지", "한상우", "이하늘", "박서준"];

export const OPS_ROOMS: readonly RoomUnit[] = Array.from({ length: 42 }, (_, i) => {
  const floor = Math.floor(i / 7) + 2;
  const n = (i % 7) + 1;
  const broken = floor === 6 && n === 3;
  const minutes = 6 + ((i * 37) % 170);
  return {
    id: `r${floor}0${n}`,
    number: `${floor}0${n}`,
    floor,
    roomType: OPS_TYPES[n - 1],
    status: broken ? "outOfOrder" : OPS_PATTERN[(i * 3 + floor) % OPS_PATTERN.length],
    memo: broken ? "욕실 배수구 막힘 — 수리 업체 내일 오전 방문" : i === 15 ? "레이트 체크아웃 13시" : null,
    changedAt: new Date(Date.parse("2026-11-10T14:05:00+09:00") - minutes * 60_000).toISOString(),
    changedBy: OPS_BY[i % OPS_BY.length],
  };
});

const note = (n: Partial<OpsNote> & Pick<OpsNote, "id" | "kind" | "body" | "author" | "createdAt">): OpsNote => ({
  shift: null,
  pinned: false,
  isMine: false,
  readByMe: true,
  readers: [],
  ...n,
});

export const OPS: Omit<OpsData, "rooms"> = {
  date: "2026-11-10",
  myRole: "owner",
  memberCount: 5,
  unread: 1,
  notices: [
    note({
      id: "n1",
      kind: "notice",
      pinned: true,
      author: "한상우",
      createdAt: "2026-11-09T08:12:00+09:00",
      body: "이번 주 목요일 오전 10시~12시 전 객실 소독 방역이 있어요. 해당 시간 체크인 고객께 미리 안내 부탁드려요.",
      readers: [
        { name: "한상우", readAt: "2026-11-09T08:12:00+09:00" },
        { name: "김민지", readAt: "2026-11-09T09:01:00+09:00" },
        { name: "이하늘", readAt: "2026-11-09T09:40:00+09:00" },
      ],
    }),
    note({
      id: "n2",
      kind: "notice",
      author: "정현",
      isMine: true,
      createdAt: "2026-11-07T17:30:00+09:00",
      body: "12월부터 조식 시간이 7:00~9:30 으로 바뀝니다. 엘리베이터 안내문 교체해 주세요.",
      readers: [
        { name: "정현", readAt: "2026-11-07T17:30:00+09:00" },
        { name: "한상우", readAt: "2026-11-07T18:02:00+09:00" },
        { name: "김민지", readAt: "2026-11-08T09:10:00+09:00" },
        { name: "박서준", readAt: "2026-11-08T21:55:00+09:00" },
        { name: "이하늘", readAt: "2026-11-08T10:20:00+09:00" },
      ],
    }),
  ],
  handovers: [
    note({
      id: "h1",
      kind: "handover",
      shift: "night",
      author: "박서준",
      readByMe: false,
      createdAt: "2026-11-10T08:05:00+09:00",
      body: "603호 욕실 배수 느림 — 판매 중지 걸어 뒀어요.\n412호 고객 레이트 체크아웃 13시까지 허용(사장님 확인).\n주차장 B2 리모컨 1개 분실, 프런트 서랍 예비 사용 중.",
      readers: [
        { name: "박서준", readAt: "2026-11-10T08:05:00+09:00" },
        { name: "김민지", readAt: "2026-11-10T08:58:00+09:00" },
      ],
    }),
    note({
      id: "h2",
      kind: "handover",
      shift: "day",
      author: "김민지",
      createdAt: "2026-11-09T17:48:00+09:00",
      body: "단체 예약(여기어때 6실) 18시 도착 예정 — 5층으로 배정해 뒀어요. 조식 쿠폰 6장 프런트에 있어요.",
      readers: [
        { name: "김민지", readAt: "2026-11-09T17:48:00+09:00" },
        { name: "박서준", readAt: "2026-11-09T21:58:00+09:00" },
        { name: "정현", readAt: "2026-11-09T22:30:00+09:00" },
      ],
    }),
    note({
      id: "h3",
      kind: "handover",
      shift: "night",
      author: "박서준",
      createdAt: "2026-11-09T08:02:00+09:00",
      body: "새벽 2시 507호 소음 민원 1건, 직접 안내 후 해결. 별도 조치 필요 없어요.",
      readers: [{ name: "박서준", readAt: "2026-11-09T08:02:00+09:00" }],
    }),
  ],
};
