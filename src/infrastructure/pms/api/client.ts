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

export interface ApiMe extends ApiUser {
  properties: { id: string; name: string; type: string; rooms: number; role: "OWNER" | "MANAGER" | "STAFF" }[];
}

export type ApiChannel = "YANOLJA" | "YEOGI" | "NAVER" | "AGODA" | "TRIP" | "HOTELS" | "ONDA" | "KKUL" | "DDNAYO";

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
  reply: { text: string; via: "API" | "COPY" | "AUTO"; postedAt: string } | null;
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
  settlementWeek: { amount: number; count: number };
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
  kind: "REVIEW" | "SETTLE" | "SYNC" | "BILLING" | "STAFF";
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
    status: "working" | "done" | "missing-out" | "late" | "off";
    edited: boolean;
  }[];
  monthHours: Record<string, number>;
  week: { dates: string[]; shifts: Record<string, ApiShift[]> };
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
export interface ApiStaffMe {
  date: string;
  property: string;
  employee: { id: string; name: string; jobRole: ApiJobRole; payType: "HOURLY" | "MONTHLY"; payAmount: number };
  state: "ready" | "working" | "done";
  today: { in: string | null; out: string | null; shift: ApiShift };
  week: { dates: string[]; shifts: ApiShift[] };
  month: { hours: number; nightHours: number; estimatedPay: number };
  records: { date: string; in: string; out: string | null; hours: number | null; edited: boolean }[];
}
export interface ApiEmployeeInput {
  name: string;
  phone: string;
  jobRole: ApiJobRole;
  payType: "HOURLY" | "MONTHLY";
  payAmount: number;
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
  sales: number;
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
}
export interface ApiMembers {
  members: { id: string; userId: string; name: string; phone: string; role: "OWNER" | "MANAGER" | "STAFF"; joinedAt: string }[];
  invitations: { id: string; phone: string; role: "MANAGER" | "STAFF"; expiresAt: string }[];
}
export type ApiNoticeKind = "REVIEW" | "SETTLE" | "SYNC" | "BILLING" | "STAFF";
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
  me() {
    return this.call<ApiMe>("GET", "/auth/me");
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
    }>("GET", `/invitations/${encodeURIComponent(token)}`);
  }
  acceptInvitation(token: string) {
    return this.call<{ propertyId: string; role: "OWNER" | "MANAGER" | "STAFF" }>("POST", "/invitations/accept", {
      token,
    });
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
  saveReplySettings(propertyId: string, body: ApiReplySettings) {
    return this.call<ApiReplySettings>("PUT", `/properties/${propertyId}/reply-settings`, body);
  }

  /* 홈 · 알림 */
  dashboard(propertyId: string) {
    return this.call<ApiDashboard>("GET", `/properties/${propertyId}/dashboard`);
  }
  notifications(propertyId: string) {
    return this.call<{ unread: number; items: ApiNotification[] }>("GET", `/notifications?propertyId=${propertyId}`);
  }
  readAllNotifications(propertyId: string) {
    return this.call<unknown>("POST", `/notifications/read-all?propertyId=${propertyId}`, { propertyId });
  }

  /* 매출장부 */
  ledger(propertyId: string, month?: string) {
    return this.call<ApiLedger>("GET", `/properties/${propertyId}/ledger${month ? `?month=${month}` : ""}`);
  }
  setAdSpend(propertyId: string, body: { channel: ApiChannel; month: string; amount: number }) {
    return this.call<unknown>("PUT", `/properties/${propertyId}/ledger/ad-spend`, body);
  }

  /* 알바관리 */
  staff(propertyId: string, date?: string) {
    return this.call<ApiStaff>("GET", `/properties/${propertyId}/staff${date ? `?date=${date}` : ""}`);
  }
  staffMe(propertyId: string) {
    return this.call<ApiStaffMe>("GET", `/properties/${propertyId}/staff/me`);
  }
  clock(propertyId: string, employeeId: string, action: "in" | "out") {
    return this.call<unknown>("POST", `/properties/${propertyId}/staff/attendance/clock`, {
      employeeId,
      action,
      method: "GPS",
    });
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
  updateProperty(propertyId: string, body: Partial<Pick<ApiProperty, "name" | "address" | "rooms" | "phone">>) {
    return this.call<ApiProperty>("PATCH", `/properties/${propertyId}`, body);
  }
  members(propertyId: string) {
    return this.call<ApiMembers>("GET", `/properties/${propertyId}/members`);
  }
  changeMemberRole(propertyId: string, memberId: string, role: "OWNER" | "MANAGER" | "STAFF") {
    return this.call<unknown>("PATCH", `/properties/${propertyId}/members/${memberId}`, { role });
  }
  invite(propertyId: string, phone: string, role: "MANAGER" | "STAFF") {
    return this.call<unknown>("POST", `/properties/${propertyId}/invitations`, { phone, role });
  }
  plans() {
    return this.call<ApiBilling["plans"]>("GET", "/plans");
  }
  billing(propertyId: string) {
    return this.call<ApiBilling>("GET", `/properties/${propertyId}/billing`);
  }
  setPlan(propertyId: string, plan: ApiPlanCode, enabled: boolean) {
    return this.call<ApiBilling>("PUT", `/properties/${propertyId}/subscriptions/${plan}`, { enabled });
  }
  setCard(propertyId: string, authKey: string) {
    return this.call<ApiBilling>("POST", `/properties/${propertyId}/payment-method`, { authKey });
  }
  noticeSettings(propertyId: string) {
    return this.call<ApiNoticeSetting[]>("GET", `/properties/${propertyId}/notification-settings`);
  }
  setNoticeSettings(propertyId: string, items: ApiNoticeSetting[]) {
    return this.call<ApiNoticeSetting[]>("PUT", `/properties/${propertyId}/notification-settings`, { items });
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
}
