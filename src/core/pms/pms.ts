import type { PlatformId, ReviewPhotoId } from "../home/home-content";

/**
 * 우주스테이 앱(PMS) 도메인 타입
 * 채널 = 연동된 예약 플랫폼. 랜딩의 PlatformId 를 그대로 쓴다.
 */

export type ChannelId = PlatformId;

/** 채널에 답글을 올리는 방법 — api: 버튼으로 바로 게시 / copy: 복사 후 파트너센터에서 직접 붙여넣기 (F1-07) */
export type ReplyMode = "api" | "copy";

export type SyncStatus = "ok" | "syncing" | "error";

export interface ChannelConnection {
  channel: ChannelId;
  name: string;
  replyMode: ReplyMode;
  status: SyncStatus;
  /** "HH:mm" 마지막 수집 시각 */
  lastSyncedAt: string;
}

/** 채널 목록(연결 전 포함) — 설정 > 채널 연동 */
export interface ChannelAccount {
  channel: ChannelId;
  name: string;
  replyMode: ReplyMode;
  connected: boolean;
  /** 연결된 채널만: ok · syncing · error */
  status: SyncStatus | null;
  /** 채널 로그인 정보가 만료돼 다시 로그인이 필요함 */
  authExpired: boolean;
  lastSyncedAt: string;
}

export type PropertyType = "hotel" | "motel" | "pension" | "guesthouse";

export interface Property {
  id: string;
  name: string;
  type: PropertyType;
  rooms: number;
}

/* ── 리뷰 (F1-01 ~ F1-07) ───────────────────────────── */

export type ReviewStatus = "unanswered" | "posted";
export type ReviewSentiment = "positive" | "improve";

export interface GuestReview {
  id: string;
  channel: ChannelId;
  author: string;
  rating: 1 | 2 | 3 | 4 | 5;
  /** "YYYY-MM-DD HH:mm" */
  postedAt: string;
  stayDate: string;
  roomType: string;
  body: string;
  photos: readonly ReviewPhotoId[];
  status: ReviewStatus;
  sentiment: ReviewSentiment;
  /** AI 가 만든 답글 초안 */
  aiDraft: string;
  /** 답글에 반영한 리뷰 키워드 (AI 메모) */
  aiKeywords: readonly string[];
  /** 초안을 만든 방식 — ai: AI 답글 초안 · template: 말투 설정으로 만든 템플릿 초안 */
  draftGenerator?: "ai" | "template";
  /** 게시된 답글 */
  reply?: string;
  /** 욕설·개인정보 등 사람 확인이 필요한 리뷰 — 자동 게시 대상에서 제외 */
  needsReview?: boolean;
}

export type ReviewTab = "all" | "unanswered" | "positive" | "improve";

export function matchesReviewTab(review: GuestReview, tab: ReviewTab): boolean {
  switch (tab) {
    case "all":
      return true;
    case "unanswered":
      return review.status === "unanswered";
    case "positive":
      return review.sentiment === "positive";
    case "improve":
      return review.sentiment === "improve";
  }
}

/* ── 홈 대시보드 (F0-12) ────────────────────────────── */

export interface SettlementItem {
  /** "YYYY-MM-DD" */
  date: string;
  channel: ChannelId;
  amount: number;
}

export interface DashboardData {
  /** 기준일 "YYYY-MM-DD" */
  date: string;
  property: Property;
  todaySales: { amount: number; yesterday: number; bookings: number };
  unanswered: { total: number; lowRating: number };
  settlementWeek: { amount: number; count: number };
  channelSales: readonly { channel: ChannelId; amount: number }[];
  settlements: readonly SettlementItem[];
  channels: readonly ChannelConnection[];
}

/** 어제 대비 증감률(%) — 소수 첫째 자리 */
export function changeRate(today: number, yesterday: number): number | null {
  if (yesterday === 0) return null;
  return Math.round(((today - yesterday) / yesterday) * 1000) / 10;
}

/* ── 서버 동작 결과 (로그인·게시 등 화면 → 서버 호출) ───────────── */

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  /** status: HTTP 상태 (409 = 다른 사람이 먼저 바꿈 → 새로고침) */
  | { ok: false; message: string; errorCode?: string; status?: number };

export interface SignupInput {
  phone: string;
  code: string;
  name: string;
  email?: string;
  password: string;
  marketing: boolean;
}

export interface PropertyInput {
  name: string;
  type: PropertyType;
  address: string;
  rooms: number;
  bizNo: string;
  ownerName: string;
}

/** 로그인·가입 화면이 부르는 서버 동작 — 없으면 화면만 동작하는 시안 모드 */
export interface AuthActions {
  sendCode: (phone: string, purpose?: "signup" | "reset") => Promise<ActionResult<{ devCode?: string }>>;
  /** next: 가입·로그인 뒤 돌아갈 곳 (초대 수락 화면 등) */
  signup: (input: SignupInput, next?: string) => Promise<ActionResult<{ next: string }>>;
  login: (phone: string, password: string, next?: string) => Promise<ActionResult<{ next: string }>>;
  /** 휴대폰 인증(reset) 후 새 비밀번호 */
  resetPassword: (phone: string, code: string, password: string) => Promise<ActionResult>;
}

/** 직원 초대 수락 (문자 링크 /app/invite?token=…) */
export type AcceptInvitationAction = (
  token: string,
) => Promise<ActionResult<{ next: string; propertyName: string | null }>>;

export interface OnboardingActions {
  checkBizNo: (bizNo: string) => Promise<ActionResult<{ status: "ACTIVE" | "CLOSED" | "INVALID" }>>;
  createProperty: (input: PropertyInput) => Promise<ActionResult<{ id: string }>>;
  connectChannel: (
    channel: ChannelId,
    loginId: string,
    password: string,
  ) => Promise<ActionResult<{ newReviews: number }>>;
  /** 고른 서비스 저장 (체험 시작) */
  setPlan: (planId: string, enabled: boolean) => Promise<ActionResult>;
  /** 온보딩 끝 — 이어하기 표시를 지운다 */
  finish?: () => Promise<void>;
}

export interface ReviewActions {
  reply: (reviewId: string, text: string) => Promise<ActionResult<{ review: GuestReview; copyTo: string | null }>>;
  redraft: (reviewId: string) => Promise<ActionResult<{ review: GuestReview }>>;
}

/** 운영자 로그인 (F0-14) */
export interface AdminAuthActions {
  login: (email: string, password: string) => Promise<ActionResult<{ next: string }>>;
}

/** 운영자 백오피스 동작 */
export interface AdminActions {
  retrySync: (issueId: string) => Promise<ActionResult<{ status: string; message: string | null }>>;
  notifySync: (issueId: string) => Promise<ActionResult>;
  setInquiryStatus: (inquiryId: string, status: "new" | "contacted" | "done") => Promise<ActionResult>;
}

/** 알바관리 (F5) */
export interface StaffActions {
  addEmployee: (input: {
    name: string;
    phone: string;
    role: "front" | "housekeeping" | "night" | "manager";
    payType: "hourly" | "monthly";
    payAmount: number;
    hiredDate: string;
  }) => Promise<ActionResult<{ belowMinimumWage: boolean }>>;
  sendContract: (staffId: string) => Promise<ActionResult>;
  editAttendance: (input: {
    staffId: string;
    date: string;
    clockIn: string;
    clockOut?: string;
    memo?: string;
  }) => Promise<ActionResult>;
  setShift: (staffId: string, date: string, shift: "day" | "night" | "off") => Promise<ActionResult>;
  /** 급여 확정 · 명세 발송 · 확정 취소(발송 전, 사장님만) */
  payroll: (month: string, step: "confirm" | "send" | "reopen") => Promise<ActionResult>;
  updateEmployee: (
    staffId: string,
    input: {
      name?: string;
      phone?: string;
      role?: "front" | "housekeeping" | "night" | "manager";
      payType?: "hourly" | "monthly";
      payAmount?: number;
      /** 넣으면 퇴사 처리 */
      resignedDate?: string;
    },
  ) => Promise<ActionResult<{ belowMinimumWage: boolean }>>;
}

/** 지출관리 (F6) */
export interface ExpenseInput {
  date: string;
  vendor: string;
  category: "amenity" | "utility" | "laundry" | "food" | "repair" | "tax" | "etc";
  amount: number;
  memo?: string;
}

export interface ExpenseActions {
  addExpense: (input: ExpenseInput) => Promise<ActionResult>;
  updateExpense: (expenseId: string, input: ExpenseInput) => Promise<ActionResult>;
  deleteExpense: (expenseId: string) => Promise<ActionResult>;
  uploadReceipt: (form: FormData) => Promise<
    ActionResult<{
      id: string;
      vendor: string | null;
      date: string | null;
      amount: number | null;
      category: ExpenseInput["category"] | null;
    }>
  >;
  registerReceipt: (receiptId: string, input: ExpenseInput) => Promise<ActionResult>;
  addOrder: (input: {
    item: string;
    qty: number;
    unit: string;
    vendor: string;
    amount: number;
  }) => Promise<ActionResult>;
  setOrderStatus: (orderId: string, status: "ordered" | "received" | "cancelled") => Promise<ActionResult>;
}

/** 설정 (F0-02 · F0-03 · F0-08 · F0-09 · F0-13) */
export interface SettingsActions {
  saveProperty: (input: { name: string; address: string; rooms: number; phone: string }) => Promise<ActionResult>;
  invite: (phone: string, role: "manager" | "staff") => Promise<ActionResult>;
  setPlan: (planId: string, enabled: boolean) => Promise<ActionResult>;
  /** 개발용 PG — 실제로는 PG 결제창이 authKey 를 준다 */
  registerCard: () => Promise<ActionResult>;
  /** 채널 연동 (F0-04) — 연결·다시 로그인 · 지금 수집 · 연결 끊기 */
  connectChannel: OnboardingActions["connectChannel"];
  syncChannel: (channel: ChannelId) => Promise<ActionResult>;
  disconnectChannel?: (channel: ChannelId) => Promise<ActionResult>;
  /** 직원 계정 권한 바꾸기 */
  changeRole: (memberId: string, role: "manager" | "staff") => Promise<ActionResult>;
  saveNotices: (
    items: {
      kind: "review" | "settle" | "sync" | "billing" | "staff";
      alimtalk: boolean;
      push: boolean;
      email: boolean;
    }[],
  ) => Promise<ActionResult>;
}

/** 직원 본인 출퇴근 */
export type ClockAction = (employeeId: string, action: "in" | "out") => Promise<ActionResult>;
