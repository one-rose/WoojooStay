import { Injectable } from '@nestjs/common';
import { ChannelsService } from '../channels/channels.service.js';
import { Errors } from '../common/errors/app-error.js';
import { CHANNEL_CATALOG } from '../connectors/catalog.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { Channel, InquiryStatus } from '../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { kstDate } from '../common/utils/dates.js';
import { pilotInfo } from '../common/utils/pilot.js';
import { createAdminUser, toAdminView } from './admin-auth.service.js';
import { PilotService, toSurvey } from './pilot.service.js';
import type { CreateAdminDto, CreateInquiryDto, ListPropertiesQuery, UpdateInquiryDto } from './dto/admin.dto.js';

const ISSUE_STATUSES = ['AUTH_EXPIRED', 'ERROR'] as const;

/** F0-14 운영자 화면 — 업장 현황, 수집 오류, 도입 문의 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly channels: ChannelsService,
    private readonly notifications: NotificationsService,
    private readonly pilot: PilotService,
  ) {}

  async overview() {
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);
    const [properties, newProperties, trial, active, issues, newInquiries] = await Promise.all([
      this.prisma.property.count(),
      this.prisma.property.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.subscription.groupBy({ by: ['propertyId'], where: { status: 'TRIAL' } }),
      this.prisma.subscription.groupBy({ by: ['propertyId'], where: { status: 'ACTIVE' } }),
      this.prisma.channelConnection.count({ where: { status: { in: [...ISSUE_STATUSES] } } }),
      this.prisma.inquiry.count({ where: { status: 'NEW' } }),
    ]);
    const mrr = await this.prisma.subscription.findMany({ where: { status: 'ACTIVE' }, include: { plan: true } });
    return {
      properties,
      newProperties,
      trialProperties: trial.length,
      payingProperties: active.length,
      monthlyRevenue: mrr.reduce((s, x) => s + x.plan.monthlyPrice, 0),
      syncIssues: issues,
      newInquiries,
    };
  }

  async listProperties(query: ListPropertiesQuery) {
    const q = query.q?.trim();
    const where: Prisma.PropertyWhereInput = {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { ownerName: { contains: q } },
              { bizNo: { contains: q.replace(/\D/g, '') || q } },
            ],
          }
        : {}),
      ...(query.filter === 'issue' ? { channels: { some: { status: { in: [...ISSUE_STATUSES] } } } } : {}),
      ...(query.filter === 'trial' ? { subscriptions: { some: { status: 'TRIAL' } } } : {}),
      ...(query.filter === 'pilot' ? { pilotGroup: { not: null } } : {}),
      ...(query.ownerId ? { memberships: { some: { userId: query.ownerId, role: 'OWNER' as const } } } : {}),
    };
    const rows = await this.prisma.property.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        manager: { select: { id: true, name: true } },
        subscriptions: { select: { planCode: true, status: true, trialEndsAt: true } },
        channels: { select: { channel: true, status: true, lastSyncedAt: true } },
        memberships: {
          where: { role: { in: ['OWNER', 'MANAGER'] } },
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { id: true, name: true, phone: true, lastLoginAt: true } } },
        },
        _count: { select: { reviews: { where: { status: 'UNANSWERED' } } } },
      },
    });
    const activation = await this.pilot.activation(rows.map((p) => p.id));
    const today = kstDate();
    return rows.map((p) => {
      const synced = p.channels.map((c) => c.lastSyncedAt?.getTime() ?? 0);
      const last = synced.length ? Math.max(...synced) : 0;
      const owner = p.memberships.find((m) => m.role === 'OWNER')?.user;
      const managerLogins = p.memberships.filter((m) => m.role === 'MANAGER').map((m) => m.user.lastLoginAt);
      return {
        id: p.id,
        name: p.name,
        type: p.type,
        rooms: p.rooms,
        address: p.address,
        ownerName: owner?.name ?? p.ownerName,
        ownerPhone: owner?.phone ?? p.phone,
        createdAt: p.createdAt,
        manager: p.manager,
        subscriptions: p.subscriptions,
        channelCount: p.channels.length,
        issueCount: p.channels.filter((c) => (ISSUE_STATUSES as readonly string[]).includes(c.status)).length,
        lastSyncedAt: last ? new Date(last) : null,
        unansweredReviews: p._count.reviews,
        /** 사장님 계정 — 사장님 단위로 묶어 보기·필터(?ownerId=) 용 (PO-23) */
        owner: owner ? { id: owner.id, name: owner.name, phone: owner.phone } : null,
        /** 최근 접속 — 사장님 · 매니저 중 가장 최근 (PO-01) */
        lastLogin: { owner: owner?.lastLoginAt ?? null, manager: latestDate(managerLogins) },
        pilot: pilotInfo(p, today),
        activation: activation.get(p.id) ?? null,
      };
    });
  }

  async propertyDetail(id: string) {
    const p = await this.prisma.property.findUnique({
      where: { id },
      include: {
        manager: { select: { id: true, name: true } },
        subscriptions: { include: { plan: true } },
        channels: {
          select: { channel: true, status: true, lastSyncedAt: true, lastError: true, consecutiveFails: true },
        },
        memberships: { include: { user: { select: { name: true, phone: true, lastLoginAt: true } } } },
        payments: { orderBy: { paidAt: 'desc' }, take: 12 },
        pilotSurvey: true,
      },
    });
    if (!p) throw Errors.notFound('업장');
    const [activation, aiUsage, notes] = await Promise.all([
      this.pilot.activation([p.id]),
      this.pilot.aiUsage(p.id),
      this.pilot.notes(p.id),
    ]);
    return {
      id: p.id,
      name: p.name,
      type: p.type,
      address: p.address,
      rooms: p.rooms,
      bizNo: p.bizNo,
      bizVerified: p.bizVerified,
      ownerName: p.ownerName,
      createdAt: p.createdAt,
      manager: p.manager,
      subscriptions: p.subscriptions.map((s) => ({
        planCode: s.planCode,
        planName: s.plan.name,
        monthlyPrice: s.plan.monthlyPrice,
        status: s.status,
        trialEndsAt: s.trialEndsAt,
      })),
      channels: p.channels.map((c) => ({ ...c, name: CHANNEL_CATALOG[c.channel].name })),
      members: p.memberships.map((m) => ({
        role: m.role,
        name: m.user.name,
        phone: m.user.phone,
        lastLoginAt: m.user.lastLoginAt,
      })),
      payments: p.payments,
      pilot: pilotInfo(p, kstDate()),
      survey: p.pilotSurvey ? toSurvey(p.pilotSurvey) : null,
      activation: activation.get(p.id) ?? null,
      /** 최근 6개월 AI 답글 사용량 (PO-16) */
      aiUsage,
      /** 지원 메모 최근 100건 (PO-23) */
      notes,
    };
  }

  async assignManager(propertyId: string, managerId: string | null | undefined) {
    if (managerId) {
      const admin = await this.prisma.adminUser.findUnique({ where: { id: managerId } });
      if (!admin?.isActive) throw Errors.notFound('운영자');
    }
    const exists = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!exists) throw Errors.notFound('업장');
    await this.prisma.property.update({ where: { id: propertyId }, data: { managerId: managerId ?? null } });
    return this.propertyDetail(propertyId);
  }

  /** 수집이 멈춘 채널 — 계정 만료·오류 + 실패가 이어지는 중인 곳 */
  async syncIssues() {
    const rows = await this.prisma.channelConnection.findMany({
      where: { OR: [{ status: { in: [...ISSUE_STATUSES] } }, { consecutiveFails: { gt: 0 } }] },
      orderBy: [{ consecutiveFails: 'desc' }, { updatedAt: 'desc' }],
      include: { property: { select: { id: true, name: true, manager: { select: { name: true } } } } },
    });
    return rows.map((c) => ({
      id: c.id,
      property: { id: c.property.id, name: c.property.name },
      manager: c.property.manager?.name ?? null,
      channel: c.channel,
      channelName: CHANNEL_CATALOG[c.channel].name,
      status: c.status,
      lastError: c.lastError,
      consecutiveFails: c.consecutiveFails,
      lastSyncedAt: c.lastSyncedAt,
    }));
  }

  private async connection(id: string) {
    const c = await this.prisma.channelConnection.findUnique({ where: { id } });
    if (!c) throw Errors.notFound('채널 연결');
    return c;
  }

  async retrySync(id: string) {
    const c = await this.connection(id);
    const result = await this.channels.sync(c.propertyId, c.channel as Channel);
    const after = await this.connection(id);
    return { ...result, status: after.status, lastError: after.lastError };
  }

  /** 사장님께 계정 정보 다시 확인해 달라고 알림 */
  async notifySyncIssue(id: string) {
    const c = await this.connection(id);
    const name = CHANNEL_CATALOG[c.channel].name;
    await this.notifications.notifyProperty(
      c.propertyId,
      'SYNC',
      `${name} 연결에 문제가 있어요. 채널 연결 화면에서 계정 정보를 다시 확인해 주세요.`,
      '/app/settings/channels',
    );
    return { notified: true };
  }

  // ─── 도입 문의 ──────────────────────────────────────────
  async createInquiry(dto: CreateInquiryDto) {
    const row = await this.prisma.inquiry.create({
      data: {
        type: dto.type,
        contactName: dto.contactName.trim(),
        phone: dto.phone,
        email: dto.email,
        propertyName: dto.propertyName?.trim(),
        propertyType: dto.propertyType,
        rooms: dto.rooms,
        message: dto.message.trim(),
      },
    });
    return { id: row.id, createdAt: row.createdAt };
  }

  /** 처리 끝난 문의는 1년 뒤 지운다 (랜딩 동의 문구와 같은 기준) */
  async purgeOldInquiries(now = new Date()) {
    const before = new Date(now);
    before.setUTCFullYear(before.getUTCFullYear() - 1);
    const r = await this.prisma.inquiry.deleteMany({ where: { status: 'DONE', updatedAt: { lt: before } } });
    return r.count;
  }

  async listInquiries(status?: InquiryStatus) {
    const rows = await this.prisma.inquiry.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { handledBy: { select: { id: true, name: true } } },
    });
    const counts = await this.prisma.inquiry.groupBy({ by: ['status'], _count: { _all: true } });
    return {
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      items: rows,
    };
  }

  async updateInquiry(id: string, adminId: string, dto: UpdateInquiryDto) {
    const exists = await this.prisma.inquiry.findUnique({ where: { id } });
    if (!exists) throw Errors.notFound('문의');
    return this.prisma.inquiry.update({
      where: { id },
      data: { status: dto.status, adminMemo: dto.adminMemo, handledById: adminId },
      include: { handledBy: { select: { id: true, name: true } } },
    });
  }

  // ─── 운영자 계정 (최고 관리자만) ───────────────────────────
  async listAdmins() {
    const rows = await this.prisma.adminUser.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map((a) => ({ ...toAdminView(a), isActive: a.isActive }));
  }

  createAdmin(dto: CreateAdminDto) {
    return createAdminUser(this.prisma, dto);
  }

  async setAdminActive(id: string, selfId: string, isActive: boolean) {
    // 내 계정은 스스로 끄거나 다시 켤 수 없다 (사용 중지된 운영자는 애초에 토큰이 막힌다)
    if (id === selfId) throw Errors.adminSelf();
    const exists = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!exists) throw Errors.notFound('운영자');
    const a = await this.prisma.adminUser.update({ where: { id }, data: { isActive } });
    return { ...toAdminView(a), isActive: a.isActive };
  }
}

function latestDate(list: (Date | null)[]): Date | null {
  const t = Math.max(0, ...list.map((d) => d?.getTime() ?? 0));
  return t > 0 ? new Date(t) : null;
}
