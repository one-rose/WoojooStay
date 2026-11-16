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
  status: "working" | "done" | "missing-out" | "off" | "late";
}

export type ShiftKind = "day" | "night" | "off";

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

export type NoticeKind = "review" | "settle" | "sync" | "billing" | "staff";

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
  kind: "review" | "settle" | "sync" | "billing" | "staff";
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
