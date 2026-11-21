import { kstMinute as adminKstMinute, toActivation } from "./admin-pilot";
import type {
  BillingState,
  PortfolioAlertKind,
  PortfolioData,
  PortfolioPeople,
  PortfolioReport,
  ReviewInbox,
  ChannelAccount,
  AdminData,
  AccountMember,
  ChannelConnection,
  ExpenseCategory,
  ExpenseData,
  LedgerData,
  MemberRole,
  OpsData,
  OpsNote,
  RoomLog,
  RoomStatus,
  RoomUnit,
  SettingsData,
  StaffData,
  StaffMeData,
  StaffMonthAttendance,
  ChannelId,
  DashboardData,
  GuestReview,
  Inquiry,
  NotificationItem,
  PropertyType,
  ReplySettings,
  ReviewPhotoId,
  ShiftKind,
} from "@/core";
import type {
  ApiPortfolio,
  ApiPortfolioPeople,
  ApiPortfolioReport,
  ApiReviewInbox,
  ApiBilling,
  ApiExpenses,
  ApiLedger,
  ApiOps,
  ApiOpsNote,
  ApiRoom,
  ApiRoomLog,
  ApiRoomStatus,
  ApiMembers,
  ApiNoticeSetting,
  ApiProperty,
  ApiClockMethod,
  ApiStaff,
  ApiStaffMe,
  ApiStaffMonth,
  ApiAdmin,
  ApiAdminOverview,
  ApiAdminProperty,
  ApiChannel,
  ApiChannelState,
  ApiDashboard,
  ApiInquiry,
  ApiNotification,
  ApiReplySettings,
  ApiReview,
  ApiShift,
  ApiSyncIssue,
} from "./client";
import { kstDay } from "@/shared";

/** API 응답 → 화면(core) 타입 */

const PHOTOS: readonly ReviewPhotoId[] = ["lobby", "hall", "breakfast", "room", "cityroom"];

export const toChannelId = (c: ApiChannel) => c.toLowerCase() as ChannelId;
export const toApiChannel = (c: ChannelId) => c.toUpperCase() as ApiChannel;

const KST = 9 * 3_600_000;
/** ISO → "YYYY-MM-DD HH:mm" (한국 시간) */
const kst = (iso: string) => new Date(new Date(iso).getTime() + KST).toISOString().slice(0, 16).replace("T", " ");
/** ISO → "HH:mm" 오늘이면, 아니면 "MM.DD HH:mm" */
const syncTime = (iso: string | null, today: string) => {
  if (!iso) return "-";
  const t = kst(iso);
  return t.slice(0, 10) === today ? t.slice(11) : `${t.slice(5, 10).replace("-", ".")} ${t.slice(11)}`;
};

export function toPropertyType(t: string): PropertyType {
  const v = t.toLowerCase();
  return v === "hotel" || v === "motel" || v === "pension" || v === "guesthouse" ? v : "hotel";
}

export function toReview(r: ApiReview): GuestReview {
  return {
    id: r.id,
    channel: toChannelId(r.channel),
    author: r.author,
    rating: Math.min(5, Math.max(1, r.rating)) as GuestReview["rating"],
    postedAt: kst(r.postedAt),
    stayDate: r.stayDate ?? "",
    roomType: r.roomType ?? "",
    body: r.body,
    photos: r.photos.filter((p): p is ReviewPhotoId => (PHOTOS as readonly string[]).includes(p)),
    status: r.status === "POSTED" ? "posted" : "unanswered",
    sentiment: r.sentiment === "POSITIVE" ? "positive" : "improve",
    aiDraft: r.draft?.text ?? "",
    aiKeywords: r.draft?.keywords ?? [],
    draftGenerator: r.draft?.generator === "template" ? "template" : r.draft?.generator === "ai" ? "ai" : undefined,
    reply: r.reply?.text,
    replyExternal: r.reply?.via === "EXTERNAL" || undefined,
    needsReview: r.needsReview || undefined,
  };
}

/** 통합 리뷰함 — 리뷰마다 업장 ID 를 붙인다 */
export function toReviewInbox(d: ApiReviewInbox): ReviewInbox {
  return {
    properties: d.properties,
    channels: d.channels.map((c) => ({
      channel: toChannelId(c.channel),
      name: c.name,
      replyMode: c.replyMode === "API" ? "api" : "copy",
      status: "ok",
      lastSyncedAt: "-",
    })),
    reviews: d.items.map((r) => ({ ...toReview(r), propertyId: r.propertyId })),
    truncated: d.truncated,
  };
}

const STATUS: Record<string, ChannelConnection["status"]> = {
  CONNECTED: "ok",
  SYNCING: "syncing",
  AUTH_EXPIRED: "error",
  ERROR: "error",
};

export function toChannels(d: Pick<ApiDashboard, "channels" | "date">): ChannelConnection[] {
  return d.channels.map((c) => ({
    channel: toChannelId(c.channel),
    name: c.name,
    replyMode: c.replyMode === "API" ? "api" : "copy",
    status: STATUS[c.status] ?? "syncing",
    lastSyncedAt: syncTime(c.lastSyncedAt, d.date),
  }));
}

export function toChannelAccounts(list: ApiChannelState[], today: string): ChannelAccount[] {
  return list.map((c) => ({
    channel: toChannelId(c.channel),
    name: c.name,
    replyMode: c.replyMode === "API" ? "api" : "copy",
    connected: c.connected,
    status: c.connected && c.status ? (STATUS[c.status] ?? "syncing") : null,
    authExpired: c.status === "AUTH_EXPIRED",
    lastSyncedAt: syncTime(c.lastSyncedAt, today),
  }));
}

export function toDashboard(d: ApiDashboard): DashboardData {
  return {
    date: d.date,
    property: { id: d.property.id, name: d.property.name, type: toPropertyType(d.property.type), rooms: d.property.rooms },
    todaySales: { amount: d.todaySales.amount, yesterday: d.todaySales.yesterday, bookings: d.todaySales.bookings },
    unanswered: d.unanswered,
    settlementWeek: d.settlementWeek,
    channelSales: d.channelSales.map((c) => ({ channel: toChannelId(c.channel), amount: c.amount })),
    settlements: d.settlements.map((s) => ({ date: s.date, channel: toChannelId(s.channel), amount: s.amount })),
    channels: toChannels(d),
  };
}

export function toReplySettings(s: ApiReplySettings): ReplySettings {
  return {
    tone: s.tone === "POLITE" ? "polite" : "friendly",
    signature: s.signature,
    mustInclude: s.mustInclude,
    banned: s.banned.join(", "),
    autoReply: {
      enabled: s.autoEnabled,
      minRating: s.autoMinRating,
      hours: s.autoHours === "ALWAYS" ? "always" : "daytime",
    },
  };
}

export function fromReplySettings(s: ReplySettings): ApiReplySettings {
  return {
    tone: s.tone === "polite" ? "POLITE" : "FRIENDLY",
    signature: s.signature,
    mustInclude: s.mustInclude,
    banned: s.banned
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean),
    autoEnabled: s.autoReply.enabled,
    autoMinRating: s.autoReply.minRating,
    autoHours: s.autoReply.hours === "always" ? "ALWAYS" : "DAYTIME",
  };
}

const KIND: Record<ApiNotification["kind"], NotificationItem["kind"]> = {
  REVIEW: "review",
  SETTLE: "settle",
  SYNC: "sync",
  BILLING: "billing",
  STAFF: "staff",
  SUMMARY: "summary",
};

export function toNotification(n: ApiNotification): NotificationItem {
  const t = kst(n.createdAt);
  return {
    id: n.id,
    kind: KIND[n.kind],
    text: n.text,
    at: `${t.slice(5, 10).replace("-", ".")} ${t.slice(11)}`,
    unread: !n.readAt,
    link: n.link ?? undefined,
    propertyId: n.propertyId,
    propertyName: n.propertyName,
  };
}

/* ── 운영자 ── */

const PLAN_ID: Record<string, string> = { REVIEW: "review", LEDGER: "ledger", STAFF: "staff", EXPENSE: "expense" };
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "-");
const kstMinute = (iso: string) =>
  new Date(iso).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(0, 16).replace("T", " ");

const SYNC_REASON: Record<string, string> = {
  AUTH_EXPIRED: "채널 로그인 만료 — 사장님 재인증 필요",
  ERROR: "수집 실패가 이어짐",
};

export function toAdminData(d: {
  me: ApiAdmin;
  overview: ApiAdminOverview;
  properties: ApiAdminProperty[];
  syncIssues: ApiSyncIssue[];
  inquiries: ApiInquiry[];
}): AdminData {
  return {
    me: { name: d.me.name, email: d.me.email, role: d.me.role },
    overview: d.overview,
    properties: d.properties.map((p) => ({
      id: p.id,
      name: p.name,
      type: toPropertyType(p.type),
      region: p.address.split(/\s+/).slice(0, 2).join(" "),
      plans: p.subscriptions
        .filter((x) => x.status !== "CANCELLED")
        .map((x) => PLAN_ID[x.planCode])
        .filter(Boolean),
      channels: p.channelCount,
      syncErrors: p.issueCount,
      joined: day(p.createdAt),
      manager: p.manager?.name ?? "미지정",
      owner: p.ownerName,
      ownerPhone: p.ownerPhone ?? undefined,
      ownerId: p.owner?.id,
      lastLoginOwner: adminKstMinute(p.lastLogin?.owner),
      lastLoginManager: adminKstMinute(p.lastLogin?.manager),
      pilotGroup: p.pilot?.group ?? null,
      activation: toActivation(p.activation),
    })),
    syncIssues: d.syncIssues.map((s) => ({
      id: s.id,
      property: s.property.name,
      channel: toChannelId(s.channel),
      since: s.lastSyncedAt ? `${kstMinute(s.lastSyncedAt)} 이후` : "첫 수집 전",
      reason: s.lastError ?? SYNC_REASON[s.status] ?? `수집 실패 ${s.consecutiveFails}회`,
      fails: s.consecutiveFails,
    })),
    inquiries: d.inquiries.map((q) => ({
      id: q.id,
      at: day(q.createdAt),
      name: q.contactName,
      property: q.propertyName ?? q.phone,
      type: q.propertyType ? toPropertyType(q.propertyType) : "hotel",
      rooms: q.rooms ?? 0,
      kind: q.type === "PARTNER" ? "파트너" : "도입",
      message: q.message,
      status: q.status.toLowerCase() as Inquiry["status"],
    })),
  };
}

/* ── 매출장부 · 알바 · 지출 · 설정 ── */

const lower = <T extends string>(v: T) => v.toLowerCase() as Lowercase<T>;
const ymd = (iso: string) => kstDay(iso);
/** 숫자만인 번호 → 010-1234-5678 (가린 번호 010-****-1234 는 그대로) */
export const formatPhone = (p: string) => p.replace(/^(\d{3})(\d{3,4})(\d{4})$/, "$1-$2-$3");

export function toLedger(l: ApiLedger): LedgerData {
  return {
    month: l.month,
    sales: l.sales,
    prevSales: l.prevSales,
    prevSalesToDate: l.prevSalesToDate,
    partial: l.partial,
    upcoming: l.upcoming,
    adSpend: l.adSpend,
    fees: l.fees,
    settleSoon: l.settleSoon,
    trend: l.trend,
    channels: l.channels.map((c) => ({
      channel: toChannelId(c.channel),
      bookings: c.bookings,
      sales: c.sales,
      feeRate: c.feeRate,
      adSpend: c.adSpend,
    })),
    calendar: {
      month: l.calendar.month,
      days: l.calendar.days.map((d) => ({
        date: d.date,
        items: d.items.map((i) => ({ channel: toChannelId(i.channel), amount: i.amount, done: i.done })),
      })),
    },
    priceCompare: {
      date: l.priceCompare?.date ?? l.month,
      rooms: (l.priceCompare?.rooms ?? []).map((r) => ({
        roomType: r.roomType,
        prices: Object.fromEntries(
          Object.entries(r.prices).map(([ch, price]) => [toChannelId(ch as ApiChannel), price]),
        ),
      })),
      competitors: l.priceCompare?.competitors ?? [],
    },
    stayMix: l.stayMix,
  };
}

const JOB: Record<ApiStaff["members"][number]["jobRole"], StaffData["members"][number]["role"]> = {
  MANAGER: "manager",
  FRONT: "front",
  NIGHT: "night",
  HOUSEKEEPING: "housekeeping",
};

/** 출퇴근 방법 — GPS 위치 · QR · REQUEST 요청 승인 · MANUAL 수기 */
const toClockMethod = (m: ApiClockMethod | null | undefined) => (m ? lower(m) : null);

export function toStaff(d: ApiStaff): StaffData {
  return {
    date: d.date,
    month: d.month,
    minimumWage: d.minimumWage,
    members: d.members.map((m) => ({
      id: m.id,
      name: m.name,
      role: JOB[m.jobRole],
      pay: { type: m.payType === "HOURLY" ? "hourly" : "monthly", amount: m.payAmount },
      joined: m.hiredDate,
      phone: formatPhone(m.phone),
      contract: m.contract === "SIGNED" ? "signed" : m.contract === "SENT" ? "sent" : "none",
      resigned: m.resignedDate,
    })),
    today: d.today.map((a) => ({
      staffId: a.employeeId,
      in: a.in ?? undefined,
      out: a.out ?? undefined,
      status: a.status,
      method: toClockMethod(a.method),
      outMethod: toClockMethod(a.outMethod),
    })),
    clockRequests: (d.clockRequests ?? []).map((r) => ({
      id: r.id,
      staffId: r.employeeId,
      name: r.name ?? "",
      type: r.type === "IN" ? ("in" as const) : ("out" as const),
      date: r.date,
      time: r.time,
      reason: r.reason,
      distanceM: r.distanceM,
    })),
    monthHours: d.monthHours,
    week: {
      dates: d.week.dates,
      shifts: Object.fromEntries(Object.entries(d.week.shifts).map(([id, list]) => [id, list.map(toShift)])),
    },
    payroll: d.payroll.map((p) => ({
      staffId: p.employeeId,
      hours: p.hours,
      nightHours: p.nightHours,
      base: p.base,
      night: p.night,
      weekly: p.weekly,
      total: p.total,
      status: p.status ? lower(p.status) : null,
    })),
    missingClockOut: (d.missingClockOut ?? []).map((m) => ({
      staffId: m.employeeId,
      name: m.name,
      date: m.date,
      in: m.in,
    })),
  };
}

export function toExpenses(d: ApiExpenses, sample: ExpenseData["receiptSample"]): ExpenseData {
  return {
    month: d.month,
    prevTotal: d.prevTotal,
    prevTotalToDate: d.prevTotalToDate,
    sales: d.sales,
    upcoming: d.upcoming,
    items: d.items.map((e) => ({
      id: e.id,
      date: e.date,
      vendor: e.vendor,
      category: lower(e.category),
      amount: e.amount,
      source: lower(e.source),
      memo: e.memo,
      receiptId: e.receiptId ?? null,
    })),
    orders: d.orders.map((o) => ({
      id: o.id,
      date: ymd(o.date),
      item: o.item,
      qty: o.qty,
      unit: o.unit,
      vendor: o.vendor,
      amount: o.amount,
      status: lower(o.status),
    })),
    receiptSample: sample,
    pendingReceipts: d.pendingReceipts.map((r) => ({
      id: r.id,
      fileName: r.fileName,
      vendor: r.reading.vendor,
      date: r.reading.date,
      amount: r.reading.amount,
      category: r.reading.category ? (lower(r.reading.category) as ExpenseCategory) : null,
    })),
  };
}

export const toPlanOptions = (plans: ApiBilling["plans"]) =>
  plans.map((p) => ({
    id: lower(p.code) as string,
    name: p.name,
    price: p.monthlyPrice,
    desc: p.description,
    stage: p.stage,
    available: p.available,
  }));

const card = (c: ApiBilling["card"]) => (c ? `${c.name} ****-${c.last4}` : "등록된 카드 없음");

export function toSettings(
  base: SettingsData,
  d: { property: ApiProperty; members: ApiMembers; billing: ApiBilling | null; notices: ApiNoticeSetting[] },
): SettingsData {
  const accounts: AccountMember[] = [
    ...d.members.members.map((m) => ({
      id: m.id,
      name: m.name,
      phone: formatPhone(m.phone),
      role: lower(m.role),
      status: "active" as const,
    })),
    ...d.members.invitations.map((i) => ({
      id: i.id,
      name: "초대 중",
      phone: formatPhone(i.phone),
      role: lower(i.role),
      status: "invited" as const,
      invitedAt: i.createdAt ? ymd(i.createdAt) : undefined,
    })),
  ];
  const b = d.billing;
  return {
    ...base,
    profile: {
      name: d.property.name,
      type: toPropertyType(d.property.type),
      address: d.property.address,
      rooms: d.property.rooms,
      bizNo: d.property.bizNo.replace(/^(\d{3})(\d{2})(\d{5})$/, "$1-$2-$3"),
      owner: d.property.ownerName,
      phone: d.property.phone ?? "",
      clock: d.property.clock
        ? { latitude: d.property.clock.latitude, longitude: d.property.clock.longitude, radiusM: d.property.clock.radiusM }
        : undefined,
    },
    accounts,
    // 결제 정보를 못 받으면(매니저 등) 예시 값으로 채우지 않고 비운다 — 화면은 안내만
    ...(b
      ? {
          billingVisible: true,
          plans: toPlanOptions(b.plans),
          subscribed: b.subscribed.map(lower),
          trialEnds: b.trialEnds ?? "-",
          nextBilling: b.nextBilling ?? "-",
          card: card(b.card),
          hasCard: b.card !== null,
          inTrial: b.inTrial,
          trialDays: b.trialDays,
          pilot: b.pilot ? { group: b.pilot.group, endsAt: b.pilot.endsAt, active: b.pilot.active } : null,
          billingHeld: b.billingHeld ?? false,
          billing: b.payments.map((p) => ({
            date: ymd(p.date),
            item: p.description,
            amount: p.amount,
            status: p.status === "PAID" ? "paid" : "failed",
          })),
        }
      : {
          billingVisible: false,
          plans: [],
          subscribed: [],
          trialEnds: "-",
          nextBilling: "-",
          card: "",
          hasCard: false,
          inTrial: false,
          billing: [],
        }),
    noticeSettings: d.notices.map((n) => ({ ...n, kind: lower(n.kind) })),
  };
}

/** 근무표 없는 날(null)은 미정 */
const toShift = (s: ApiShift | null): ShiftKind => (s ? lower(s) : "unset");

export function toStaffMe(d: ApiStaffMe): StaffMeData {
  return {
    date: d.date,
    property: d.property,
    employee: { id: d.employee.id, name: d.employee.name, role: JOB[d.employee.jobRole] },
    state: d.state,
    today: { in: d.today.in ?? undefined, out: d.today.out ?? undefined, shift: toShift(d.today.shift) },
    week: { dates: d.week.dates, shifts: d.week.shifts.map(toShift) },
    month: d.month,
    records: d.records.map((r) => ({ ...r, out: r.out ?? undefined, hours: r.hours ?? undefined })),
    nextWeek: d.nextWeek ? { dates: d.nextWeek.dates, shifts: d.nextWeek.shifts.map(toShift) } : undefined,
    coworkers: d.coworkers?.map((c) => ({ name: c.name, shift: c.shift ? lower(c.shift) : null, working: c.working })),
    pay: d.pay
      ? {
          type: d.pay.payType === "HOURLY" ? "hourly" : "monthly",
          rate: d.pay.rate ?? undefined,
          monthly: d.pay.monthly ?? undefined,
          hours: d.pay.hours,
          base: d.pay.base,
          nightHours: d.pay.nightHours,
          night: d.pay.night,
          weeklyHours: d.pay.weeklyHours ?? undefined,
          weekly: d.pay.weekly,
          total: d.pay.total,
          status: d.pay.status ? lower(d.pay.status) : null,
        }
      : undefined,
    undoOutUntil: d.undoOutUntil ?? null,
    clock: d.clock ? { locationSet: d.clock.locationSet, radiusM: d.clock.radiusM } : undefined,
    requests: d.requests?.map((r) => {
      const at = kstMinute(r.requestedAt);
      return {
        id: r.id,
        type: r.type === "IN" ? ("in" as const) : ("out" as const),
        status: lower(r.status),
        date: at.slice(0, 10),
        time: at.slice(11, 16),
        reason: r.reason,
        rejectReason: r.rejectReason,
      };
    }),
  };
}

export function toStaffMonth(d: ApiStaffMonth): StaffMonthAttendance {
  return {
    month: d.month,
    staffId: d.employee.id,
    name: d.employee.name,
    locked: d.locked,
    totalHours: d.totalHours,
    workedDays: d.workedDays,
    days: d.days.map((x) => ({
      date: x.workDate,
      shift: toShift(x.shift),
      in: x.clockIn ?? undefined,
      out: x.clockOut ?? undefined,
      hours: x.hours ?? undefined,
      memo: x.memo ?? undefined,
      edited: x.edited,
      editedBy: x.editedBy ?? undefined,
      status: x.clockOut
        ? "done"
        : x.working
          ? "working"
          : x.missingOut
            ? "missing-out"
            : x.absent
              ? "absent"
              : x.clockIn
                ? "working"
                : "scheduled",
    })),
  };
}

/* 현장 업무 (F7) */
const ROOM_STATUS: Record<ApiRoomStatus, RoomStatus> = {
  READY: "ready",
  OCCUPIED: "occupied",
  DIRTY: "dirty",
  CLEANING: "cleaning",
  INSPECT: "inspect",
  OUT_OF_ORDER: "outOfOrder",
};
export const toApiRoomStatus = (s: RoomStatus) =>
  (Object.keys(ROOM_STATUS) as ApiRoomStatus[]).find((k) => ROOM_STATUS[k] === s)!;

export const toRoom = (r: ApiRoom): RoomUnit => ({ ...r, status: ROOM_STATUS[r.status] });

export const toRoomLog = (l: ApiRoomLog): RoomLog => ({
  ...l,
  from: l.from ? ROOM_STATUS[l.from] : null,
  to: ROOM_STATUS[l.to],
});

const toOpsNote = (n: ApiOpsNote): OpsNote => ({
  ...n,
  kind: n.kind === "NOTICE" ? "notice" : "handover",
  shift: n.shift === "DAY" ? "day" : n.shift === "NIGHT" ? "night" : null,
});

export function toOps(d: ApiOps): OpsData {
  return {
    date: d.date,
    myRole: d.myRole.toLowerCase() as MemberRole,
    memberCount: d.memberCount,
    rooms: d.rooms.map(toRoom),
    notices: d.notices.map(toOpsNote),
    handovers: d.handovers.map(toOpsNote),
    unread: d.unread,
  };
}

/** 여러 업장 통합 현황 */
export function toPortfolioPeople(d: ApiPortfolioPeople): PortfolioPeople {
  const lower = <T extends string>(v: T) => v.toLowerCase() as Lowercase<T>;
  return {
    properties: d.properties,
    people: d.people.map((p) => ({
      ...p,
      phone: formatPhone(p.phone),
      roles: Object.fromEntries(Object.entries(p.roles).map(([id, r]) => [id, lower(r)])),
    })),
    invitations: d.invitations.map((i) => ({
      ...i,
      phone: formatPhone(i.phone),
      role: lower(i.role),
      expiresAt: kstDay(i.expiresAt),
    })),
  };
}

export function toPortfolioReport(d: ApiPortfolioReport): PortfolioReport {
  return {
    ...d,
    properties: d.properties.map((p) => ({
      ...p,
      type: toPropertyType(p.type),
      role: p.role === "OWNER" ? "owner" : "manager",
      channels: p.channels.map((c) => ({ ...c, channel: toChannelId(c.channel) })),
    })),
  };
}

export function toPortfolio(d: ApiPortfolio): PortfolioData {
  return {
    date: d.date,
    period: d.period,
    totals: d.totals,
    properties: d.properties.map((p) => ({
      ...p,
      type: toPropertyType(p.type),
      role: p.role === "OWNER" ? "owner" : "manager",
      billing: p.billing.status ? (p.billing.status.toLowerCase() as BillingState) : null,
      alerts: p.alerts.map((a) => ({
        kind: a.kind.toLowerCase().replaceAll("_", "-") as PortfolioAlertKind,
        message: a.message,
        link: a.link,
      })),
    })),
  };
}
