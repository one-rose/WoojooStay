import { Injectable } from '@nestjs/common';
import { CHANNEL_CATALOG } from '../connectors/catalog.js';
import { Prisma } from '../generated/prisma/client.js';
import type { Channel } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  addDaysIso,
  addMonths,
  confirmedEnd,
  dateOnly,
  isoDay,
  kstDate,
  kstMonth,
  monthStart,
  prevToDateEnd,
} from '../common/utils/dates.js';

const TREND_MONTHS = 10;
const DAYUSE_HOURS = Array.from({ length: 13 }, (_, i) => 10 + i); // 10시 ~ 22시

/**
 * 디지털 매출장부 (F2-01 월 매출 · F2-03 정산 달력 · F2-05 가격 비교 · F2-06 대실·숙박)
 * 매출 기준일은 투숙일(체크인), 취소·노쇼는 뺀다.
 */
@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async ledger(propertyId: string, month = kstMonth(), date = kstDate()) {
    const today = kstDate();
    const from = monthStart(month);
    const to = monthStart(addMonths(month, 1));
    // 진행 중인 달은 오늘 체크인까지만 확정 매출 — 내일~말일 예약은 upcoming 으로 따로 (/portfolio 와 같은 기준)
    const end = confirmedEnd(month, today);
    const confirmed = { propertyId, status: 'CONFIRMED' as const };

    const prevFrom = monthStart(addMonths(month, -1));
    const [byChannel, upcoming, prev, prevToDate, ads, soon, trend, settlements, property] = await Promise.all([
      this.prisma.booking.groupBy({
        by: ['channel'],
        where: { ...confirmed, checkinDate: { gte: from, lt: end } },
        _count: { _all: true },
        _sum: { saleAmount: true, commission: true },
      }),
      this.prisma.booking.aggregate({
        where: { ...confirmed, checkinDate: { gte: end, lt: to } },
        _count: { _all: true },
        _sum: { saleAmount: true, commission: true },
      }),
      this.prisma.booking.aggregate({
        where: { ...confirmed, checkinDate: { gte: prevFrom, lt: from } },
        _sum: { saleAmount: true },
      }),
      this.prisma.booking.aggregate({
        where: { ...confirmed, checkinDate: { gte: prevFrom, lt: prevToDateEnd(month) } },
        _sum: { saleAmount: true },
      }),
      this.prisma.adSpend.findMany({ where: { propertyId, month: from } }),
      this.prisma.settlement.aggregate({
        where: {
          propertyId,
          settled: false,
          expectedDate: { gte: dateOnly(kstDate()), lte: dateOnly(addDaysIso(kstDate(), 14)) },
        },
        _sum: { amount: true },
      }),
      this.trend(propertyId, month, end),
      this.prisma.settlement.findMany({
        where: { propertyId, expectedDate: { gte: from, lt: to } },
        orderBy: [{ expectedDate: 'asc' }, { channel: 'asc' }],
      }),
      this.prisma.property.findUniqueOrThrow({ where: { id: propertyId }, select: { rooms: true } }),
    ]);

    const adBy = new Map(ads.map((a) => [a.channel, a.amount]));
    const channelSet = new Set<Channel>([...byChannel.map((c) => c.channel), ...ads.map((a) => a.channel)]);
    const channels = [...channelSet]
      .map((channel) => {
        const row = byChannel.find((c) => c.channel === channel);
        const sales = row?._sum.saleAmount ?? 0;
        const fees = row?._sum.commission ?? 0;
        return {
          channel,
          name: CHANNEL_CATALOG[channel].name,
          bookings: row?._count._all ?? 0,
          sales,
          fees,
          feeRate: sales ? Math.round((fees / sales) * 1000) / 1000 : 0,
          adSpend: adBy.get(channel) ?? 0,
        };
      })
      .sort((a, b) => b.sales - a.sales);

    const days = new Map<string, { channel: Channel; amount: number; done: boolean }[]>();
    for (const s of settlements) {
      const key = isoDay(s.expectedDate);
      days.set(key, [...(days.get(key) ?? []), { channel: s.channel, amount: s.amount, done: s.settled }]);
    }

    const [priceCompare, stayMix] = await Promise.all([
      this.priceCompare(propertyId, date),
      this.stayMix(propertyId, date, property.rooms),
    ]);

    return {
      month,
      /** 진행 중인 달이면 true — sales·fees·channels 는 오늘 체크인까지 */
      partial: month === today.slice(0, 7),
      asOf: today,
      sales: channels.reduce((s, c) => s + c.sales, 0),
      /** 내일 ~ 말일 체크인 예정 (확정 매출에 넣지 않음). 지난 달은 0 */
      upcoming: {
        sales: upcoming._sum.saleAmount ?? 0,
        bookings: upcoming._count._all,
        commission: upcoming._sum.commission ?? 0,
      },
      prevSales: prev._sum.saleAmount ?? 0,
      /** 지난달 같은 날까지 매출 — 진행 중인 이번 달과 비교할 때. 지난 달을 볼 때는 prevSales 와 같다 */
      prevSalesToDate: prevToDate._sum.saleAmount ?? 0,
      adSpend: channels.reduce((s, c) => s + c.adSpend, 0),
      fees: channels.reduce((s, c) => s + c.fees, 0),
      settleSoon: soon._sum.amount ?? 0,
      trend,
      channels,
      calendar: { month, days: [...days].map(([d, items]) => ({ date: d, items })) },
      priceCompare,
      stayMix,
    };
  }

  /** 최근 10개월 월별 매출 (없는 달은 0) — 진행 중인 달은 오늘까지 */
  private async trend(propertyId: string, month: string, end: Date) {
    const first = addMonths(month, -(TREND_MONTHS - 1));
    const rows = await this.prisma.$queryRaw<{ m: string; sales: bigint }[]>(Prisma.sql`
      SELECT to_char(checkin_date, 'YYYY-MM') AS m, SUM(sale_amount)::bigint AS sales
      FROM wj_booking
      WHERE property_id = ${propertyId}::uuid AND status = 'CONFIRMED'
        AND checkin_date >= ${monthStart(first)} AND checkin_date < ${end}
      GROUP BY 1`);
    const by = new Map(rows.map((r) => [r.m, Number(r.sales)]));
    return Array.from({ length: TREND_MONTHS }, (_, i) => {
      const m = addMonths(first, i);
      return { month: m, sales: by.get(m) ?? 0 };
    });
  }

  /** F2-05 그날 채널별 우리 판매가 + 주변 경쟁 업소 */
  async priceCompare(propertyId: string, date: string) {
    const day = dateOnly(date);
    const [prices, competitors] = await Promise.all([
      this.prisma.channelPrice.findMany({ where: { propertyId, stayDate: day }, orderBy: { roomType: 'asc' } }),
      this.prisma.competitorPrice.findMany({ where: { propertyId, stayDate: day }, orderBy: { distanceM: 'asc' } }),
    ]);
    const rooms = new Map<string, Partial<Record<Channel, number>>>();
    for (const p of prices) rooms.set(p.roomType, { ...rooms.get(p.roomType), [p.channel]: p.price });
    return {
      date,
      rooms: [...rooms].map(([roomType, byChannel]) => ({ roomType, prices: byChannel })),
      competitors: competitors.map((c) => ({
        name: c.name,
        distance: c.distanceM >= 1000 ? `${(c.distanceM / 1000).toFixed(1)}km` : `${c.distanceM}m`,
        roomType: c.roomType,
        price: c.price,
      })),
    };
  }

  /** F2-06 그날 대실·숙박 + 시간대별 대실 입실 */
  async stayMix(propertyId: string, date: string, rooms: number) {
    const bookings = await this.prisma.booking.findMany({
      where: { propertyId, status: 'CONFIRMED', checkinDate: dateOnly(date) },
      select: { stayType: true, saleAmount: true, checkinTime: true },
    });
    const sum = (type: 'DAYUSE' | 'OVERNIGHT') => {
      const list = bookings.filter((b) => b.stayType === type);
      return { count: list.length, sales: list.reduce((s, b) => s + b.saleAmount, 0) };
    };
    const hourly = DAYUSE_HOURS.map((hour) => ({
      hour,
      count: bookings.filter((b) => b.stayType === 'DAYUSE' && Number(b.checkinTime?.slice(0, 2)) === hour).length,
    }));
    return { date, rooms, dayuse: sum('DAYUSE'), overnight: sum('OVERNIGHT'), hourly };
  }

  /** F2-04 광고비 직접 입력 (채널에서 못 가져오는 경우) */
  async setAdSpend(propertyId: string, channel: Channel, month: string, amount: number) {
    const m = monthStart(month);
    await this.prisma.adSpend.upsert({
      where: { propertyId_channel_month: { propertyId, channel, month: m } },
      create: { propertyId, channel, month: m, amount, source: 'MANUAL' },
      update: { amount, source: 'MANUAL' },
    });
    return { channel, month, amount };
  }
}
