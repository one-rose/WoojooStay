import { Injectable } from '@nestjs/common';
import { addDaysIso, addMonths, dateOnly, kstDate, monthStart, prevToDateEnd } from '../common/utils/dates.js';
import { CHANNEL_CATALOG } from '../connectors/catalog.js';
import { Prisma } from '../generated/prisma/client.js';
import type { Channel, PropertyType, Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** 월별 추이 — 고른 달까지 이만큼 */
export const REPORT_TREND_MONTHS = 6;

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

/**
 * 업장 비교 리포트 (F8) — 한 달 동안 업장마다 매출 · 예약 · 객실당 매출 · 수수료 · 채널 비중 · 별점 · 답글률,
 * 그리고 최근 6개월 업장별 매출.
 * 진행 중인 이번 달은 오늘까지(앞으로 올 예약 제외)로 세고, 지난달도 같은 날까지와 비교한다.
 */
@Injectable()
export class PortfolioReportService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string, month?: string, today = kstDate()) {
    const thisMonth = today.slice(0, 7);
    const m = month && month <= thisMonth ? month : thisMonth;
    const partial = m === thisMonth;
    const from = monthStart(m);
    // 끝(미포함): 이번 달은 내일, 지난 달은 다음 달 1일
    const to = partial ? dateOnly(addDaysIso(today, 1)) : monthStart(addMonths(m, 1));
    const prevFrom = monthStart(addMonths(m, -1));
    const prevTo = prevToDateEnd(m, today);
    const trendFrom = monthStart(addMonths(m, -(REPORT_TREND_MONTHS - 1)));
    const months = Array.from({ length: REPORT_TREND_MONTHS }, (_, i) => addMonths(m, i - REPORT_TREND_MONTHS + 1));

    const memberships = await this.prisma.membership.findMany({
      where: { userId, role: { in: ['OWNER', 'MANAGER'] } },
      include: { property: { select: { id: true, name: true, type: true, rooms: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const ids = memberships.map((x) => x.propertyId);
    const empty = { month: m, partial, days: daysIn(m, partial ? today : null), months, properties: [] };
    if (ids.length === 0) return empty;
    const idList = Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`));

    const [byChannel, prev, trend, reviews] = await Promise.all([
      this.prisma.$queryRaw<
        { property_id: string; channel: Channel; sales: bigint; bookings: bigint; commission: bigint }[]
      >(Prisma.sql`
        SELECT property_id::text AS property_id, channel_code AS channel,
          SUM(sale_amount) AS sales, COUNT(*) AS bookings, SUM(commission_amount) AS commission
        FROM wj_booking
        WHERE property_id IN (${idList}) AND status = 'CONFIRMED'
          AND checkin_date >= ${from} AND checkin_date < ${to}
        GROUP BY property_id, channel_code`),
      this.prisma.$queryRaw<{ property_id: string; sales: bigint }[]>(Prisma.sql`
        SELECT property_id::text AS property_id, SUM(sale_amount) AS sales
        FROM wj_booking
        WHERE property_id IN (${idList}) AND status = 'CONFIRMED'
          AND checkin_date >= ${prevFrom} AND checkin_date < ${prevTo}
        GROUP BY property_id`),
      this.prisma.$queryRaw<{ property_id: string; month: string; sales: bigint }[]>(Prisma.sql`
        SELECT property_id::text AS property_id, to_char(checkin_date, 'YYYY-MM') AS month, SUM(sale_amount) AS sales
        FROM wj_booking
        WHERE property_id IN (${idList}) AND status = 'CONFIRMED'
          AND checkin_date >= ${trendFrom} AND checkin_date < ${to}
        GROUP BY property_id, to_char(checkin_date, 'YYYY-MM')`),
      // 리뷰 — 이 달에 올라온 것 (한국 시간 기준)
      this.prisma.$queryRaw<{ property_id: string; count: bigint; rating_sum: bigint; answered: bigint }[]>(Prisma.sql`
        SELECT property_id::text AS property_id, COUNT(*) AS count, SUM(rating) AS rating_sum,
          COUNT(*) FILTER (WHERE status = 'POSTED') AS answered
        FROM wj_review
        WHERE property_id IN (${idList})
          AND (posted_at AT TIME ZONE 'Asia/Seoul')::date >= ${from}
          AND (posted_at AT TIME ZONE 'Asia/Seoul')::date < ${to}
        GROUP BY property_id`),
    ]);

    const prevBy = new Map(prev.map((r) => [r.property_id, n(r.sales)]));
    const reviewsBy = new Map(reviews.map((r) => [r.property_id, r]));
    const days = daysIn(m, partial ? today : null);

    const properties = memberships.map(({ property: p, role }) => {
      const rows = byChannel.filter((r) => r.property_id === p.id);
      const sales = rows.reduce((s, r) => s + n(r.sales), 0);
      const rv = reviewsBy.get(p.id);
      const reviewCount = n(rv?.count);
      return {
        id: p.id,
        name: p.name,
        type: p.type as PropertyType,
        rooms: p.rooms,
        role: role as Role,
        sales,
        prevSales: prevBy.get(p.id) ?? 0,
        bookings: rows.reduce((s, r) => s + n(r.bookings), 0),
        commission: rows.reduce((s, r) => s + n(r.commission), 0),
        /** 객실 하나가 하루에 번 돈 (RevPAR 와 같은 뜻 — 객실 수 × 날 수로 나눔) */
        perRoomDay: p.rooms > 0 && days > 0 ? Math.round(sales / (p.rooms * days)) : 0,
        channels: rows
          .map((r) => ({ channel: r.channel, name: CHANNEL_CATALOG[r.channel].name, sales: n(r.sales) }))
          .sort((a, b) => b.sales - a.sales),
        reviews: {
          count: reviewCount,
          avgRating: reviewCount ? Math.round((n(rv?.rating_sum) / reviewCount) * 10) / 10 : null,
          answered: n(rv?.answered),
        },
        trend: months.map((mm) => n(trend.find((t) => t.property_id === p.id && t.month === mm)?.sales)),
      };
    });
    return { ...empty, properties };
  }
}

/** 이 달에서 센 날 수 — 진행 중이면 오늘까지 */
function daysIn(month: string, today: string | null): number {
  if (today) return Number(today.slice(8, 10));
  return new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
}
