import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ReplyGenerator } from '../ai/reply-generator.js';
import { Errors } from '../common/errors/app-error.js';
import { CHANNEL_CATALOG } from '../connectors/catalog.js';
import { ChannelConnector } from '../connectors/channel-connector.js';
import { CredentialVault } from '../connectors/credential-vault.js';
import type { Prisma } from '../generated/prisma/client.js';
import { ConnectionStatus, ReplyVia, ReviewStatus, Sentiment } from '../generated/prisma/enums.js';
import { EventsService } from '../events/events.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ListReviewsQuery, ReplySettingsDto, ReviewTab } from './dto/review.dto.js';

const INCLUDE = { draft: true, reply: true } as const;
type ReviewRow = Prisma.ReviewGetPayload<{ include: typeof INCLUDE }>;

const TAB_WHERE: Record<ReviewTab, Prisma.ReviewWhereInput> = {
  all: {},
  unanswered: { status: ReviewStatus.UNANSWERED },
  positive: { sentiment: Sentiment.POSITIVE },
  improve: { sentiment: Sentiment.IMPROVE },
};

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger('Reviews');

  constructor(
    private readonly prisma: PrismaService,
    private readonly generator: ReplyGenerator,
    private readonly connector: ChannelConnector,
    private readonly vault: CredentialVault,
    private readonly events: EventsService,
  ) {}

  /** F1-01 통합 목록 + F1-02 분류 탭 건수 */
  async list(propertyId: string, q: ListReviewsQuery) {
    const base: Prisma.ReviewWhereInput = { propertyId, ...(q.channel ? { channel: q.channel } : {}) };
    const where = { ...base, ...TAB_WHERE[q.tab] };
    const orderBy: Prisma.ReviewOrderByWithRelationInput[] =
      q.sort === 'low' ? [{ rating: 'asc' }, { postedAt: 'desc' }] : [{ postedAt: 'desc' }];
    const [rows, total, ...counts] = await Promise.all([
      this.prisma.review.findMany({ where, orderBy, skip: q.offset, take: q.limit, include: INCLUDE }),
      this.prisma.review.count({ where }),
      ...(['all', 'unanswered', 'positive', 'improve'] as const).map((t) =>
        this.prisma.review.count({ where: { ...base, ...TAB_WHERE[t] } }),
      ),
    ]);
    return {
      items: rows.map(toView),
      total,
      nextOffset: q.offset + rows.length < total ? q.offset + rows.length : null,
      counts: { all: counts[0], unanswered: counts[1], positive: counts[2], improve: counts[3] },
    };
  }

  async get(propertyId: string, reviewId: string) {
    return toView(await this.find(propertyId, reviewId));
  }

  /** F1-03 AI 답글 (다시) 만들기 — 업장 말투 설정(F1-04)을 반영 */
  async generateDraft(propertyId: string, reviewId: string, userId: string | null = null) {
    const review = await this.find(propertyId, reviewId);
    if (review.status !== ReviewStatus.UNANSWERED) throw Errors.alreadyAnswered();
    // 다시 만들 때는 앞 초안과 다른 문장이 나오도록 (템플릿 답글은 표현을 돌려 쓴다)
    const revision = (review.draft?.revision ?? 0) + 1;
    await this.draftFor(review, revision);
    await this.events.record('DRAFT_REGENERATE', { userId, propertyId, meta: { reviewId, revision } });
    return this.get(propertyId, reviewId);
  }

  async draftFor(
    review: {
      id: string;
      propertyId: string;
      channel: ReviewRow['channel'];
      rating: number;
      body: string;
      roomType: string | null;
    },
    revision = 0,
  ) {
    const [property, settings] = await Promise.all([
      this.prisma.property.findUniqueOrThrow({ where: { id: review.propertyId } }),
      this.settings(review.propertyId),
    ]);
    const out = await this.generator.generate({
      propertyName: property.name,
      channelName: CHANNEL_CATALOG[review.channel].name,
      rating: review.rating,
      body: review.body,
      roomType: review.roomType,
      tone: settings.tone,
      signature: settings.signature,
      mustInclude: settings.mustInclude,
      banned: settings.banned,
      variant: revision,
    });
    return this.prisma.replyDraft.upsert({
      where: { reviewId: review.id },
      create: { reviewId: review.id, text: out.text, keywords: out.keywords, generator: out.generator, revision },
      update: { text: out.text, keywords: out.keywords, generator: out.generator, revision },
    });
  }

  /**
   * 게시 도중 서버가 꺼져 '게시 중' 에 남은 리뷰를 다시 답글 달 수 있게 되돌린다.
   * 채널 전송은 30초 안에 끝나므로 10분 넘게 남아 있으면 실패로 본다.
   */
  async releaseStalePosting(now = new Date(), staleMs = 10 * 60_000) {
    const r = await this.prisma.review.updateMany({
      where: {
        status: ReviewStatus.POSTING,
        OR: [{ postingAt: null }, { postingAt: { lt: new Date(now.getTime() - staleMs) } }],
      },
      data: { status: ReviewStatus.UNANSWERED, postingAt: null },
    });
    return r.count;
  }

  /**
   * F1-07 답글 게시. 자동 게시 채널은 채널로 보내고, 아니면 '복사해서 게시함'으로 기록.
   * via=AUTO 는 자동 응대(F1-08)에서만.
   */
  async post(propertyId: string, reviewId: string, userId: string | null, text: string, auto = false) {
    const body = text.trim();
    if (!body) throw Errors.replyEmpty();
    const review = await this.find(propertyId, reviewId);
    if (review.status !== ReviewStatus.UNANSWERED) throw Errors.alreadyAnswered();
    const mode = CHANNEL_CATALOG[review.channel].replyMode;
    // 먼저 '게시 중'으로 잡는다 — 동시에 두 번 눌러도 한 요청만 채널로 보낸다
    const claimed = await this.prisma.review.updateMany({
      where: { id: reviewId, status: ReviewStatus.UNANSWERED },
      data: { status: ReviewStatus.POSTING, postingAt: new Date() },
    });
    if (claimed.count === 0) throw Errors.alreadyAnswered();
    try {
      if (mode === 'API') {
        const conn = await this.prisma.channelConnection.findUnique({
          where: { propertyId_channel: { propertyId, channel: review.channel } },
        });
        if (!conn || conn.status === ConnectionStatus.AUTH_EXPIRED) throw Errors.channelNotConnected();
        try {
          await this.connector.postReply(review.channel, this.vault.open(conn.credentials), review.externalId, body);
        } catch (err) {
          // 채널 서버 오류는 우리 서버 오류(500)가 아니라 502 — 화면은 '잠시 뒤 다시' 로 안내
          if (err instanceof HttpException) throw err;
          this.logger.warn(`답글 게시 실패 ${review.channel}: ${(err as Error).message}`);
          throw Errors.channelPostFailed(CHANNEL_CATALOG[review.channel].name);
        }
      }
      const via = auto ? ReplyVia.AUTO : mode === 'API' ? ReplyVia.API : ReplyVia.COPY;
      // 초안을 고쳐서 게시했는지 — 공백만 다르면 그대로 쓴 것으로 본다 (실증 KPI 'AI 초안 그대로 쓴 비율')
      const draftEdited = review.draft ? normalize(review.draft.text) !== normalize(body) : null;
      await this.prisma.$transaction([
        this.prisma.reply.create({
          data: { reviewId, text: body, via, postedById: userId, draftEdited },
        }),
        this.prisma.review.update({ where: { id: reviewId }, data: { status: ReviewStatus.POSTED, postingAt: null } }),
      ]);
    } catch (err) {
      // 채널 전송·저장이 실패하면 다시 답글을 달 수 있게 되돌린다
      await this.prisma.review.updateMany({
        where: { id: reviewId, status: ReviewStatus.POSTING },
        data: { status: ReviewStatus.UNANSWERED, postingAt: null },
      });
      throw err;
    }
    await this.events.record('REPLY_POST', {
      userId,
      propertyId,
      meta: {
        reviewId,
        via: auto ? 'AUTO' : mode === 'API' ? 'API' : 'COPY',
        edited: review.draft ? normalize(review.draft.text) !== normalize(body) : null,
      },
    });
    return {
      ...(await this.get(propertyId, reviewId)),
      copyTo: mode === 'COPY' ? CHANNEL_CATALOG[review.channel].partnerUrl : null,
    };
  }

  /** F1-04 · F1-08 설정 */
  async settings(propertyId: string) {
    return this.prisma.replySettings.upsert({
      where: { propertyId },
      create: { propertyId, signature: '' },
      update: {},
    });
  }

  /**
   * 설정 저장. applyTo 가 있으면 그 업장들에도 같은 말투·필수 문구·금지어·자동 응대를 적용한다 (PO-13).
   * 서명은 업장 이름이 들어가는 경우가 많아 다른 업장에는 복사하지 않는다.
   * applyTo 에 내가 사장님·매니저가 아닌 업장이 하나라도 있으면 아무것도 바꾸지 않고 403.
   */
  async updateSettings(propertyId: string, dto: ReplySettingsDto, userId?: string) {
    const banned = [...new Set(dto.banned.map((w) => w.trim()).filter(Boolean))];
    const shared = {
      tone: dto.tone,
      mustInclude: dto.mustInclude.trim(),
      banned,
      autoEnabled: dto.autoEnabled,
      autoMinRating: dto.autoMinRating,
      autoHours: dto.autoHours,
    };
    const others = [...new Set(dto.applyTo ?? [])].filter((id) => id !== propertyId);
    if (others.length) {
      if (!userId) throw Errors.forbidden();
      const allowed = await this.prisma.membership.count({
        where: { userId, propertyId: { in: others }, role: { in: ['OWNER', 'MANAGER'] } },
      });
      if (allowed !== others.length) throw Errors.forbidden();
    }
    await this.settings(propertyId);
    const [current] = await this.prisma.$transaction([
      this.prisma.replySettings.update({
        where: { propertyId },
        data: { ...shared, signature: dto.signature.trim() },
      }),
      ...others.map((id) =>
        this.prisma.replySettings.upsert({
          where: { propertyId: id },
          create: { propertyId: id, signature: '', ...shared },
          update: shared,
        }),
      ),
    ]);
    return { ...current, appliedTo: others };
  }

  private async find(propertyId: string, reviewId: string) {
    const review = await this.prisma.review.findFirst({ where: { id: reviewId, propertyId }, include: INCLUDE });
    if (!review) throw Errors.notFound('리뷰');
    return review;
  }
}

/** 초안과 게시 문장 비교용 — 앞뒤·연속 공백만 정리 */
function normalize(t: string) {
  return t.trim().replace(/\s+/g, ' ');
}

export function toView(r: ReviewRow) {
  const meta = CHANNEL_CATALOG[r.channel];
  return {
    id: r.id,
    channel: r.channel,
    channelName: meta.name,
    replyMode: meta.replyMode,
    author: r.author,
    rating: r.rating,
    body: r.body,
    photos: r.photos,
    roomType: r.roomType,
    stayDate: r.stayDate?.toISOString().slice(0, 10) ?? null,
    postedAt: r.postedAt,
    status: r.status,
    sentiment: r.sentiment,
    needsReview: r.needsReview,
    draft: r.draft
      ? {
          text: r.draft.text,
          keywords: r.draft.keywords,
          /** 'ai' | 'template' — 템플릿이면 화면에 'AI 키 없음 · 기본 문장' 표시 */
          generator: r.draft.generator.startsWith('anthropic') ? ('ai' as const) : ('template' as const),
          model: r.draft.generator,
        }
      : null,
    reply: r.reply ? { text: r.reply.text, via: r.reply.via, postedAt: r.reply.postedAt } : null,
  };
}
