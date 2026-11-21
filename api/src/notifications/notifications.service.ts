import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { webOrigin, type Env } from '../config/env.js';
import type { NotificationKind, Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DevicesService } from '../push/devices.service.js';
import { PushSender } from '../push/push-sender.js';
import { SmsSender } from '../sms/sms-sender.js';

/**
 * F0-13 알림 — 앱 안 알림 + 앱 푸시(등록한 기기, 알림 설정의 "앱 푸시"가 켜진 사람만) + 급한 알림은 문자로도.
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
    private readonly pushSender: PushSender,
    private readonly devices: DevicesService,
  ) {}

  /**
   * 업장 구성원(사장님·매니저, roles 로 좁힐 수 있음) 각자에게 한 건씩 + 앱 푸시. urgent 면 문자도.
   * excludeUserIds: 이 사람들은 빼고 (예: 요청을 보낸 매니저 본인)
   */
  async notifyProperty(
    propertyId: string,
    kind: NotificationKind,
    text: string,
    link?: string,
    opts: { urgent?: boolean; roles?: Role[]; excludeUserIds?: string[] } = {},
  ) {
    const exclude = opts.excludeUserIds ?? [];
    const members = await this.prisma.membership.findMany({
      where: {
        propertyId,
        role: { in: opts.roles ?? ['OWNER', 'MANAGER'] },
        ...(exclude.length ? { userId: { notIn: exclude } } : {}),
      },
      select: { userId: true, user: { select: { phone: true } } },
    });
    if (members.length === 0) return;
    const created = await this.prisma.notification.createManyAndReturn({
      data: members.map((m) => ({ propertyId, userId: m.userId, kind, text, link })),
      select: { id: true, userId: true },
    });
    await this.push(propertyId, kind, text, link, created, opts.urgent);
    if (opts.urgent && this.config.get('SMS_ALERTS_ENABLED', { infer: true }) === 'true') {
      await this.sendSms(propertyId, kind, members, text, link);
    }
  }

  /**
   * 한 사람에게만 (직원 포함) — 출근 요청 결과 등. 앱 알림 목록에서 그 사람만 보고(personal), 앱 푸시도 보낸다.
   * 그 업장 구성원이 아니면 보내지 않는다.
   */
  async notifyUser(userId: string, propertyId: string, kind: NotificationKind, text: string, link?: string) {
    const member = await this.prisma.membership.findUnique({
      where: { userId_propertyId: { userId, propertyId } },
      select: { id: true },
    });
    if (!member) return;
    const n = await this.prisma.notification.create({
      data: { propertyId, userId, kind, text, link, personal: true },
      select: { id: true, userId: true },
    });
    await this.push(propertyId, kind, text, link, [n]);
  }

  /**
   * 앱 푸시 — 알림 설정에서 그 종류의 "앱 푸시"를 끈 사람은 빼고, 등록한 기기 전부로.
   * FCM 이 무효라고 한 토큰은 지운다. 푸시가 실패해도 알림 만들기·본 요청은 멈추지 않는다.
   */
  async push(
    propertyId: string,
    kind: NotificationKind,
    text: string,
    link: string | undefined,
    to: { id: string; userId: string | null }[],
    urgent = false,
  ) {
    try {
      const userIds = [...new Set(to.map((n) => n.userId).filter((u): u is string => !!u))];
      if (userIds.length === 0) return;
      const off = await this.prisma.notificationSetting.findMany({
        where: { propertyId, kind, push: false, userId: { in: userIds } },
        select: { userId: true },
      });
      const muted = new Set(off.map((s) => s.userId));
      const targets = userIds.filter((u) => !muted.has(u));
      if (targets.length === 0) return;
      const [devices, property] = await Promise.all([
        this.prisma.device.findMany({ where: { userId: { in: targets } } }),
        this.prisma.property.findUnique({ where: { id: propertyId }, select: { name: true } }),
      ]);
      if (devices.length === 0) return;
      const invalid: string[] = [];
      // 사람마다 그 사람 알림 id 를 붙여 보낸다 (앱이 누르면 읽음 처리)
      for (const userId of targets) {
        const mine = devices.filter((d) => d.userId === userId);
        if (mine.length === 0) continue;
        const notificationId = to.find((n) => n.userId === userId)?.id;
        const r = await this.pushSender.send(
          mine.map((d) => ({ token: d.token, platform: d.platform })),
          {
            title: property?.name ?? '우주스테이',
            body: text,
            link,
            urgent,
            data: { kind, propertyId, ...(notificationId ? { notificationId } : {}) },
          },
        );
        invalid.push(...r.invalidTokens);
      }
      await this.devices.dropInvalid(invalid);
    } catch (e) {
      this.logger.warn(`앱 푸시 실패: ${(e as Error).message}`);
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
   * 나에게만 보낸 알림(personal — 출근 요청 결과 등)은 그 업장 구성원이면 직원도 본다.
   * propertyId 가 없으면 그런 업장 전부.
   */
  private where(userId: string, propertyId?: string) {
    return {
      userId,
      ...(propertyId ? { propertyId } : {}),
      OR: [
        { property: { memberships: { some: { userId, role: { in: ['OWNER', 'MANAGER'] as Role[] } } } } },
        { personal: true, property: { memberships: { some: { userId } } } },
      ],
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
