/**
 * 우주스테이 API(NestJS, /api) 호출 — 서버에서만 쓴다 (토큰을 브라우저에 노출하지 않음)
 * 응답 오류는 { status, errorCode, message } 로 통일해 화면에 넘긴다.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly errorCode: string,
    message: string,
  ) {
    super(message);
  }
}

/** 토큰이 만료됐을 때 — 화면에서 갱신 경로로 보낸다 */
export class ApiAuthError extends ApiError {}

export interface ApiTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ApiUser {
  id: string;
  phone: string;
  name: string;
  email: string | null;
}

/** 실증 업장 (PO-09 · PO-11) */
export interface ApiPilot {
  group: string;
  startedAt: string;
  endsAt: string;
  active: boolean;
}

export interface ApiMe extends ApiUser {
  properties: {
    id: string;
    name: string;
    type: string;
    rooms: number;
    role: "OWNER" | "MANAGER" | "STAFF";
    pilot?: ApiPilot | null;
    /** rates false — 요금·재고 메뉴 숨김 (실증 기간) */
    features?: { rates: boolean };
  }[];
  /** 새 업장 무료 체험 일수 */
  trialDays?: number;
}

type ApiAlertKind =
  | "CHANNEL_AUTH"
  | "CHANNEL_ERROR"
  | "PAYMENT_FAILED"
  | "LOW_RATED"
  | "NO_STAFF"
  | "STALE_DIRTY"
  | "MISSING_CLOCK_OUT"
  | "NO_CHANNEL";

export interface ApiMonthCosts {
  expenses: number;
  payroll: number;
  payrollStatus: "CONFIRMED" | "DRAFT" | null;
  costRatio: number | null;
}

export interface ApiPortfolioProperty {
  id: string;
  name: string;
  type: string;
  rooms: number;
  role: "OWNER" | "MANAGER";
  today: { sales: number; bookings: number; yesterdaySales: number };
  period?: { sales: number; bookings: number; prevSales: number };
  month: { sales: number; prevToDate: number };
  costs?: ApiMonthCosts;
  reviews: { unanswered: number; lowRated: number };
  settle7: number;
  roomStatus: {
    ready: number;
    dirty: number;
    cleaning: number;
    inspect: number;
    occupied: number;
    outOfOrder: number;
    staleDirty: number;
  };
  staff: { onDuty: number; missingClockOut: number; scheduledNow?: number };
  channels: { connected: number; error: number; authExpired: number };
  billing: { status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | null };
  alerts: { kind: ApiAlertKind; message: string; link: string }[];
}

export interface ApiPortfolio {
  date: string;
  period?: { key: "today" | "yesterday" | "week"; from: string; to: string };
  properties: ApiPortfolioProperty[];
  totals: {
    properties: number;
    needsAttention: number;
    today: { sales: number; bookings: number; yesterdaySales: number };
    period?: { sales: number; bookings: number; prevSales: number };
    month: { sales: number; prevToDate: number };
    costs?: ApiMonthCosts;
    reviews: { unanswered: number; lowRated: number };
    settle7: number;
  };
}

export type ApiChannel = "YANOLJA" | "YEOGI" | "NAVER" | "AGODA" | "TRIP" | "HOTELS" | "ONDA" | "KKUL" | "DDNAYO";

/** 직원·권한 (GET /portfolio/people) */
export interface ApiPortfolioPeople {
  properties: { id: string; name: string }[];
  people: { userId: string; name: string; phone: string; roles: Record<string, "OWNER" | "MANAGER" | "STAFF"> }[];
  /** phone: 사장님에게는 전체 번호(숫자만). invitationIds 는 propertyIds 와 같은 순서 */
  invitations: {
    phone: string;
    role: "MANAGER" | "STAFF";
    propertyIds: string[];
    invitationIds?: string[];
    expiresAt: string;
  }[];
}

/** 업장 비교 리포트 (GET /portfolio/report) */
export interface ApiPortfolioReport {
  month: string;
  partial: boolean;
  days: number;
  months: string[];
  properties: {
    id: string;
    name: string;
    type: string;
    rooms: number;
    role: "OWNER" | "MANAGER";
    sales: number;
    prevSales: number;
    bookings: number;
    commission: number;
    perRoomDay: number;
    channels: { channel: ApiChannel; name: string; sales: number }[];
    reviews: { count: number; avgRating: number | null; answered: number; replyBase?: number };
    costs?: ApiMonthCosts;
    trend: number[];
  }[];
}

/** 통합 리뷰함 (GET /portfolio/reviews) */
export interface ApiReviewInbox {
  properties: { id: string; name: string }[];
  channels: { channel: ApiChannel; name: string; replyMode: "API" | "COPY" }[];
  items: (ApiReview & { propertyId: string })[];
  truncated: boolean;
}

export interface ApiReview {
  id: string;
  channel: ApiChannel;
  channelName: string;
  replyMode: "API" | "COPY";
  author: string;
  rating: number;
  body: string;
  photos: string[];
  roomType: string | null;
  stayDate: string | null;
  postedAt: string;
  status: "UNANSWERED" | "POSTED";
  sentiment: "POSITIVE" | "IMPROVE";
  needsReview: boolean;
  /** generator: 'ai' — AI 가 쓴 초안 · 'template' — 말투 설정으로 만든 템플릿 초안 */
  draft: { text: string; keywords: string[]; generator?: string } | null;
  /** EXTERNAL: 수집할 때 채널에 이미 있던 답글 (postedAt 이 없을 수 있음) */
  reply: { text: string; via: "API" | "COPY" | "AUTO" | "EXTERNAL"; postedAt: string | null } | null;
  copyTo?: string | null;
}

export interface ApiChannelState {
  channel: ApiChannel;
  name: string;
  replyMode: "API" | "COPY";
  connected: boolean;
  status: "CONNECTED" | "SYNCING" | "AUTH_EXPIRED" | "ERROR" | null;
  lastSyncedAt: string | null;
}

export interface ApiDashboard {
  date: string;
  property: { id: string; name: string; type: string; rooms: number };
  todaySales: { amount: number; yesterday: number; changeRate: number | null; bookings: number };
  unanswered: { total: number; lowRating: number };
  /** count: 7일 안 정산 예정 채널 수(중복 제거) · items: 정산 건수 */
  settlementWeek: { amount: number; count: number; items?: number };
  channelSales: { channel: ApiChannel; name: string; amount: number }[];
  settlements: { date: string; channel: ApiChannel; name: string; amount: number }[];
  pendingReviews: ApiReview[];
  channels: { channel: ApiChannel; name: string; replyMode: "API" | "COPY"; status: string; lastSyncedAt: string | null }[];
}

export interface ApiReplySettings {
  tone: "POLITE" | "FRIENDLY";
  signature: string;
  mustInclude: string;
  banned: string[];
  autoEnabled: boolean;
  autoMinRating: number;
  autoHours: "ALWAYS" | "DAYTIME";
}

export interface ApiNotification {
  id: string;
  propertyId: string;
  propertyName?: string;
  kind: "REVIEW" | "SETTLE" | "SYNC" | "BILLING" | "STAFF" | "SUMMARY";
  text: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

/* 매출장부 (F2) */
export interface ApiLedger {
  month: string;
  sales: number;
  prevSales: number;
  /** 지난달 같은 날짜까지의 매출 — 이번 달 진행 중일 때 공정하게 비교 (없을 수 있음) */
  prevSalesToDate?: number;
  /** 진행 중인 달이면 true — sales·fees·channels·trend(이번 달) 는 오늘(KST) 체크인까지 */
  partial?: boolean;
  /** 기준일 YYYY-MM-DD */
  asOf?: string;
  /** 내일 ~ 말일 체크인 예정 (지난 달은 0) */
  upcoming?: { sales: number; bookings: number; commission: number };
  adSpend: number;
  fees: number;
  settleSoon: number;
  trend: { month: string; sales: number }[];
  channels: { channel: ApiChannel; name: string; bookings: number; sales: number; fees: number; feeRate: number; adSpend: number }[];
  calendar: { month: string; days: { date: string; items: { channel: ApiChannel; amount: number; done: boolean }[] }[] };
  priceCompare: {
    date: string;
    rooms: { roomType: string; prices: Partial<Record<ApiChannel, number>> }[];
    competitors: { name: string; distance: string; roomType: string; price: number }[];
  };
  stayMix: {
    date: string;
    rooms: number;
    dayuse: { count: number; sales: number };
    overnight: { count: number; sales: number };
    hourly: { hour: number; count: number }[];
  };
}

/* 알바관리 (F5) */
export type ApiJobRole = "MANAGER" | "FRONT" | "NIGHT" | "HOUSEKEEPING";
export type ApiShift = "DAY" | "NIGHT" | "OFF";
export interface ApiStaff {
  date: string;
  month: string;
  minimumWage: number;
  members: {
    id: string;
    name: string;
    phone: string;
    jobRole: ApiJobRole;
    payType: "HOURLY" | "MONTHLY";
    payAmount: number;
    hiredDate: string;
    resignedDate: string | null;
    contract: "SENT" | "SIGNED" | null;
    linked: boolean;
  }[];
  today: {
    employeeId: string;
    attendanceId: string | null;
    in: string | null;
    out: string | null;
    status: "working" | "done" | "missing-out" | "late" | "scheduled" | "off";
    edited: boolean;
    /** 출근·퇴근을 어떻게 찍었는지 (기록 없으면 null) */
    method?: ApiClockMethod | null;
    outMethod?: ApiClockMethod | null;
  }[];
  /** 기다리는 출퇴근 요청 (오래된 순) */
  clockRequests?: ApiClockRequest[];
  /** 퇴근 누락 (최근 31일, 퇴사자 포함) — 고치기는 PUT /staff/attendance */
  missingClockOut?: { employeeId: string; name: string; attendanceId: string; date: string; in: string }[];
  monthHours: Record<string, number>;
  /** null: 근무표가 없는 날 (미정) */
  week: { dates: string[]; shifts: Record<string, (ApiShift | null)[]> };
  payroll: {
    employeeId: string;
    hours: number;
    nightHours: number;
    base: number;
    night: number;
    weekly: number;
    total: number;
    status: "DRAFT" | "CONFIRMED" | "SENT" | null;
  }[];
}
export type ApiClockMethod = "GPS" | "QR" | "REQUEST" | "MANUAL";
export interface ApiClockRequest {
  id: string;
  employeeId: string;
  name?: string;
  type: "IN" | "OUT";
  status?: "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: string;
  /** 한국 날짜 · HH:mm */
  date: string;
  time: string;
  reason: string;
  distanceM: number | null;
  rejectReason?: string | null;
  createdAt: string;
}
/** 출근 확인 설정 — 위치는 위도·경도가 둘 다 있을 때만 */
export interface ApiClockSettings {
  locationSet: boolean;
  latitude: number | null;
  longitude: number | null;
  radiusM: number;
}
export interface ApiClockQr {
  propertyId: string;
  propertyName: string;
  keyVersion: number;
  payload: string;
}
export interface ApiStaffMe {
  date: string;
  property: string;
  employee: { id: string; name: string; jobRole: ApiJobRole; payType: "HOURLY" | "MONTHLY"; payAmount: number };
  state: "ready" | "working" | "done";
  /** shift null: 근무표 없음 (미정) */
  today: {
    in: string | null;
    out: string | null;
    shift: ApiShift | null;
    method?: ApiClockMethod | null;
    outMethod?: ApiClockMethod | null;
  };
  clock?: ApiClockSettings;
  requests?: {
    id: string;
    type: "IN" | "OUT";
    status: "PENDING" | "APPROVED" | "REJECTED";
    requestedAt: string;
    reason: string;
    rejectReason: string | null;
    decidedAt: string | null;
  }[];
  week: { dates: string[]; shifts: (ApiShift | null)[] };
  nextWeek?: { dates: string[]; shifts: (ApiShift | null)[] };
  coworkers?: { name: string; shift: "DAY" | "NIGHT" | null; working: boolean }[];
  /** 방금 누른 퇴근을 되돌릴 수 있는 마감 (ISO) */
  undoOutUntil?: string | null;
  month: { hours: number; nightHours: number; estimatedPay: number };
  /** 이번 달 급여 내역 — 사장님 급여 화면과 같은 계산 */
  pay?: {
    payType: "HOURLY" | "MONTHLY";
    rate: number | null;
    monthly: number | null;
    hours: number;
    base: number;
    nightHours: number;
    night: number;
    weeklyHours: number | null;
    weekly: number;
    total: number;
    status: "DRAFT" | "CONFIRMED" | "SENT" | null;
  };
  records: { date: string; in: string; out: string | null; hours: number | null; edited: boolean }[];
}
/** 직원 한 명의 한 달 출퇴근 — GET /staff/employees/:id/attendance?month= */
export interface ApiStaffMonth {
  month: string;
  employee: { id: string; name: string; jobRole: ApiJobRole; hiredDate: string };
  locked: boolean;
  totalHours: number;
  workedDays: number;
  days: {
    workDate: string;
    shift: ApiShift | null;
    attendanceId: string | null;
    clockIn: string | null;
    clockOut: string | null;
    hours: number | null;
    method: string | null;
    memo: string | null;
    edited: boolean;
    editedAt: string | null;
    editedBy: string | null;
    missingOut: boolean;
    working: boolean;
    absent: boolean;
  }[];
}
export interface ApiEmployeeInput {
  name: string;
  phone: string;
  jobRole: ApiJobRole;
  /** 사장님만 — 매니저가 넣으면 403 PAY_OWNER_ONLY (빼면 그해 최저시급 시급제) */
  payType?: "HOURLY" | "MONTHLY";
  payAmount?: number;
  hiredDate: string;
}

/* 지출관리 (F6) */
export type ApiExpenseCategory = "AMENITY" | "UTILITY" | "LAUNDRY" | "FOOD" | "REPAIR" | "TAX" | "ETC";
export interface ApiExpenseItem {
  id: string;
  date: string;
  vendor: string;
  category: ApiExpenseCategory;
  amount: number;
  source: "CARD" | "RECEIPT" | "ORDER" | "MANUAL";
  memo: string | null;
  /** 영수증으로 등록한 지출이면 그 영수증 id */
  receiptId?: string | null;
}
export interface ApiOrder {
  id: string;
  date: string;
  item: string;
  qty: number;
  unit: string;
  vendor: string;
  amount: number;
  category: ApiExpenseCategory;
  status: "REQUESTED" | "ORDERED" | "RECEIVED" | "CANCELLED";
}
export interface ApiReceipt {
  id: string;
  fileName: string;
  status: "SCANNED" | "REGISTERED";
  reading: { vendor: string | null; date: string | null; amount: number | null; category: ApiExpenseCategory | null };
}
export interface ApiExpenses {
  month: string;
  total: number;
  prevTotal: number;
  /** 지난달 같은 날짜까지의 지출 (없을 수 있음) */
  prevTotalToDate?: number;
  /** 오늘 체크인까지 (매출장부와 같은 기준) */
  sales: number;
  upcoming?: { sales: number; bookings: number; commission: number };
  byCategory: { category: ApiExpenseCategory; amount: number }[];
  items: ApiExpenseItem[];
  orders: ApiOrder[];
  pendingReceipts: ApiReceipt[];
}
export interface ApiExpenseInput {
  date: string;
  vendor: string;
  category: ApiExpenseCategory;
  amount: number;
  memo?: string;
}

/* 현장 업무 (F7) */
export type ApiRoomStatus = "READY" | "OCCUPIED" | "DIRTY" | "CLEANING" | "INSPECT" | "OUT_OF_ORDER";
export interface ApiRoom {
  id: string;
  number: string;
  floor: number | null;
  roomType: string | null;
  status: ApiRoomStatus;
  memo: string | null;
  changedAt: string;
  changedBy: string | null;
}
export interface ApiOpsNote {
  id: string;
  kind: "HANDOVER" | "NOTICE";
  shift: "DAY" | "NIGHT" | "OFF" | null;
  body: string;
  pinned: boolean;
  author: string;
  isMine: boolean;
  createdAt: string;
  readByMe: boolean;
  readers: { name: string; readAt: string }[];
}
export interface ApiOps {
  date: string;
  myRole: "OWNER" | "MANAGER" | "STAFF";
  memberCount: number;
  counts: Record<ApiRoomStatus, number>;
  rooms: ApiRoom[];
  notices: ApiOpsNote[];
  handovers: ApiOpsNote[];
  unread: number;
}
export interface ApiRoomLog {
  from: ApiRoomStatus | null;
  to: ApiRoomStatus;
  memo: string | null;
  by: string | null;
  at: string;
}

/* 구독·결제·업장 (F0-02, F0-08, F0-09, F0-13) */
export type ApiPlanCode = "REVIEW" | "LEDGER" | "STAFF" | "EXPENSE" | "FINANCE";
export interface ApiBilling {
  plans: { code: ApiPlanCode; name: string; monthlyPrice: number; description: string; stage: string; available: boolean }[];
  subscriptions: { planCode: ApiPlanCode; status: string; trialEndsAt: string }[];
  subscribed: ApiPlanCode[];
  trialEnds: string | null;
  inTrial: boolean;
  nextBilling: string | null;
  monthlyTotal: number;
  card: { name: string; last4: string } | null;
  trialDays?: number;
  pilot?: ApiPilot | null;
  /** 실증 기간이라 결제하지 않음 */
  billingHeld?: boolean;
  payments: { id: string; date: string; billedMonth: string; description: string; amount: number; status: "PAID" | "FAILED" | "REFUNDED" }[];
}
export interface ApiProperty {
  id: string;
  name: string;
  type: string;
  address: string;
  rooms: number;
  bizNo: string;
  ownerName: string;
  phone: string | null;
  /** 출근 확인 설정 */
  clock?: ApiClockSettings;
}
export interface ApiMembers {
  members: { id: string; userId: string; name: string; phone: string; role: "OWNER" | "MANAGER" | "STAFF"; joinedAt: string }[];
  /** phone: 부르는 사람이 사장님이면 전체 번호(숫자만), 매니저면 010-****-1234 */
  invitations: { id: string; phone: string; role: "MANAGER" | "STAFF"; expiresAt: string; createdAt?: string }[];
}
export type ApiNoticeKind = "REVIEW" | "SETTLE" | "SYNC" | "BILLING" | "STAFF" | "SUMMARY";
export interface ApiNoticeSetting {
  kind: ApiNoticeKind;
  alimtalk: boolean;
  push: boolean;
  email: boolean;
}

/* 운영자 (F0-14) */
export interface ApiAdmin {
  id: string;
  email: string;
  name: string;
  role: "SUPER" | "OPERATOR";
  lastLoginAt: string | null;
}

export interface ApiAdminOverview {
  properties: number;
  newProperties: number;
  trialProperties: number;
  payingProperties: number;
  monthlyRevenue: number;
  syncIssues: number;
  newInquiries: number;
}

export interface ApiAdminProperty {
  id: string;
  name: string;
  type: string;
  rooms: number;
  ownerName: string;
  ownerPhone: string | null;
  createdAt: string;
  manager: { id: string; name: string } | null;
  subscriptions: { planCode: string; status: string; trialEndsAt: string }[];
  channelCount: number;
  issueCount: number;
  lastSyncedAt: string | null;
  unansweredReviews: number;
  address: string;
  owner?: { id: string; name: string; phone: string } | null;
  lastLogin?: { owner: string | null; manager: string | null };
  pilot?: ApiPilot | null;
  activation?: ApiAdminActivation | null;
}

export interface ApiSyncIssue {
  id: string;
  property: { id: string; name: string };
  manager: string | null;
  channel: ApiChannel;
  channelName: string;
  status: string;
  lastError: string | null;
  consecutiveFails: number;
  lastSyncedAt: string | null;
}

export interface ApiInquiry {
  id: string;
  type: "INTRO" | "PARTNER";
  contactName: string;
  phone: string;
  email: string | null;
  propertyName: string | null;
  propertyType: string | null;
  rooms: number | null;
  message: string;
  status: "NEW" | "CONTACTED" | "DONE";
  adminMemo: string | null;
  createdAt: string;
  handledBy: { id: string; name: string } | null;
}

/** 서버 → API 호출에 붙이는 머리글 (내부 호출 키 · 실제 사용자 IP) */
export interface ApiCallContext {
  internalKey?: string;
  clientIp?: string;
}

export class PmsApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token?: string,
    private readonly ctx: ApiCallContext = {},
  ) {}

  withToken(token: string) {
    return new PmsApiClient(this.baseUrl, token, this.ctx);
  }

  private baseHeaders(): Record<string, string> {
    const h: Record<string, string> = {};
    if (this.token) h.authorization = `Bearer ${this.token}`;
    if (this.ctx.internalKey) {
      h["x-internal-key"] = this.ctx.internalKey;
      if (this.ctx.clientIp) h["x-client-ip"] = this.ctx.clientIp;
    }
    return h;
  }

  private async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/v1${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...this.baseHeaders(),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    if (res.status === 204) return undefined as T;
    const data = (await res.json().catch(() => ({}))) as { message?: string | string[]; errorCode?: string };
    if (!res.ok) {
      const message = Array.isArray(data.message) ? data.message[0] : (data.message ?? "요청을 처리하지 못했어요.");
      const Err = res.status === 401 && data.errorCode === "TOKEN_INVALID" ? ApiAuthError : ApiError;
      throw new Err(res.status, data.errorCode ?? "UNKNOWN", message);
    }
    return data as T;
  }

  /* 인증 */
  sendCode(phone: string, purpose: "signup" | "reset") {
    return this.call<{ expiresIn: number; devCode?: string }>("POST", "/auth/phone/send-code", { phone, purpose });
  }
  verifyCode(phone: string, purpose: "signup" | "reset", code: string) {
    return this.call<{ verificationToken: string }>("POST", "/auth/phone/verify", { phone, purpose, code });
  }
  signup(body: {
    verificationToken: string;
    name: string;
    email?: string;
    password: string;
    agreements: { terms: boolean; privacy: boolean; marketing: boolean };
  }) {
    return this.call<ApiTokens & { user: ApiUser }>("POST", "/auth/signup", body);
  }
  login(phone: string, password: string) {
    return this.call<ApiTokens & { user: ApiUser }>("POST", "/auth/login", { phone, password });
  }
  refresh(refreshToken: string) {
    return this.call<ApiTokens>("POST", "/auth/refresh", { refreshToken });
  }
  logout(refreshToken: string) {
    return this.call<void>("POST", "/auth/logout", { refreshToken });
  }
  /** 앱 → 웹 화면 넘기기 코드(1회용, 60초)를 웹 로그인 토큰으로 바꾼다 */
  exchangeHandoff(code: string) {
    return this.call<ApiTokens & { path: string; propertyId: string | null }>("POST", "/auth/web-handoff/exchange", {
      code,
    });
  }
  me() {
    return this.call<ApiMe>("GET", "/auth/me");
  }
  /** 여러 업장 통합 현황 — 내가 사장님·매니저인 업장 전부 */
  portfolio(period?: "today" | "yesterday" | "week") {
    return this.call<ApiPortfolio>("GET", period && period !== "today" ? `/portfolio?period=${period}` : "/portfolio");
  }
  portfolioReport(month?: string) {
    return this.call<ApiPortfolioReport>("GET", `/portfolio/report${month ? `?month=${month}` : ""}`);
  }
  portfolioPeople() {
    return this.call<ApiPortfolioPeople>("GET", "/portfolio/people");
  }
  assignPeople(userId: string, assignments: { propertyId: string; role: "MANAGER" | "STAFF" | null }[]) {
    return this.call<ApiPortfolioPeople>("PUT", `/portfolio/people/${userId}`, { assignments });
  }
  invitePeople(phone: string, role: "MANAGER" | "STAFF", propertyIds: string[]) {
    return this.call<{ invited: string[]; skipped: string[] }>("POST", "/portfolio/invitations", {
      phone,
      role,
      propertyIds,
    });
  }
  portfolioReviews() {
    return this.call<ApiReviewInbox>("GET", "/portfolio/reviews");
  }
  resetPassword(verificationToken: string, password: string) {
    return this.call<unknown>("POST", "/auth/password/reset", { verificationToken, password });
  }
  /** 초대 링크 미리보기 (로그인 없이) */
  invitationPreview(token: string) {
    return this.call<{
      propertyName: string;
      role: "OWNER" | "MANAGER" | "STAFF";
      phone: string;
      status: "VALID" | "EXPIRED" | "USED";
      /** 수락하면 합류할 업장과 업장별 권한 (첫 줄이 이 링크 업장) */
      properties?: { name: string; role: "MANAGER" | "STAFF" }[];
    }>("GET", `/invitations/${encodeURIComponent(token)}`);
  }
  acceptInvitation(token: string) {
    return this.call<{ propertyId: string; role: "OWNER" | "MANAGER" | "STAFF"; joined?: number }>(
      "POST",
      "/invitations/accept",
      { token },
    );
  }

  /* 업장 · 채널 */
  checkBizNo(bizNo: string) {
    return this.call<{ bizNo: string; status: "ACTIVE" | "CLOSED" | "INVALID" }>(
      "GET",
      `/biz-no/check?bizNo=${encodeURIComponent(bizNo)}`,
    );
  }
  createProperty(body: { name: string; type: string; address: string; rooms: number; bizNo: string; ownerName: string }) {
    return this.call<{ id: string; name: string }>("POST", "/properties", body);
  }
  channels(propertyId: string) {
    return this.call<ApiChannelState[]>("GET", `/properties/${propertyId}/channels`);
  }
  connectChannel(propertyId: string, channel: ApiChannel, loginId: string, password: string) {
    return this.call<{ status: string; newReviews: number }>(
      "POST",
      `/properties/${propertyId}/channels/${channel}/connect`,
      { loginId, password, consent: true },
    );
  }

  syncChannel(propertyId: string, channel: ApiChannel) {
    return this.call<unknown>("POST", `/properties/${propertyId}/channels/${channel}/sync`);
  }
  disconnectChannel(propertyId: string, channel: ApiChannel) {
    return this.call<unknown>("DELETE", `/properties/${propertyId}/channels/${channel}`);
  }

  /* 리뷰 */
  async allReviews(propertyId: string): Promise<ApiReview[]> {
    const out: ApiReview[] = [];
    let offset: number | null = 0;
    while (offset !== null && out.length < 200) {
      const page: { items: ApiReview[]; nextOffset: number | null } = await this.call(
        "GET",
        `/properties/${propertyId}/reviews?limit=50&offset=${offset}`,
      );
      out.push(...page.items);
      offset = page.nextOffset;
    }
    return out;
  }
  redraft(propertyId: string, reviewId: string) {
    return this.call<ApiReview>("POST", `/properties/${propertyId}/reviews/${reviewId}/draft`);
  }
  reply(propertyId: string, reviewId: string, text: string) {
    return this.call<ApiReview>("POST", `/properties/${propertyId}/reviews/${reviewId}/reply`, { text });
  }
  replySettings(propertyId: string) {
    return this.call<ApiReplySettings>("GET", `/properties/${propertyId}/reply-settings`);
  }
  /** applyTo: 같은 설정을 함께 저장할 다른 업장 (서명은 복사하지 않음) */
  saveReplySettings(propertyId: string, body: ApiReplySettings, applyTo?: string[]) {
    return this.call<ApiReplySettings>(
      "PUT",
      `/properties/${propertyId}/reply-settings`,
      applyTo?.length ? { ...body, applyTo } : body,
    );
  }

  /* 홈 · 알림 */
  dashboard(propertyId: string) {
    return this.call<ApiDashboard>("GET", `/properties/${propertyId}/dashboard`);
  }
  /** propertyId 가 없으면 내 업장 전부 (통합 알림) */
  notifications(propertyId?: string) {
    const q = propertyId ? `?propertyId=${propertyId}` : "";
    return this.call<{ unread: number; items: ApiNotification[] }>("GET", `/notifications${q}`);
  }
  readAllNotifications(propertyId?: string) {
    const q = propertyId ? `?propertyId=${propertyId}` : "";
    return this.call<unknown>("POST", `/notifications/read-all${q}`);
  }
  readNotification(id: string) {
    return this.call<unknown>("POST", `/notifications/${id}/read`);
  }

  /* 매출장부 */
  ledger(propertyId: string, month?: string) {
    return this.call<ApiLedger>("GET", `/properties/${propertyId}/ledger${month ? `?month=${month}` : ""}`);
  }
  setAdSpend(propertyId: string, body: { channel: ApiChannel; month: string; amount: number }) {
    return this.call<unknown>("PUT", `/properties/${propertyId}/ledger/ad-spend`, body);
  }

  /* 알바관리 */
  /** date: 급여·오늘 기준일 · week: 그 날이 속한 주(월요일 시작)의 교대표 */
  staff(propertyId: string, date?: string, week?: string) {
    const q = new URLSearchParams();
    if (date) q.set("date", date);
    if (week) q.set("week", week);
    const qs = q.toString();
    return this.call<ApiStaff>("GET", `/properties/${propertyId}/staff${qs ? `?${qs}` : ""}`);
  }
  staffMe(propertyId: string) {
    return this.call<ApiStaffMe>("GET", `/properties/${propertyId}/staff/me`);
  }
  /** 퇴근 되돌리기 — 직원 본인, 퇴근 후 5분 안 */
  undoClockOut(propertyId: string) {
    return this.call<unknown>("POST", `/properties/${propertyId}/staff/clock/undo-out`, {});
  }
  staffMonth(propertyId: string, employeeId: string, month: string) {
    return this.call<ApiStaffMonth>(
      "GET",
      `/properties/${propertyId}/staff/employees/${employeeId}/attendance?month=${encodeURIComponent(month)}`,
    );
  }
  /** 출퇴근 — 위치를 보내면 서버가 업장 반경 안인지 본다 (업장 위치가 없으면 확인 없이) */
  clock(
    propertyId: string,
    employeeId: string,
    action: "in" | "out",
    location?: { latitude: number; longitude: number; accuracy?: number },
  ) {
    return this.call<unknown>("POST", `/properties/${propertyId}/staff/attendance/clock`, {
      employeeId,
      action,
      ...(location
        ? {
            latitude: location.latitude,
            longitude: location.longitude,
            ...(location.accuracy !== undefined ? { accuracy: Math.round(location.accuracy) } : {}),
          }
        : {}),
    });
  }
  /** 출퇴근 요청 (직원 본인) — 위치로 안 될 때 사유와 함께 */
  clockRequest(
    propertyId: string,
    body: { type: "IN" | "OUT"; reason: string; latitude?: number; longitude?: number; accuracy?: number },
  ) {
    return this.call<ApiClockRequest>("POST", `/properties/${propertyId}/staff/clock-requests`, body);
  }
  /** 출퇴근 요청 승인·거절 (사장님·매니저) */
  decideClockRequest(propertyId: string, requestId: string, decision: "approve" | "reject", reason?: string) {
    return this.call<unknown>(
      "POST",
      `/properties/${propertyId}/staff/clock-requests/${requestId}/${decision}`,
      decision === "reject" ? { reason } : undefined,
    );
  }
  clockQr(propertyId: string) {
    return this.call<ApiClockQr>("GET", `/properties/${propertyId}/clock-qr`);
  }
  rotateClockQr(propertyId: string) {
    return this.call<ApiClockQr>("POST", `/properties/${propertyId}/clock-qr/rotate`);
  }
  createEmployee(propertyId: string, body: ApiEmployeeInput) {
    return this.call<{ id: string; belowMinimumWage: boolean }>("POST", `/properties/${propertyId}/staff/employees`, body);
  }
  updateEmployee(
    propertyId: string,
    employeeId: string,
    body: Partial<Pick<ApiEmployeeInput, "name" | "phone" | "jobRole" | "payType" | "payAmount">> & {
      resignedDate?: string;
    },
  ) {
    return this.call<{ belowMinimumWage?: boolean }>(
      "PATCH",
      `/properties/${propertyId}/staff/employees/${employeeId}`,
      body,
    );
  }
  sendContract(propertyId: string, employeeId: string) {
    return this.call<{ status: string }>("POST", `/properties/${propertyId}/staff/employees/${employeeId}/contract`);
  }
  editAttendance(
    propertyId: string,
    body: { employeeId: string; workDate: string; clockIn: string; clockOut?: string; memo?: string },
  ) {
    return this.call<unknown>("PUT", `/properties/${propertyId}/staff/attendance`, body);
  }
  setShift(propertyId: string, body: { employeeId: string; workDate: string; shiftType: ApiShift }) {
    return this.call<unknown>("PUT", `/properties/${propertyId}/staff/shifts`, body);
  }
  payroll(propertyId: string, month: string, step: "calculate" | "confirm" | "send" | "reopen") {
    return this.call<{ total: number }>("POST", `/properties/${propertyId}/staff/payroll/${month}/${step}`);
  }
  contract(token: string) {
    return this.call<{
      status: "SENT" | "SIGNED";
      employer: { name: string; owner: string; address: string; bizNo: string };
      employee: { name: string; jobRole: ApiJobRole };
      startDate: string;
      payText: string;
      signedAt: string | null;
    }>("GET", `/contracts/${encodeURIComponent(token)}`);
  }
  signContract(token: string, signerName: string) {
    return this.call<{ status: string }>("POST", `/contracts/${encodeURIComponent(token)}/sign`, { signerName });
  }

  /* 지출관리 */
  expenses(propertyId: string, month?: string) {
    return this.call<ApiExpenses>("GET", `/properties/${propertyId}/expenses${month ? `?month=${month}` : ""}`);
  }
  createExpense(propertyId: string, body: ApiExpenseInput) {
    return this.call<ApiExpenseItem>("POST", `/properties/${propertyId}/expenses`, body);
  }
  updateExpense(propertyId: string, expenseId: string, body: ApiExpenseInput) {
    return this.call<ApiExpenseItem>("PUT", `/properties/${propertyId}/expenses/${expenseId}`, body);
  }
  deleteExpense(propertyId: string, expenseId: string) {
    return this.call<void>("DELETE", `/properties/${propertyId}/expenses/${expenseId}`);
  }
  async uploadReceipt(propertyId: string, file: File) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/v1/properties/${propertyId}/receipts`, {
      method: "POST",
      headers: this.baseHeaders(),
      body: form,
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as ApiReceipt & { message?: string; errorCode?: string };
    if (!res.ok) throw new ApiError(res.status, data.errorCode ?? "UNKNOWN", data.message ?? "영수증을 올리지 못했어요.");
    return data;
  }
  /** 영수증 사진 원본 — 화면의 route handler 가 그대로 흘려보낸다 (토큰은 서버에만) */
  receiptFile(propertyId: string, receiptId: string) {
    return fetch(`${this.baseUrl.replace(/\/$/, "")}/api/v1/properties/${propertyId}/receipts/${receiptId}/file`, {
      headers: this.baseHeaders(),
      cache: "no-store",
    });
  }
  registerReceipt(propertyId: string, receiptId: string, body: ApiExpenseInput) {
    return this.call<ApiExpenseItem>("POST", `/properties/${propertyId}/receipts/${receiptId}/register`, body);
  }
  createOrder(propertyId: string, body: { item: string; qty: number; unit: string; vendor: string; amount: number }) {
    return this.call<ApiOrder>("POST", `/properties/${propertyId}/orders`, body);
  }
  setOrderStatus(propertyId: string, orderId: string, status: "ORDERED" | "RECEIVED" | "CANCELLED") {
    return this.call<ApiOrder>("PATCH", `/properties/${propertyId}/orders/${orderId}`, { status });
  }

  /* 현장 업무 */
  ops(propertyId: string) {
    return this.call<ApiOps>("GET", `/properties/${propertyId}/ops`);
  }
  addRooms(propertyId: string, rooms: { number: string; floor?: number; roomType?: string }[]) {
    return this.call<{ added: number }>("POST", `/properties/${propertyId}/rooms`, { rooms });
  }
  updateRoom(propertyId: string, roomId: string, room: { number: string; floor?: number; roomType?: string }) {
    return this.call<ApiRoom>("PUT", `/properties/${propertyId}/rooms/${roomId}`, room);
  }
  removeRoom(propertyId: string, roomId: string) {
    return this.call<void>("DELETE", `/properties/${propertyId}/rooms/${roomId}`);
  }
  setRoomStatus(propertyId: string, roomId: string, status: ApiRoomStatus, memo?: string) {
    return this.call<ApiRoom>("PATCH", `/properties/${propertyId}/rooms/${roomId}/status`, { status, memo });
  }
  roomLogs(propertyId: string, roomId: string) {
    return this.call<ApiRoomLog[]>("GET", `/properties/${propertyId}/rooms/${roomId}/logs`);
  }
  addOpsNote(
    propertyId: string,
    body: { kind: "HANDOVER" | "NOTICE"; body: string; shift?: "DAY" | "NIGHT"; pinned?: boolean },
  ) {
    return this.call<ApiOpsNote>("POST", `/properties/${propertyId}/ops-notes`, body);
  }
  readOpsNote(propertyId: string, noteId: string) {
    return this.call<void>("POST", `/properties/${propertyId}/ops-notes/${noteId}/read`);
  }
  pinOpsNote(propertyId: string, noteId: string, pinned: boolean) {
    return this.call<void>("PATCH", `/properties/${propertyId}/ops-notes/${noteId}/pin`, { pinned });
  }
  removeOpsNote(propertyId: string, noteId: string) {
    return this.call<void>("DELETE", `/properties/${propertyId}/ops-notes/${noteId}`);
  }

  /* 업장 · 구독 · 알림 설정 */
  property(propertyId: string) {
    return this.call<ApiProperty>("GET", `/properties/${propertyId}`);
  }
  updateProperty(
    propertyId: string,
    body: Partial<Pick<ApiProperty, "name" | "address" | "rooms" | "phone">> & {
      latitude?: number | null;
      longitude?: number | null;
      clockRadiusM?: number;
    },
  ) {
    return this.call<ApiProperty>("PATCH", `/properties/${propertyId}`, body);
  }
  members(propertyId: string) {
    return this.call<ApiMembers>("GET", `/properties/${propertyId}/members`);
  }
  changeMemberRole(propertyId: string, memberId: string, role: "OWNER" | "MANAGER" | "STAFF") {
    return this.call<unknown>("PATCH", `/properties/${propertyId}/members/${memberId}`, { role });
  }
  removeMember(propertyId: string, memberId: string) {
    return this.call<void>("DELETE", `/properties/${propertyId}/members/${memberId}`);
  }
  invite(propertyId: string, phone: string, role: "MANAGER" | "STAFF") {
    return this.call<unknown>("POST", `/properties/${propertyId}/invitations`, { phone, role });
  }
  cancelInvitation(propertyId: string, invitationId: string) {
    return this.call<void>("DELETE", `/properties/${propertyId}/invitations/${invitationId}`);
  }
  resendInvitation(propertyId: string, invitationId: string) {
    return this.call<{ ok: true; expiresInDays: number }>(
      "POST",
      `/properties/${propertyId}/invitations/${invitationId}/resend`,
    );
  }
  /** GET /plans 는 상품 원본(isAvailable · stageLabel)을 준다 — 구독 화면(/billing)의 plans 와 같은 모양으로 맞춘다 */
  async plans(): Promise<ApiBilling["plans"]> {
    const raw = await this.call<
      {
        code: ApiPlanCode;
        name: string;
        monthlyPrice: number;
        description: string;
        stageLabel?: string;
        stage?: string;
        isAvailable?: boolean;
        available?: boolean;
      }[]
    >("GET", "/plans");
    return raw.map((p) => ({
      code: p.code,
      name: p.name,
      monthlyPrice: p.monthlyPrice,
      description: p.description,
      stage: p.stage ?? p.stageLabel ?? "",
      available: p.available ?? p.isAvailable ?? false,
    }));
  }
  billing(propertyId: string) {
    return this.call<ApiBilling>("GET", `/properties/${propertyId}/billing`);
  }
  setPlan(propertyId: string, plan: ApiPlanCode, enabled: boolean) {
    return this.call<ApiBilling>("PUT", `/properties/${propertyId}/subscriptions/${plan}`, { enabled });
  }
  /** 결제 실패한 구독료 다시 결제 (등록된 카드로) */
  retryBilling(propertyId: string) {
    return this.call<ApiBilling & { retried: { amount: number; ok: boolean } }>(
      "POST",
      `/properties/${propertyId}/billing/retry`,
    );
  }
  setCard(propertyId: string, authKey: string) {
    return this.call<ApiBilling>("POST", `/properties/${propertyId}/payment-method`, { authKey });
  }
  noticeSettings(propertyId: string) {
    return this.call<ApiNoticeSetting[]>("GET", `/properties/${propertyId}/notification-settings`);
  }
  setNoticeSettings(propertyId: string, items: ApiNoticeSetting[], applyTo?: string[]) {
    return this.call<ApiNoticeSetting[]>(
      "PUT",
      `/properties/${propertyId}/notification-settings`,
      applyTo?.length ? { items, applyTo } : { items },
    );
  }

  /* 랜딩 도입·파트너 문의 (로그인 없음) */
  createInquiry(body: {
    type: "INTRO" | "PARTNER";
    contactName: string;
    phone: string;
    email?: string;
    propertyName?: string;
    propertyType?: string;
    rooms?: number;
    message: string;
  }) {
    return this.call<{ id: string }>("POST", "/inquiries", body);
  }

  /* 운영자 — 운영자 토큰으로 부른다 */
  adminLogin(email: string, password: string) {
    return this.call<{ accessToken: string; expiresIn: number; admin: ApiAdmin }>("POST", "/admin/auth/login", {
      email,
      password,
    });
  }
  adminMe() {
    return this.call<ApiAdmin>("GET", "/admin/auth/me");
  }
  adminOverview() {
    return this.call<ApiAdminOverview>("GET", "/admin/overview");
  }
  adminProperties() {
    return this.call<ApiAdminProperty[]>("GET", "/admin/properties");
  }
  adminSyncIssues() {
    return this.call<ApiSyncIssue[]>("GET", "/admin/sync-issues");
  }
  adminRetrySync(id: string) {
    return this.call<{ status: string; lastError: string | null }>("POST", `/admin/sync-issues/${id}/retry`);
  }
  adminNotifySync(id: string) {
    return this.call<{ notified: boolean }>("POST", `/admin/sync-issues/${id}/notify`);
  }
  adminInquiries() {
    return this.call<{ counts: Record<string, number>; items: ApiInquiry[] }>("GET", "/admin/inquiries");
  }
  adminUpdateInquiry(id: string, body: { status?: ApiInquiry["status"]; adminMemo?: string }) {
    return this.call<ApiInquiry>("PATCH", `/admin/inquiries/${id}`, body);
  }
  adminProperty(id: string) {
    return this.call<ApiAdminPropertyDetail>("GET", `/admin/properties/${id}`);
  }
  adminAssignManager(id: string, managerId: string | null) {
    return this.call<ApiAdminPropertyDetail>("PATCH", `/admin/properties/${id}/manager`, { managerId });
  }
  adminList() {
    return this.call<(ApiAdmin & { isActive: boolean })[]>("GET", "/admin/admins");
  }
  /* 실증 측정 · 운영 도구 (2차 PO) */
  adminPilot(group?: string) {
    return this.call<ApiAdminPilotKpi>("GET", `/admin/pilot${group ? `?group=${encodeURIComponent(group)}` : ""}`);
  }
  adminAttention() {
    return this.call<ApiAdminAttention>("GET", "/admin/attention");
  }
  adminSetPilot(id: string, group: string | null, startedAt?: string) {
    return this.call<ApiAdminPropertyDetail>("PATCH", `/admin/properties/${id}/pilot`, { group, startedAt });
  }
  adminSaveSurvey(id: string, body: Partial<ApiAdminPilotSurvey>) {
    return this.call<ApiAdminPilotSurvey>("PUT", `/admin/properties/${id}/pilot-survey`, body);
  }
  adminAddNote(id: string, kind: ApiAdminSupportNote["kind"], body: string) {
    return this.call<ApiAdminSupportNote>("POST", `/admin/properties/${id}/notes`, { kind, body });
  }
  adminRemoveNote(id: string, noteId: string) {
    return this.call<void>("DELETE", `/admin/properties/${id}/notes/${noteId}`);
  }
}

/* 운영자 — 실증 측정 · 운영 도구 */
export interface ApiAdminActivation {
  stage: "SIGNUP" | "PROPERTY" | "CHANNEL" | "FIRST_SYNC" | "FIRST_REPLY";
  blocked: ApiAdminActivation["stage"] | null;
  stuckSince: string | null;
  steps: { key: ApiAdminActivation["stage"]; label: string; done: boolean; at: string | null }[];
}
export interface ApiAdminPilotSurvey {
  channelCheckMinutes: number | null;
  payrollMethod: string | null;
  payrollMinutes: number | null;
  staffCount: number | null;
  monthlyExpenseCount: number | null;
  recordMethod: string | null;
  baselineMemo: string | null;
  satisfaction4w: number | null;
  satisfaction8w: number | null;
  satisfactionMemo: string | null;
  wtpPlan: string | null;
  wtpProperties: number | null;
  wtpMemo: string | null;
  updatedAt?: string;
}
export interface ApiAdminSupportNote {
  id: string;
  kind: "CALL" | "VISIT" | "ETC";
  body: string;
  createdAt: string;
  admin: { id: string; name: string } | null;
}
export interface ApiAdminPilotWeek {
  week: number;
  from: string;
  to: string;
  days: number;
  partial: boolean;
  future: boolean;
  [metric: string]: number | string | boolean | null;
}
export interface ApiAdminPilotKpi {
  today: string;
  groups: { name: string; properties: number }[];
  group: string | null;
  weeks: number;
  definitions: Record<string, string>;
  properties: {
    id: string;
    name: string;
    owner: { name: string; phone: string; lastLoginAt: string | null } | null;
    lastLoginAt: string | null;
    pilot: ApiPilot & { week: number };
    activation: ApiAdminActivation | null;
    survey: ApiAdminPilotSurvey | null;
    weeks: ApiAdminPilotWeek[];
  }[];
}
export interface ApiAdminAttention {
  rules: { noChannelHours: number; unansweredHours: number; noLoginDays: number };
  items: {
    property: { id: string; name: string; pilotGroup: string | null };
    owner: { id: string; name: string; phone: string } | null;
    manager: { id: string; name: string } | null;
    lastLoginAt: string | null;
    reasons: { kind: "NO_CHANNEL" | "UNANSWERED" | "NO_LOGIN"; text: string }[];
  }[];
}

/** GET /admin/properties/:id */
export interface ApiAdminPropertyDetail {
  id: string;
  name: string;
  type: string;
  address: string;
  rooms: number;
  bizNo: string;
  bizVerified: boolean;
  ownerName: string;
  createdAt: string;
  manager: { id: string; name: string } | null;
  subscriptions: {
    planCode: string;
    planName: string;
    monthlyPrice: number;
    status: string;
    trialEndsAt: string | null;
  }[];
  channels: {
    channel: ApiChannel;
    name: string;
    status: string;
    lastSyncedAt: string | null;
    lastError: string | null;
    consecutiveFails: number;
  }[];
  members: { role: "OWNER" | "MANAGER" | "STAFF"; name: string; phone: string; lastLoginAt: string | null }[];
  payments: {
    id: string;
    billedMonth: string;
    description: string;
    amount: number;
    status: string;
    paidAt: string;
  }[];
  pilot?: ApiPilot | null;
  survey?: ApiAdminPilotSurvey | null;
  activation?: ApiAdminActivation | null;
  aiUsage?: { month: string; drafts: number; regenerations: number; posts: number }[];
  notes?: ApiAdminSupportNote[];
}
