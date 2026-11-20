import type { AdminActivation, AdminAttention, AdminPilotKpi, AdminPropertyPilotDetail } from "./admin-pilot";
import type { ActionResult, ChannelId, PropertyType } from "./pms";

/* ── 디지털매출장부 (F2-01 · F2-03 · F2-05 · F2-06) ─────────── */

export interface LedgerChannelRow {
  channel: ChannelId;
  bookings: number;
  sales: number;
  /** 수수료율 (0.12 = 12%) */
  feeRate: number;
  adSpend: number;
}

export interface LedgerData {
  /** "2026-10" */
  month: string;
  sales: number;
  prevSales: number;
  /** 지난달 같은 날짜까지의 매출 (있으면 "전월 대비"에 이 값을 쓴다) */
  prevSalesToDate?: number;
  /** 실서버: 진행 중인 달이면 true — sales·fees·channels 는 오늘 체크인까지(확정) */
  partial?: boolean;
  /** 실서버: 내일 ~ 말일 체크인 예정 (sales 에 넣지 않음, 지난 달은 0) */
  upcoming?: UpcomingSales;
  adSpend: number;
  fees: number;
  /** 14일 이내 정산 예정 */
  settleSoon: number;
  /** 최근 10개월 월별 예약매출 */
  trend: readonly { month: string; sales: number }[];
  channels: readonly LedgerChannelRow[];
  calendar: { month: string; days: readonly SettlementDay[] };
  priceCompare: PriceCompare;
  stayMix: StayMix;
}

/** 아직 투숙 전인 예약 — 진행 중인 달의 내일 ~ 말일 체크인 */
export interface UpcomingSales {
  sales: number;
  bookings: number;
  commission: number;
}

/** 매출장부 동작 — 채널 광고비 직접 입력 (사장님·매니저) */
export interface LedgerActions {
  setAdSpend: (channel: ChannelId, month: string, amount: number) => Promise<ActionResult>;
}

export interface SettlementDay {
  date: string;
  items: readonly { channel: ChannelId; amount: number; done: boolean }[];
}

export interface PriceCompare {
  date: string;
  rooms: readonly { roomType: string; prices: Partial<Record<ChannelId, number>> }[];
  competitors: readonly { name: string; distance: string; roomType: string; price: number }[];
}

export interface StayMix {
  date: string;
  rooms: number;
  dayuse: { count: number; sales: number };
  overnight: { count: number; sales: number };
  /** 시간대별 대실 입실 수 (10시 ~ 22시) */
  hourly: readonly { hour: number; count: number }[];
}

/* ── 알바관리 (F5-01 ~ F5-04 · F5-06) ─────────────────────── */

export type StaffRole = "front" | "housekeeping" | "night" | "manager";
export type ContractStatus = "signed" | "sent" | "none";

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  pay: { type: "hourly" | "monthly"; amount: number };
  joined: string;
  phone: string;
  contract: ContractStatus;
  /** 퇴사일 (있으면 퇴사) */
  resigned?: string | null;
}

export interface AttendanceRow {
  staffId: string;
  /** "HH:mm" — 없으면 미기록 */
  in?: string;
  out?: string;
  /** scheduled: 오늘 근무인데 아직 시작 시각(주간 9시 · 야간 22시) 전 */
  status: "working" | "done" | "missing-out" | "off" | "late" | "scheduled";
}

/** 퇴근 기록이 빠진 근무 (최근 31일, 퇴사자 포함) — 기록 수정으로 고친다 */
export interface MissingClockOut {
  staffId: string;
  name: string;
  /** 근무일 YYYY-MM-DD */
  date: string;
  /** 출근 HH:mm */
  in: string;
}

/** unset: 근무표를 아직 안 짠 날 (미정 — 휴무와 다름) */
export type ShiftKind = "day" | "night" | "off" | "unset";

/** 근무표 기본 시간 (한국 시간) — 주간 09~16시 · 야간 22~다음 날 07시. 업장별 설정은 아직 없음 */
export const SHIFT_TIME: Readonly<Record<"day" | "night", { label: string; hours: string }>> = {
  day: { label: "낮", hours: "09–16시" },
  night: { label: "밤", hours: "22–07시" },
};

export interface PayrollRow {
  staffId: string;
  hours: number;
  nightHours: number;
  base: number;
  night: number;
  weekly: number;
  total: number;
  /** 실서버: 확정 전·확정·발송 (없으면 아직 계산만) */
  status?: "draft" | "confirmed" | "sent" | null;
}

export interface StaffData {
  date: string;
  month: string;
  minimumWage: number;
  members: readonly StaffMember[];
  today: readonly AttendanceRow[];
  /** 이번 달 근무시간 합계 */
  monthHours: Readonly<Record<string, number>>;
  week: { dates: readonly string[]; shifts: Readonly<Record<string, readonly ShiftKind[]>> };
  payroll: readonly PayrollRow[];
  /** 실서버: 퇴근 기록이 빠진 근무 */
  missingClockOut?: readonly MissingClockOut[];
}

/* ── 지출관리 (F6-01 · F6-03 · F6-04) ───────────────────────── */

export type ExpenseCategory = "amenity" | "utility" | "laundry" | "food" | "repair" | "tax" | "etc";

export interface ExpenseItem {
  id: string;
  date: string;
  vendor: string;
  category: ExpenseCategory;
  amount: number;
  source: "card" | "receipt" | "order" | "manual";
  memo?: string | null;
  /** 실서버: 영수증으로 등록한 지출이면 그 영수증 id (영수증 보기) */
  receiptId?: string | null;
}

export interface PurchaseOrder {
  id: string;
  date: string;
  item: string;
  qty: number;
  unit: string;
  vendor: string;
  amount: number;
  status: "requested" | "ordered" | "received" | "cancelled";
}

export interface ExpenseData {
  month: string;
  prevTotal: number;
  /** 지난달 같은 날짜까지의 지출 */
  prevTotalToDate?: number;
  sales: number;
  /** 실서버: 내일 ~ 말일 체크인 예정 매출 (sales 에 넣지 않음) */
  upcoming?: UpcomingSales;
  items: readonly ExpenseItem[];
  orders: readonly PurchaseOrder[];
  /** 영수증 인식 예시 (F6-03) */
  receiptSample: { vendor: string; date: string; amount: number; category: ExpenseCategory };
  /** 실서버: 올렸지만 아직 지출로 등록하지 않은 영수증 */
  pendingReceipts?: readonly ReceiptScan[];
}

export interface ReceiptScan {
  id: string;
  fileName: string;
  vendor: string | null;
  date: string | null;
  amount: number | null;
  category: ExpenseCategory | null;
}

/** summary: 매일 아침 8시 요약 (앱 알림만) */
export type NoticeKind = "review" | "settle" | "sync" | "billing" | "staff" | "summary";

export interface NoticeSetting {
  kind: NoticeKind;
  alimtalk: boolean;
  push: boolean;
  email: boolean;
}

/* ── 설정 · 구독 · 알림 (F0-02 · F0-03 · F0-04 · F0-08 · F0-09 · F0-13) ── */

export type AccountRole = "owner" | "manager" | "staff";

export interface AccountMember {
  /** 실서버: 구성원 id (권한 바꾸기) · 초대 id */
  id?: string;
  name: string;
  phone: string;
  role: AccountRole;
  status: "active" | "invited";
  /** 초대 보낸 날 YYYY-MM-DD (초대 중일 때) */
  invitedAt?: string;
}

export interface PlanOption {
  id: string;
  name: string;
  price: number;
  desc: string;
  stage: string;
  available: boolean;
}

export interface BillingRecord {
  date: string;
  item: string;
  amount: number;
  status: "paid" | "failed";
}

export interface PropertyProfile {
  name: string;
  type: PropertyType;
  address: string;
  rooms: number;
  bizNo: string;
  owner: string;
  phone: string;
}

export interface NotificationItem {
  id: string;
  /** summary: 아침 요약 — 여러 줄 */
  kind: "review" | "settle" | "sync" | "billing" | "staff" | "summary";
  text: string;
  at: string;
  unread: boolean;
  /** 누르면 갈 화면 (업장 안 경로) */
  link?: string;
  /** 여러 업장 통합 알림에서 — 어느 업장 알림인지 */
  propertyId?: string;
  propertyName?: string;
}

/** 알림 한 건 읽음 */
export type ReadNotificationAction = (id: string) => Promise<ActionResult>;

export interface SettingsData {
  profile: PropertyProfile;
  accounts: readonly AccountMember[];
  plans: readonly PlanOption[];
  subscribed: readonly string[];
  trialEnds: string;
  nextBilling: string;
  card: string;
  billing: readonly BillingRecord[];
  notifications: readonly NotificationItem[];
  /** 실서버: 무료 체험 중인지 · 결제 카드 등록 여부 · 알림 받기 설정 */
  inTrial?: boolean;
  hasCard?: boolean;
  noticeSettings?: readonly NoticeSetting[];
  /** 실서버: 새 업장 무료 체험 일수 */
  trialDays?: number;
  /** 실서버: 실증 업장 (endsAt 마지막 날) */
  pilot?: { group: string; endsAt: string; active: boolean } | null;
  /** 실서버: 실증 기간이라 결제하지 않음 */
  billingHeld?: boolean;
  /**
   * 구독·결제를 볼 수 있는지 — 실서버에서 결제 정보를 못 받으면(매니저 등) false.
   * false 면 plans·billing 등은 빈 값이고 화면은 예시 대신 안내만 보인다.
   */
  billingVisible?: boolean;
}

/* ── 운영자 백오피스 · 문의 (F0-14 · F0-16) ─────────────────── */

export interface AdminProperty {
  id: string;
  name: string;
  type: PropertyType;
  region: string;
  plans: readonly string[];
  channels: number;
  syncErrors: number;
  joined: string;
  manager: string;
  /** 사장님 이름 · 휴대폰 (검색용 — 실서버에서만) */
  owner?: string;
  ownerPhone?: string;
  /** 사장님 계정 id — 사장님 단위로 묶어 보기 */
  ownerId?: string;
  /** 최근 접속 (YYYY-MM-DD HH:mm) — 사장님 · 매니저 중 가장 최근 */
  lastLoginOwner?: string | null;
  lastLoginManager?: string | null;
  /** 실증 묶음 (예: 대전 1차) */
  pilotGroup?: string | null;
  activation?: AdminActivation | null;
}

/** 운영자가 보는 업장 상세 (GET /admin/properties/:id) */
export interface AdminPropertyDetail extends Partial<AdminPropertyPilotDetail> {
  id: string;
  name: string;
  type: PropertyType;
  address: string;
  rooms: number;
  bizNo: string;
  bizVerified: boolean;
  ownerName: string;
  joined: string;
  manager: { id: string; name: string } | null;
  subscriptions: readonly { name: string; monthlyPrice: number; status: string; trialEndsAt: string | null }[];
  channels: readonly {
    channel: ChannelId;
    name: string;
    status: string;
    lastSyncedAt: string | null;
    lastError: string | null;
    fails: number;
  }[];
  members: readonly { role: "owner" | "manager" | "staff"; name: string; phone: string; lastLoginAt: string | null }[];
  payments: readonly {
    id: string;
    month: string;
    description: string;
    amount: number;
    status: string;
    paidAt: string;
  }[];
}

/** 담당 운영자로 고를 수 있는 운영자 계정 */
export interface AdminOperator {
  id: string;
  name: string;
  email: string;
  active: boolean;
}

/** 운영자 업장 상세 · 담당 운영자 지정 */
export interface AdminPropertyActions {
  propertyDetail: (propertyId: string) => Promise<ActionResult<AdminPropertyDetail>>;
  /** managerId null: 담당 해제 */
  assignManager: (propertyId: string, managerId: string | null) => Promise<ActionResult<AdminPropertyDetail>>;
  operators: () => Promise<ActionResult<AdminOperator[]>>;
}

export interface Inquiry {
  id: string;
  at: string;
  name: string;
  property: string;
  type: PropertyType;
  rooms: number;
  kind: "도입" | "파트너";
  message: string;
  status: "new" | "contacted" | "done";
}

export interface AdminSyncIssue {
  /** 실서버에서만 — 다시 수집·알림 보낼 때 쓰는 채널 연결 id */
  id?: string;
  property: string;
  channel: ChannelId;
  since: string;
  reason: string;
  fails?: number;
}

export interface AdminOverview {
  properties: number;
  newProperties: number;
  trialProperties: number;
  payingProperties: number;
  monthlyRevenue: number;
  syncIssues: number;
  newInquiries: number;
}

export interface AdminData {
  properties: readonly AdminProperty[];
  inquiries: readonly Inquiry[];
  syncIssues: readonly AdminSyncIssue[];
  /** 실서버 요약 — 없으면 목록에서 센다 */
  overview?: AdminOverview;
  /** 로그인한 운영자 */
  me?: { name: string; email: string; role: "SUPER" | "OPERATOR" };
  /** 실증 KPI (첫 묶음) · 연락할 곳 */
  pilot?: AdminPilotKpi;
  attention?: AdminAttention;
}

/* ── 리뷰 답글 설정 (F1-04 · F1-08) ────────────────────────── */

export interface ReplySettings {
  tone: "polite" | "friendly";
  signature: string;
  mustInclude: string;
  banned: string;
  autoReply: { enabled: boolean; minRating: number; hours: "always" | "daytime" };
}

/* ── 계산 규칙 (화면·저장소 공통) ─────────────────────────── */

/** 야간수당 50% 가산 · 주휴수당(주 15시간 이상, 주 8시간분) 단순 계산 — 실제 노무 규칙은 확정 필요 (F5-04) */
export function computePayroll(member: StaffMember, hours: number, nightHours: number, weeksFull: number): PayrollRow {
  if (member.pay.type === "monthly") {
    return {
      staffId: member.id,
      hours,
      nightHours,
      base: member.pay.amount,
      night: 0,
      weekly: 0,
      total: member.pay.amount,
    };
  }
  const rate = member.pay.amount;
  const base = Math.round(hours * rate);
  const night = Math.round(nightHours * rate * 0.5);
  const weekly = Math.round(weeksFull * 8 * rate);
  return { staffId: member.id, hours, nightHours, base, night, weekly, total: base + night + weekly };
}

export function ledgerTotals(rows: readonly LedgerChannelRow[]) {
  const sales = rows.reduce((s, r) => s + r.sales, 0);
  const fees = rows.reduce((s, r) => s + Math.round(r.sales * r.feeRate), 0);
  const adSpend = rows.reduce((s, r) => s + r.adSpend, 0);
  return { sales, fees, adSpend };
}

/** 직원 본인 출퇴근 화면 (F5-02 직원 모바일) */
export interface StaffMeData {
  date: string;
  property: string;
  employee: { id: string; name: string; role: StaffRole };
  state: "ready" | "working" | "done";
  today: { in?: string; out?: string; shift: ShiftKind };
  week: { dates: readonly string[]; shifts: readonly ShiftKind[] };
  month: { hours: number; nightHours: number; estimatedPay: number };
  records: readonly { date: string; in: string; out?: string; hours?: number; edited: boolean }[];
  /** 다음 주 내 근무 (근무표 없는 날은 unset) */
  nextWeek?: { dates: readonly string[]; shifts: readonly ShiftKind[] };
  /** 오늘 같이 일하는 사람 — 오늘 낮·밤 근무이거나 출근한 동료 (shift null: 근무표 없이 출근) */
  coworkers?: readonly { name: string; shift: "day" | "night" | null; working: boolean }[];
  /** 이번 달 급여 내역 — 사장님 급여 화면과 같은 계산 */
  pay?: StaffMePay;
  /** 방금 누른 퇴근을 되돌릴 수 있는 마감 시각 (ISO, 퇴근 후 5분) — 없으면 되돌릴 수 없음 */
  undoOutUntil?: string | null;
}

/** 직원 본인 이번 달 급여 내역 — 시급제: 기본(시간 × 시급) + 야간 가산 + 주휴. 월급제: base = 그 달 월급(일할) */
export interface StaffMePay {
  type: "hourly" | "monthly";
  /** 시급 (시급제) */
  rate?: number;
  /** 월급 (월급제) */
  monthly?: number;
  hours: number;
  base: number;
  nightHours: number;
  night: number;
  /** 주휴 시간 (시급제) */
  weeklyHours?: number;
  weekly: number;
  total: number;
  /** null: 계산만 · draft 확정 전 · confirmed 확정 · sent 명세 받음 */
  status: "draft" | "confirmed" | "sent" | null;
}

/** 직원 한 명의 한 달 출퇴근 (알바관리 근태 '이번 달 기록', P-11) */
export interface StaffMonthAttendance {
  month: string;
  staffId: string;
  name: string;
  /** 그 달 급여가 확정돼 고칠 수 없음 */
  locked: boolean;
  totalHours: number;
  workedDays: number;
  days: readonly StaffMonthDay[];
}

export interface StaffMonthDay {
  date: string;
  /** 근무표 (없으면 unset) */
  shift: ShiftKind;
  in?: string;
  out?: string;
  hours?: number;
  /** 고친 사유 */
  memo?: string;
  edited: boolean;
  /** 고친 사람 이름 */
  editedBy?: string;
  /** done 퇴근 · working 근무 중 · missing-out 퇴근 누락 · absent 근무일인데 기록 없음 · scheduled 오늘·앞으로 근무 */
  status: "done" | "working" | "missing-out" | "absent" | "scheduled";
}

/* ── 현장 업무 (F7-01 객실 상태 · F7-02 인수인계 · F7-03 공지) ─── */

export type RoomStatus = "ready" | "occupied" | "dirty" | "cleaning" | "inspect" | "outOfOrder";

/** 상태판 순서 — 손이 가야 하는 상태부터 */
export const ROOM_STATUSES: readonly RoomStatus[] = ["dirty", "cleaning", "inspect", "ready", "occupied", "outOfOrder"];

/** 지금 상태에서 보통 다음에 하는 일 (판매 가능·판매 중지는 정해진 다음 단계 없음) */
export const ROOM_NEXT: Readonly<Record<RoomStatus, RoomStatus | null>> = {
  occupied: "dirty",
  dirty: "cleaning",
  cleaning: "inspect",
  inspect: "ready",
  ready: null,
  outOfOrder: null,
};

export interface RoomUnit {
  id: string;
  /** 호수 — "201", "별관-3" */
  number: string;
  floor: number | null;
  roomType: string | null;
  status: RoomStatus;
  memo: string | null;
  /** ISO 시각 */
  changedAt: string;
  changedBy: string | null;
}

export interface RoomLog {
  from: RoomStatus | null;
  to: RoomStatus;
  memo: string | null;
  by: string | null;
  at: string;
}

export type MemberRole = "owner" | "manager" | "staff";

export interface OpsNote {
  id: string;
  kind: "handover" | "notice";
  /** 인수인계를 쓴 근무 */
  shift: "day" | "night" | null;
  body: string;
  pinned: boolean;
  author: string;
  isMine: boolean;
  createdAt: string;
  readByMe: boolean;
  readers: readonly { name: string; readAt: string }[];
}

export interface OpsData {
  date: string;
  myRole: MemberRole;
  /** 업장 구성원 수 — "확인 3/5" */
  memberCount: number;
  rooms: readonly RoomUnit[];
  notices: readonly OpsNote[];
  handovers: readonly OpsNote[];
  unread: number;
}

export interface RoomInput {
  number: string;
  floor?: number;
  roomType?: string;
}

export interface OpsActions {
  setRoomStatus: (roomId: string, status: RoomStatus, memo?: string) => Promise<ActionResult>;
  addRooms: (rooms: readonly RoomInput[]) => Promise<ActionResult>;
  /** 호수·층·객실 타입 고치기 (사장님·매니저) */
  updateRoom: (roomId: string, room: RoomInput) => Promise<ActionResult>;
  /** 객실 삭제 — 상태 기록도 함께 (사장님·매니저) */
  removeRoom: (roomId: string) => Promise<ActionResult>;
  roomLogs: (roomId: string) => Promise<ActionResult<RoomLog[]>>;
  addNote: (input: {
    kind: OpsNote["kind"];
    body: string;
    shift?: "day" | "night";
    pinned?: boolean;
  }) => Promise<ActionResult>;
  readNote: (noteId: string) => Promise<ActionResult>;
  pinNote: (noteId: string, pinned: boolean) => Promise<ActionResult>;
  removeNote: (noteId: string) => Promise<ActionResult>;
}

/** "201-210" · "301, 302, 305" · "별관-1~별관-4" → 호수 목록 (최대 300개) */
export function parseRoomNumbers(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[,\n\s]+/)) {
    const part = raw.trim();
    if (!part) continue;
    const range = /^(.*?)(\d+)\s*[-~]\s*\1?(\d+)$/.exec(part);
    if (range) {
      const [, prefix, a, b] = range;
      const from = Number(a);
      const to = Number(b);
      if (to >= from && to - from < 300) {
        for (let n = from; n <= to; n++) out.push(`${prefix}${String(n).padStart(a.length, "0")}`);
        continue;
      }
    }
    out.push(part);
  }
  return [...new Set(out)].slice(0, 300);
}

/** 호수에서 층 추정 — "201" → 2, "1203" → 12, 그 밖은 없음 */
export function floorOf(roomNo: string): number | undefined {
  return /^\d{3,4}$/.test(roomNo) ? Math.floor(Number(roomNo) / 100) : undefined;
}
