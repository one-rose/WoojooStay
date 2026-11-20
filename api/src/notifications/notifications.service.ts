import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { webOrigin, type Env } from '../config/env.js';
import type { NotificationKind, Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SmsSender } from '../sms/sms-sender.js';

/**
 * F0-13 알림 — 앱 안 알림 + 급한 알림은 문자로도.
 * 문자는 SMS_ALERTS_ENABLED=true 이고, 받는 사람의 알림 설정에서 해당 종류의 "알림톡" 이 켜져 있을 때만
 * (알림톡 발신 프로필이 생기기 전까지는 문자로 대신 보낸다).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsSender,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** 업장 구성원(사장님·매니저, roles 로 좁힐 수 있음) 각자에게 한 건씩. urgent 면 문자도 */
  async notifyProperty(
    propertyId: string,
    kind: NotificationKind,
    text: string,
    link?: string,
    opts: { urgent?: boolean; roles?: Role[] } = {},
  ) {
    const members = await this.prisma.membership.findMany({
      where: { propertyId, role: { in: opts.roles ?? ['OWNER', 'MANAGER'] } },
      select: { userId: true, user: { select: { phone: true } } },
    });
    if (members.length === 0) return;
    await this.prisma.notification.createMany({
      data: members.map((m) => ({ propertyId, userId: m.userId, kind, text, link })),
    });
    if (opts.urgent && this.config.get('SMS_ALERTS_ENABLED', { infer: true }) === 'true') {
      await this.sendSms(propertyId, kind, members, text, link);
    }
  }

  private async sendSms(
    propertyId: string,
    kind: NotificationKind,
    members: { userId: string; user: { phone: string } }[],
    text: string,
    link?: string,
  ) {
    const off = await this.prisma.notificationSetting.findMany({
      where: { propertyId, kind, alimtalk: false, userId: { in: members.map((m) => m.userId) } },
      select: { userId: true },
    });
    const muted = new Set(off.map((s) => s.userId));
    const url = link ? ` ${webOrigin(this.config.get('WEB_ORIGIN', { infer: true }))}${link}` : '';
    const property = await this.prisma.property.findUnique({ where: { id: propertyId }, select: { name: true } });
    const msg = `[우주스테이] ${property?.name ?? ''} ${text}${url}`.replace(/\s+/g, ' ').trim();
    for (const m of members) {
      if (muted.has(m.userId)) continue;
      // 문자 한 건 실패가 수집·리뷰 처리를 멈추지 않게
      await this.sms.send(m.user.phone, msg).catch((e: Error) => this.logger.warn(`알림 문자 실패: ${e.message}`));
    }
  }

  /**
   * 내가 지금 사장님·매니저인 업장의 알림만 — 업장에서 빠졌거나 직원(STAFF)으로 내려가면 그 업장 알림은 안 보인다.
   * propertyId 가 없으면 그런 업장 전부.
   */
  private where(userId: string, propertyId?: string) {
    return {
      userId,
      ...(propertyId ? { propertyId } : {}),
      property: { memberships: { some: { userId, role: { in: ['OWNER', 'MANAGER'] as Role[] } } } },
    };
  }

  /** propertyId 가 없으면 내 업장 전부 (여러 업장 통합 알림) — 알림마다 업장 이름을 붙인다 */
  async list(userId: string, propertyId?: string) {
    const where = this.where(userId, propertyId);
    const [rows, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { property: { select: { name: true } } },
      }),
      this.prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);
    const items = rows.map(({ property, ...n }) => ({ ...n, propertyName: property.name }));
    return { unread, items };
  }

  async read(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { ...this.where(userId), id, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async readAll(userId: string, propertyId?: string) {
    await this.prisma.notification.updateMany({
      where: { ...this.where(userId, propertyId), readAt: null },
      data: { readAt: new Date() },
    });
  }
}
