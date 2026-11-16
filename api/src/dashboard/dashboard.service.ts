import { Injectable } from '@nestjs/common';
import { addDaysIso, dateOnly, kstDate } from '../common/utils/dates.js';
import { CHANNEL_CATALOG } from '../connectors/catalog.js';
import { ReviewStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toView } from '../reviews/reviews.service.js';

/** F0-12 홈 대시보드 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(propertyId: string, date = kstDate()) {
    const yesterday = addDaysIso(date, -1);
    const weekEnd = addDaysIso(date, 7);
    const [property, today, prev, unanswered, lowRating, settlements, pending, channels] = await Promise.all([
      this.prisma.property.findUniqueOrThrow({ where: { id: propertyId } }),
      this.prisma.booking.groupBy({
        by: ['channel'],
        where: { propertyId, checkinDate: dateOnly(date), status: 'CONFIRMED' },
        _sum: { saleAmount: true },
        _count: true,
      }),
      this.prisma.booking.aggregate({
        where: { propertyId, checkinDate: dateOnly(yesterday), status: 'CONFIRMED' },
        _sum: { saleAmount: true },
      }),
      this.prisma.review.count({ where: { propertyId, status: ReviewStatus.UNANSWERED } }),
      this.prisma.review.count({
        where: { propertyId, status: ReviewStatus.UNANSWERED, OR: [{ rating: { lte: 3 } }, { needsReview: true }] },
      }),
      this.prisma.settlement.findMany({
        where: { propertyId, settled: false, expectedDate: { gte: dateOnly(date), lte: dateOnly(weekEnd) } },
        orderBy: { expectedDate: 'asc' },
      }),
      this.prisma.review.findMany({
        where: { propertyId, status: ReviewStatus.UNANSWERED },
        orderBy: [{ rating: 'asc' }, { postedAt: 'desc' }],
        take: 5,
        include: { draft: true, reply: true },
      }),
      this.prisma.channelConnection.findMany({ where: { propertyId } }),
    ]);
    const amount = today.reduce((s, r) => s + (r._sum.saleAmount ?? 0), 0);
    const prevAmount = prev._sum.saleAmount ?? 0;
    return {
      date,
      property: { id: property.id, name: property.name, type: property.type, rooms: property.rooms },
      todaySales: {
        amount,
        yesterday: prevAmount,
        changeRate: prevAmount ? Math.round(((amount - prevAmount) / prevAmount) * 1000) / 10 : null,
        bookings: today.reduce((s, r) => s + r._count, 0),
      },
      unanswered: { total: unanswered, lowRating },
      settlementWeek: { amount: settlements.reduce((s, r) => s + r.amount, 0), count: settlements.length },
      channelSales: today
        .map((r) => ({ channel: r.channel, name: CHANNEL_CATALOG[r.channel].name, amount: r._sum.saleAmount ?? 0 }))
        .sort((a, b) => b.amount - a.amount),
      settlements: settlements.map((s) => ({
        date: s.expectedDate.toISOString().slice(0, 10),
        channel: s.channel,
        name: CHANNEL_CATALOG[s.channel].name,
        amount: s.amount,
      })),
      pendingReviews: pending.map(toView),
      channels: channels.map((c) => ({
        channel: c.channel,
        name: CHANNEL_CATALOG[c.channel].name,
        replyMode: CHANNEL_CATALOG[c.channel].replyMode,
        status: c.status,
        lastSyncedAt: c.lastSyncedAt,
      })),
    };
  }
}
