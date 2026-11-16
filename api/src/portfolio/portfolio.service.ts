import { Injectable } from '@nestjs/common';
import { addDaysIso, addMonths, dateOnly, kstDate, monthStart, prevToDateEnd } from '../common/utils/dates.js';
import { CHANNEL_CATALOG } from '../connectors/catalog.js';
import { Prisma } from '../generated/prisma/client.js';
import type {
  Channel,
  ConnectionStatus,
  PropertyType,
  Role,
  RoomStatus,
  SubscriptionStatus,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OPEN_SHIFT_HOURS } from '../staff/staff.service.js';

/** '청소 필요' 로 이만큼 넘게 머문 객실은 청소 지연 */
export const STALE_DIRTY_HOURS = 2;
/** 저평점 기준 (이하) */
const LOW_RATING = 3;
/** 퇴근 누락을 찾는 기간 — 알바관리 화면과 같게 */
const MISSING_LOOKBACK_DAYS = 31;

export type AlertKind =
  | 'CHANNEL_AUTH'
  | 'CHANNEL_ERROR'
  | 'PAYMENT_FAILED'
  | 'LOW_RATED'
  | 'STALE_DIRTY'
  | 'MISSING_CLOCK_OUT'
  | 'NO_CHANNEL';

/** 급한 순서 — 채널 끊김 > 결제 실패 > 저평점 미답변 > 청소 지연 > 퇴근 누락 > 채널 없음 */
export const ALERT_RANK: Record<AlertKind, number> = {
  CHANNEL_AUTH: 0,
  CHANNEL_ERROR: 0,
  PAYMENT_FAILED: 1,
  LOW_RATED: 2,
  STALE_DIRTY: 3,
  MISSING_CLOCK_OUT: 4,
  NO_CHANNEL: 5,
};

export interface PortfolioAlert {
  kind: AlertKind;
  message: string;
  /** 업장 안 화면 경로 — 화면이 이 업장으로 바꾼 뒤 연다 */
  link: string;
}

type BillingStatus = SubscriptionStatus | null;

/** 결제 상태가 여럿이면 급한 것 하나로 */
const BILLING_RANK: SubscriptionStatus[] = ['PAST_DUE', 'ACTIVE', 'TRIAL', 'CANCELLED'];

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

/**
 * 여러 업장 통합 현황 (F8) — 내가 사장님·매니저인 업장 전부를 한 번에.
 * 업장 수만큼 반복 조회하지 않고 표마다 집계 쿼리 한 번씩 (업장이 늘어도 쿼리 수는 그대로).
 */
@Injectable()
export class PortfolioService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string, date = kstDate(), now = new Date()) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, role: { in: ['OWNER', 'MANAGER'] } },
      include: { property: { select: { id: true, name: true, type: true, rooms: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const ids = memberships.map((m) => m.propertyId);
    if (ids.length === 0) return { date, properties: [], totals: emptyTotals() };

    const yesterday = addDaysIso(date, -1);
    const month = date.slice(0, 7);
    const prevFrom = monthStart(addMonths(month, -1));
    const idList = Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`));
    const staleBefore = new Date(now.getTime() - STALE_DIRTY_HOURS * 3_600_000);
    const openSince = new Date(now.getTime() - OPEN_SHIFT_HOURS * 3_600_000);

    const [sales, reviews, settle, rooms, staleRooms, staff, channels, brokenChannels, subs] = await Promise.all([
      // 오늘 · 어제 · 이번 달(오늘까지) · 지난달 같은 날까지 — 예약 표를 한 번만 훑는다
      this.prisma.$queryRaw<
        {
          property_id: string;
          today: bigint | null;
          today_count: bigint;
          yesterday: bigint | null;
          month: bigint | null;
          prev_to_date: bigint | null;
        }[]
      >(Prisma.sql`
        SELECT property_id::text AS property_id,
          SUM(sale_amount) FILTER (WHERE checkin_date = ${dateOnly(date)}) AS today,
          COUNT(*) FILTER (WHERE checkin_date = ${dateOnly(date)}) AS today_count,
          SUM(sale_amount) FILTER (WHERE checkin_date = ${dateOnly(yesterday)}) AS yesterday,
          SUM(sale_amount) FILTER (WHERE checkin_date >= ${monthStart(month)}) AS month,
          SUM(sale_amount) FILTER (WHERE checkin_date < ${prevToDateEnd(month, date)}) AS prev_to_date
        FROM wj_booking
        WHERE property_id IN (${idList}) AND status = 'CONFIRMED'
          AND checkin_date >= ${prevFrom} AND checkin_date <= ${dateOnly(date)}
        GROUP BY property_id`),
      this.prisma.$queryRaw<{ property_id: string; unanswered: bigint; low: bigint }[]>(Prisma.sql`
        SELECT property_id::text AS property_id,
          COUNT(*) AS unanswered,
          COUNT(*) FILTER (WHERE rating <= ${LOW_RATING}) AS low
        FROM wj_review
        WHERE property_id IN (${idList}) AND status = 'UNANSWERED'
        GROUP BY property_id`),
      this.prisma.settlement.groupBy({
        by: ['propertyId'],
        where: {
          propertyId: { in: ids },
          settled: false,
          expectedDate: { gte: dateOnly(date), lte: dateOnly(addDaysIso(date, 7)) },
        },
        _sum: { amount: true },
      }),
      this.prisma.room.groupBy({
        by: ['propertyId', 'status'],
        where: { propertyId: { in: ids } },
        _count: { _all: true },
      }),
      this.prisma.room.groupBy({
        by: ['propertyId'],
        where: { propertyId: { in: ids }, status: 'DIRTY', statusChangedAt: { lt: staleBefore } },
        _count: { _all: true },
      }),
      // 근무 중 = 퇴근 전이고 출근한 지 16시간 안 · 퇴근 누락 = 16시간 넘게 열린 기록 (알바관리와 같은 기준)
      this.prisma.$queryRaw<{ property_id: string; on_duty: bigint; missing: bigint }[]>(Prisma.sql`
        SELECT e.property_id::text AS property_id,
          COUNT(*) FILTER (WHERE a.clock_in_at > ${openSince}) AS on_duty,
          COUNT(*) FILTER (WHERE a.clock_in_at <= ${openSince}
            AND a.work_date >= ${dateOnly(addDaysIso(date, -MISSING_LOOKBACK_DAYS))}) AS missing
        FROM wj_attendance a JOIN wj_employee e ON e.id = a.employee_id
        WHERE e.property_id IN (${idList}) AND a.clock_out_at IS NULL
        GROUP BY e.property_id`),
      this.prisma.channelConnection.groupBy({
        by: ['propertyId', 'status'],
        where: { propertyId: { in: ids } },
        _count: { _all: true },
      }),
      this.prisma.channelConnection.findMany({
        where: { propertyId: { in: ids }, status: { in: ['AUTH_EXPIRED', 'ERROR'] } },
        select: { propertyId: true, channel: true, status: true },
        orderBy: { channel: 'asc' },
      }),
      this.prisma.subscription.groupBy({
        by: ['propertyId', 'status'],
        where: { propertyId: { in: ids } },
        _count: { _all: true },
      }),
    ]);

    const salesBy = new Map(sales.map((r) => [r.property_id, r]));
    const reviewsBy = new Map(reviews.map((r) => [r.property_id, r]));
    const settleBy = new Map(settle.map((r) => [r.propertyId, r._sum.amount ?? 0]));
    const staleBy = new Map(staleRooms.map((r) => [r.propertyId, r._count._all]));
    const staffBy = new Map(staff.map((r) => [r.property_id, r]));
    const roomsBy = group(rooms, (r) => r.propertyId);
    const channelsBy = group(channels, (r) => r.propertyId);
    const brokenBy = group(brokenChannels, (r) => r.propertyId);
    const subsBy = group(subs, (r) => r.propertyId);

    const properties = memberships.map((m) => {
      const id = m.propertyId;
      const s = salesBy.get(id);
      const rv = reviewsBy.get(id);
      const st = staffBy.get(id);
      const roomCount = countBy<RoomStatus>(roomsBy.get(id) ?? []);
      const chCount = countBy<ConnectionStatus>(channelsBy.get(id) ?? []);
      // 결제 정보는 사장님만 (매니저는 구독 화면을 볼 수 없다)
      const billingStatus: BillingStatus =
        m.role === 'OWNER'
          ? (BILLING_RANK.find((b) => (subsBy.get(id) ?? []).some((r) => r.status === b)) ?? null)
          : null;
      const view = {
        id,
        name: m.property.name,
        type: m.property.type as PropertyType,
        rooms: m.property.rooms,
        role: m.role as Role,
        today: { sales: n(s?.today), bookings: n(s?.today_count), yesterdaySales: n(s?.yesterday) },
        month: { sales: n(s?.month), prevToDate: n(s?.prev_to_date) },
        reviews: { unanswered: n(rv?.unanswered), lowRated: n(rv?.low) },
        settle7: settleBy.get(id) ?? 0,
        roomStatus: {
          ready: roomCount.READY ?? 0,
          dirty: roomCount.DIRTY ?? 0,
          cleaning: roomCount.CLEANING ?? 0,
          inspect: roomCount.INSPECT ?? 0,
          occupied: roomCount.OCCUPIED ?? 0,
          outOfOrder: roomCount.OUT_OF_ORDER ?? 0,
          staleDirty: staleBy.get(id) ?? 0,
        },
        staff: { onDuty: n(st?.on_duty), missingClockOut: n(st?.missing) },
        channels: {
          connected: (chCount.CONNECTED ?? 0) + (chCount.SYNCING ?? 0),
          error: chCount.ERROR ?? 0,
          authExpired: chCount.AUTH_EXPIRED ?? 0,
        },
        billing: { status: billingStatus },
      };
      return { ...view, alerts: alertsFor(view, brokenBy.get(id) ?? []) };
    });

    return { date, properties, totals: totalsOf(properties) };
  }
}

type PropertyView = {
  reviews: { unanswered: number; lowRated: number };
  roomStatus: { staleDirty: number };
  staff: { missingClockOut: number };
  channels: { connected: number; error: number; authExpired: number };
  billing: { status: BillingStatus };
};

/** 업장 하나의 확인할 일 — 급한 순 */
export function alertsFor(
  p: PropertyView,
  broken: readonly { channel: Channel; status: ConnectionStatus }[],
): PortfolioAlert[] {
  const out: PortfolioAlert[] = [];
  const names = (status: ConnectionStatus) =>
    broken.filter((b) => b.status === status).map((b) => CHANNEL_CATALOG[b.channel].name);
  const auth = names('AUTH_EXPIRED');
  if (auth.length)
    out.push({
      kind: 'CHANNEL_AUTH',
      message: `${auth.join(', ')} 연동이 끊겼어요. 다시 로그인해 주세요.`,
      link: '/app/settings/channels',
    });
  const err = names('ERROR');
  if (err.length)
    out.push({
      kind: 'CHANNEL_ERROR',
      message: `${err.join(', ')}에서 예약·리뷰를 가져오지 못하고 있어요.`,
      link: '/app/settings/channels',
    });
  if (p.billing.status === 'PAST_DUE')
    out.push({
      kind: 'PAYMENT_FAILED',
      message: '구독 결제가 실패했어요. 결제 카드를 확인해 주세요.',
      link: '/app/settings/billing',
    });
  if (p.reviews.lowRated > 0)
    out.push({
      kind: 'LOW_RATED',
      message: `별점 ${LOW_RATING}점 이하 리뷰 ${p.reviews.lowRated}건이 답글을 기다려요.`,
      link: '/app/reviews',
    });
  if (p.roomStatus.staleDirty > 0)
    out.push({
      kind: 'STALE_DIRTY',
      message: `청소 필요 객실 ${p.roomStatus.staleDirty}실이 ${STALE_DIRTY_HOURS}시간 넘게 그대로예요.`,
      link: '/app/ops',
    });
  if (p.staff.missingClockOut > 0)
    out.push({
      kind: 'MISSING_CLOCK_OUT',
      message: `퇴근 기록이 빠진 근무가 ${p.staff.missingClockOut}건 있어요.`,
      link: '/app/staff',
    });
  const anyChannel = p.channels.connected + p.channels.error + p.channels.authExpired;
  if (anyChannel === 0)
    out.push({ kind: 'NO_CHANNEL', message: '채널이 아직 연결되지 않았어요.', link: '/app/settings/channels' });
  return out.sort((a, b) => ALERT_RANK[a.kind] - ALERT_RANK[b.kind]);
}

type Summed = {
  today: { sales: number; bookings: number; yesterdaySales: number };
  month: { sales: number; prevToDate: number };
  reviews: { unanswered: number; lowRated: number };
  settle7: number;
  alerts: readonly unknown[];
};

function emptyTotals() {
  return totalsOf([]);
}

function totalsOf(list: readonly Summed[]) {
  const sum = (f: (p: Summed) => number) => list.reduce((s, p) => s + f(p), 0);
  return {
    properties: list.length,
    needsAttention: list.filter((p) => p.alerts.length > 0).length,
    today: {
      sales: sum((p) => p.today.sales),
      bookings: sum((p) => p.today.bookings),
      yesterdaySales: sum((p) => p.today.yesterdaySales),
    },
    month: { sales: sum((p) => p.month.sales), prevToDate: sum((p) => p.month.prevToDate) },
    reviews: { unanswered: sum((p) => p.reviews.unanswered), lowRated: sum((p) => p.reviews.lowRated) },
    settle7: sum((p) => p.settle7),
  };
}

function group<T>(rows: readonly T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
  return m;
}

/** 상태별 개수 — groupBy 결과를 { 상태: 개수 } 로 */
function countBy<K extends string>(
  rows: readonly { status: K; _count: { _all: number } }[],
): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  for (const r of rows) out[r.status] = (out[r.status] ?? 0) + r._count._all;
  return out;
}
