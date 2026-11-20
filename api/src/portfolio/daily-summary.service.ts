import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { kstDate } from '../common/utils/dates.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PortfolioService } from './portfolio.service.js';

const won = (v: number) => `₩${v.toLocaleString('ko-KR')}`;

/**
 * 아침 일일 요약 (PO-22) — 매일 8시(KST) 사장님마다 앱 알림 한 건.
 * 사장님(OWNER)인 업장 중 알림 설정 '아침 요약'(SUMMARY, push)을 끄지 않은 업장을 한 줄씩:
 * 어제 매출 · 미답변 · 청소 지연 · 퇴근 누락. 업장이 2곳 이상이면 한 건으로 묶는다. 문자·알림톡은 보내지 않는다.
 * 같은 날 두 번 돌아도 한 번만 (오늘 이미 보낸 요약이 있으면 건너뜀).
 */
@Injectable()
export class DailySummaryService {
  private readonly logger = new Logger('DailySummary');

  constructor(
    private readonly prisma: PrismaService,
    private readonly portfolio: PortfolioService,
  ) {}

  @Cron('0 8 * * *', { timeZone: 'Asia/Seoul' })
  async scheduled() {
    const r = await this.runDaily();
    if (r.sent) this.logger.log(`아침 요약 ${r.sent}명`);
  }

  async runDaily(now = new Date()) {
    const owners = await this.prisma.membership.findMany({
      where: { role: 'OWNER' },
      distinct: ['userId'],
      select: { userId: true },
    });
    let sent = 0;
    for (const { userId } of owners) {
      try {
        if (await this.sendTo(userId, now)) sent += 1;
      } catch (err) {
        this.logger.warn(`아침 요약 실패 ${userId}: ${(err as Error).message}`);
      }
    }
    return { owners: owners.length, sent };
  }

  /** 한 사장님에게 — 보냈으면 true */
  async sendTo(userId: string, now = new Date()): Promise<boolean> {
    const dayStart = new Date(`${kstDate(now)}T00:00:00+09:00`);
    const already = await this.prisma.notification.count({
      where: { userId, kind: 'SUMMARY', createdAt: { gte: dayStart } },
    });
    if (already > 0) return false;
    const off = await this.prisma.notificationSetting.findMany({
      where: { userId, kind: 'SUMMARY', push: false },
      select: { propertyId: true },
    });
    const muted = new Set(off.map((o) => o.propertyId));
    const view = await this.portfolio.get(userId, kstDate(now), now);
    const list = view.properties.filter((p) => p.role === 'OWNER' && !muted.has(p.id));
    if (list.length === 0) return false;
    const lines = list.map((p) => {
      const parts = [`어제 매출 ${won(p.today.yesterdaySales)}`, `미답변 ${p.reviews.unanswered}건`];
      if (p.roomStatus.staleDirty > 0) parts.push(`청소 지연 ${p.roomStatus.staleDirty}실`);
      if (p.staff.missingClockOut > 0) parts.push(`퇴근 누락 ${p.staff.missingClockOut}건`);
      return `${p.name}: ${parts.join(', ')}`;
    });
    const d = kstDate(now);
    const head =
      list.length > 1
        ? `아침 요약 ${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일, 업장 ${list.length}곳`
        : `아침 요약 ${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;
    await this.prisma.notification.create({
      data: {
        propertyId: list[0].id,
        userId,
        kind: 'SUMMARY',
        text: [head, ...lines].join('\n'),
        link: list.length > 1 ? '/app/overview' : '/app',
      },
    });
    return true;
  }
}
