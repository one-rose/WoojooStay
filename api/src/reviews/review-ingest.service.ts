import { Injectable, Logger } from '@nestjs/common';
import { kstHour } from '../common/utils/dates.js';
import { CHANNEL_CATALOG } from '../connectors/catalog.js';
import type { ExternalReview } from '../connectors/channel-connector.js';
import { AutoHours, ReplyVia, ReviewStatus, type Channel } from '../generated/prisma/enums.js';
import { EventsService } from '../events/events.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReviewsService } from './reviews.service.js';
import { needsHumanReview, sentimentOf } from './sensitive.js';

/** 채널에서 가져온 리뷰를 저장하고, AI 초안을 미리 만들고, 조건이 맞으면 자동 응대 (F0-05, F1-03, F1-08) */
@Injectable()
export class ReviewIngestService {
  private readonly logger = new Logger('ReviewIngest');

  constructor(
    private readonly prisma: PrismaService,
    private readonly reviews: ReviewsService,
    private readonly notifications: NotificationsService,
    private readonly events: EventsService,
  ) {}

  async ingest(propertyId: string, channel: Channel, items: ExternalReview[]): Promise<{ created: number }> {
    let created = 0;
    const lowRated: string[] = [];
    for (const item of items) {
      const exists = await this.prisma.review.findUnique({
        where: { propertyId_channel_externalId: { propertyId, channel, externalId: item.externalId } },
      });
      if (exists) continue;
      const review = await this.prisma.review.create({
        data: {
          propertyId,
          channel,
          externalId: item.externalId,
          author: item.author,
          rating: Math.max(1, Math.min(5, Math.round(item.rating))),
          body: item.body,
          photos: item.photos,
          roomType: item.roomType,
          stayDate: item.stayDate ? new Date(`${item.stayDate}T00:00:00.000Z`) : null,
          postedAt: item.postedAt,
          sentiment: sentimentOf(item.rating),
          needsReview: needsHumanReview(item.body),
          status: item.existingReply ? ReviewStatus.POSTED : ReviewStatus.UNANSWERED,
          // 채널에 이미 있던 답글 — 우리 서비스로 단 답글이 아니므로 EXTERNAL, 시각은 채널이 준 값(없으면 비움)
          ...(item.existingReply
            ? {
                reply: {
                  create: { text: item.existingReply, via: ReplyVia.EXTERNAL, postedAt: item.existingReplyAt ?? null },
                },
              }
            : {}),
        },
      });
      created += 1;
      if (review.status === ReviewStatus.POSTED) continue;
      if (review.rating <= 3 || review.needsReview) lowRated.push(review.id);
      await this.reviews.draftFor(review);
      await this.events.record('DRAFT_CREATE', { propertyId, meta: { reviewId: review.id, auto: true } });
      await this.maybeAutoReply(review.id, propertyId, channel, review.rating, review.needsReview);
    }
    if (created > 0) {
      const name = CHANNEL_CATALOG[channel].name;
      await this.notifications.notifyProperty(
        propertyId,
        'REVIEW',
        `${name}에서 새 리뷰 ${created}건을 가져왔어요. AI 답글 초안을 준비했어요.`,
        '/app/reviews',
      );
      if (lowRated.length) {
        await this.notifications.notifyProperty(
          propertyId,
          'REVIEW',
          `${name}에 별점 3점 이하 또는 확인이 필요한 리뷰가 ${lowRated.length}건 있어요.`,
          `/app/reviews?id=${lowRated[0]}`,
          { urgent: true },
        );
      }
    }
    return { created };
  }

  /** F1-08 — 켜져 있고, 별점 기준 이상, 확인 필요 아님, 자동 게시 채널, 시간대 맞을 때만 */
  private async maybeAutoReply(
    reviewId: string,
    propertyId: string,
    channel: Channel,
    rating: number,
    needsReview: boolean,
  ) {
    const s = await this.reviews.settings(propertyId);
    if (!s.autoEnabled || needsReview || rating < s.autoMinRating) return;
    if (CHANNEL_CATALOG[channel].replyMode !== 'API') return;
    const hour = kstHour();
    if (s.autoHours === AutoHours.DAYTIME && (hour < 9 || hour >= 21)) return;
    const draft = await this.prisma.replyDraft.findUnique({ where: { reviewId } });
    if (!draft) return;
    try {
      await this.reviews.post(propertyId, reviewId, null, draft.text, true);
    } catch (err) {
      // 자동 게시가 실패하면 사람이 보도록 남겨 둔다
      this.logger.warn(`자동 응대 실패 ${reviewId}: ${(err as Error).message}`);
    }
  }
}
