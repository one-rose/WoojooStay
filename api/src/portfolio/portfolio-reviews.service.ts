import { Injectable } from '@nestjs/common';
import { CHANNEL_CATALOG } from '../connectors/catalog.js';
import { ReviewStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toView } from '../reviews/reviews.service.js';

/** 답글을 단 리뷰는 최근 이만큼만 (미답변은 전부) */
export const INBOX_ANSWERED_DAYS = 7;
/** 한 번에 내려주는 최대 건수 — 미답변이 이보다 많으면 오래된 것부터 잘린다 */
const INBOX_LIMIT = 1000;

/**
 * 통합 리뷰함 (F8) — 내가 사장님·매니저인 업장 전부의 리뷰를 한 목록으로.
 * 미답변(게시 중 포함)은 전부, 답글을 단 리뷰는 최근 7일만. 답글 게시·다시 쓰기는 업장별 리뷰 API 를 그대로 쓴다.
 */
@Injectable()
export class PortfolioReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, now = new Date()) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, role: { in: ['OWNER', 'MANAGER'] } },
      include: { property: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const properties = memberships.map((m) => m.property);
    if (properties.length === 0) return { properties, channels: [], items: [], truncated: false };

    const since = new Date(now.getTime() - INBOX_ANSWERED_DAYS * 86_400_000);
    const rows = await this.prisma.review.findMany({
      where: {
        propertyId: { in: properties.map((p) => p.id) },
        OR: [
          { status: { in: [ReviewStatus.UNANSWERED, ReviewStatus.POSTING] } },
          { status: ReviewStatus.POSTED, reply: { postedAt: { gte: since } } },
        ],
      },
      orderBy: { postedAt: 'desc' },
      take: INBOX_LIMIT + 1,
      include: { draft: true, reply: true },
    });
    const truncated = rows.length > INBOX_LIMIT;
    const items = rows.slice(0, INBOX_LIMIT).map((r) => ({ ...toView(r), propertyId: r.propertyId }));
    const used = [...new Set(items.map((r) => r.channel))];
    return {
      properties,
      channels: used.map((c) => ({
        channel: c,
        name: CHANNEL_CATALOG[c].name,
        replyMode: CHANNEL_CATALOG[c].replyMode,
      })),
      items,
      truncated,
    };
  }
}
