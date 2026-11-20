import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Errors } from '../common/errors/app-error.js';
import { exposeDevSecrets, webOrigin, type Env } from '../config/env.js';
import { randomToken, sha256 } from '../common/utils/crypto.js';
import { maskPhone } from '../common/utils/phone.js';
import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SmsQuota, smsSafeName } from '../sms/sms-quota.js';
import { SmsSender } from '../sms/sms-sender.js';

const INVITE_DAYS = 7;

/** 사장님 수를 바꿀 수 있는 작업(권한 변경·내보내기)은 업장마다 한 번에 하나씩 — 사장님 0명 경쟁 방지 */
export const ownersLockKey = (propertyId: string) => `owners:${propertyId}`;

/** F0-03 직원 계정·권한 */
@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsSender,
    private readonly quota: SmsQuota,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private inviteUrl(token: string) {
    return `${webOrigin(this.config.get('WEB_ORIGIN', { infer: true }))}/app/invite?token=${token}`;
  }

  private dev(token: string) {
    return exposeDevSecrets(this.config.get('NODE_ENV', { infer: true })) ? { devToken: token } : {};
  }

  /** 사장님(OWNER)에게는 번호 전체, 매니저에게는 가린 번호 */
  async list(propertyId: string, viewerRole: Role = Role.MANAGER) {
    const show = (phone: string) => (viewerRole === Role.OWNER ? phone : maskPhone(phone));
    const [members, invitations] = await Promise.all([
      this.prisma.membership.findMany({
        where: { propertyId },
        include: { user: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.invitation.findMany({
        where: { propertyId, acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.user.name,
        phone: show(m.user.phone),
        role: m.role,
        joinedAt: m.createdAt,
      })),
      invitations: invitations.map((i) => ({
        id: i.id,
        phone: show(i.phone),
        role: i.role,
        expiresAt: i.expiresAt,
        createdAt: i.createdAt,
      })),
    };
  }

  async invite(propertyId: string, invitedById: string, phone: string, role: Role) {
    if (role === Role.OWNER) throw Errors.forbidden();
    const property = await this.prisma.property.findUniqueOrThrow({ where: { id: propertyId } });
    // 이미 이 업장 구성원인 번호는 다시 초대하지 않는다
    const member = await this.prisma.membership.findFirst({ where: { propertyId, user: { phone } } });
    if (member) throw Errors.alreadyMember();
    // 단건 초대는 묶음 없이 — 수락해도 이 업장만
    return this.quota.use(invitedById, 'INVITE', async () => {
      const token = await this.createInvitation(propertyId, invitedById, phone, role, null);
      await this.sms.send(
        phone,
        `[우주스테이] ${smsSafeName(property.name)}에서 초대했어요. 7일 안에 가입해 주세요: ${this.inviteUrl(token)}`,
      );
      return { ok: true, expiresInDays: INVITE_DAYS, ...this.dev(token) };
    });
  }

  /**
   * 한 사람을 내 업장 여러 곳에 한 번에 초대 (F8) — 문자는 한 통. 링크 하나로 수락하면 함께 보낸 초대(같은 묶음)가 모두 수락된다.
   * 사장님(OWNER)인 업장만 · 이미 구성원인 업장은 건너뛴다.
   */
  async inviteMany(invitedById: string, phone: string, role: Role, propertyIds: string[]) {
    if (role === Role.OWNER) throw Errors.forbidden();
    const owned = await this.prisma.membership.findMany({
      where: { userId: invitedById, role: Role.OWNER, propertyId: { in: propertyIds } },
      include: { property: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    if (owned.length !== new Set(propertyIds).size) throw Errors.forbidden();
    const already = await this.prisma.membership.findMany({
      where: { propertyId: { in: propertyIds }, user: { phone } },
      select: { propertyId: true },
    });
    const skip = new Set(already.map((m) => m.propertyId));
    const targets = owned.map((o) => o.property).filter((p) => !skip.has(p.id));
    if (targets.length === 0) throw Errors.alreadyMember();
    const batchId = randomUUID();
    return this.quota.use(invitedById, 'INVITE', async () => {
      const tokens: string[] = [];
      for (const p of targets) tokens.push(await this.createInvitation(p.id, invitedById, phone, role, batchId));
      await this.sms.send(
        phone,
        `[우주스테이] ${this.whereText(targets.map((t) => t.name))}에서 초대했어요. 7일 안에 가입해 주세요: ${this.inviteUrl(tokens[0])}`,
      );
      return {
        ok: true,
        invited: targets.map((p) => p.name),
        skipped: owned.filter((o) => skip.has(o.propertyId)).map((o) => o.property.name),
        expiresInDays: INVITE_DAYS,
        ...this.dev(tokens[0]),
      };
    });
  }

  private whereText(names: string[]) {
    const first = smsSafeName(names[0] ?? '');
    return names.length > 1 ? `${first} 외 ${names.length - 1}곳` : first;
  }

  private async createInvitation(
    propertyId: string,
    invitedById: string,
    phone: string,
    role: Role,
    batchId: string | null,
  ) {
    const token = randomToken(24);
    // 같은 번호로 보낸 대기 중 초대는 새 초대로 바꾼다 (목록에 "초대 중" 이 쌓이지 않게)
    await this.prisma.invitation.deleteMany({ where: { propertyId, phone, acceptedAt: null } });
    await this.prisma.invitation.create({
      data: {
        propertyId,
        phone,
        role,
        invitedById,
        batchId,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
      },
    });
    return token;
  }

  /** 같은 묶음(batchId)으로 함께 보낸, 아직 유효한 다른 초대 — 단건 초대는 없음 */
  private async siblings(inv: { id: string; batchId: string | null }) {
    if (!inv.batchId) return [];
    return this.prisma.invitation.findMany({
      where: { id: { not: inv.id }, batchId: inv.batchId, acceptedAt: null, expiresAt: { gt: new Date() } },
      include: { property: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** 초대를 보낸 사람이 지금도 그 업장 사장님인지 — 아니면 그 초대는 무효 */
  private async inviterStillOwner(inv: { propertyId: string; invitedById: string }) {
    const m = await this.prisma.membership.findUnique({
      where: { userId_propertyId: { userId: inv.invitedById, propertyId: inv.propertyId } },
      select: { role: true },
    });
    return m?.role === Role.OWNER;
  }

  /** 초대 링크 미리보기 — 로그인 전에 어느 업장의 초대인지 보여 준다 (토큰을 아는 사람만) */
  async preview(token: string) {
    const inv = await this.prisma.invitation.findUnique({
      where: { tokenHash: sha256(token) },
      include: { property: { select: { name: true } } },
    });
    if (!inv) throw Errors.invitationInvalid();
    let status: 'USED' | 'EXPIRED' | 'VALID' = inv.acceptedAt
      ? 'USED'
      : inv.expiresAt < new Date()
        ? 'EXPIRED'
        : 'VALID';
    if (status === 'VALID' && !(await this.inviterStillOwner(inv))) status = 'EXPIRED';
    // 여러 업장에 함께 초대했으면 그 업장들도 (수락하면 함께 합류)
    const also = status === 'VALID' ? await this.validSiblings(inv) : [];
    return {
      propertyName: inv.property.name,
      role: inv.role,
      phone: maskPhone(inv.phone),
      status,
      alsoProperties: also.map((s) => s.property.name),
      /** 수락하면 합류할 업장과 업장별 권한 (첫 줄이 이 링크의 업장) */
      properties: [
        { name: inv.property.name, role: inv.role },
        ...also.map((s) => ({ name: s.property.name, role: s.role })),
      ],
    };
  }

  private async validSiblings(inv: { id: string; batchId: string | null }) {
    const list = await this.siblings(inv);
    const ok = await Promise.all(list.map((s) => this.inviterStillOwner(s)));
    return list.filter((_, i) => ok[i]);
  }

  /** 초대받은 번호로 로그인한 사람만 수락할 수 있다 */
  async accept(userId: string, userPhone: string, token: string) {
    const inv = await this.prisma.invitation.findUnique({ where: { tokenHash: sha256(token) } });
    if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) throw Errors.invitationInvalid();
    if (inv.phone !== userPhone) throw Errors.invitationPhoneMismatch();
    // 보낸 사람이 그 사이 사장님에서 빠졌으면 무효
    if (!(await this.inviterStillOwner(inv))) {
      await this.prisma.invitation.delete({ where: { id: inv.id } });
      throw Errors.invitationInvalid();
    }
    // 같은 묶음으로 함께 보낸 초대만 링크 하나로 함께 수락
    const all = [inv, ...(await this.validSiblings(inv))];
    // 직원 명단 연결로 이미 직원(STAFF)이면 초대받은 권한(매니저)으로 올린다 — 사장님·매니저 권한은 내리지 않는다
    const current = await this.prisma.membership.findMany({
      where: { userId, propertyId: { in: all.map((i) => i.propertyId) } },
    });
    const roleOf = (i: { propertyId: string; role: Role }) => {
      const had = current.find((m) => m.propertyId === i.propertyId)?.role;
      return had === Role.STAFF && i.role === Role.MANAGER ? { role: i.role } : {};
    };
    await this.prisma.$transaction(
      all.flatMap((i) => [
        this.prisma.membership.upsert({
          where: { userId_propertyId: { userId, propertyId: i.propertyId } },
          create: { userId, propertyId: i.propertyId, role: i.role },
          update: roleOf(i),
        }),
        this.prisma.invitation.update({ where: { id: i.id }, data: { acceptedAt: new Date() } }),
        // 같은 번호로 남아 있던 다른 대기 초대 정리
        this.prisma.invitation.deleteMany({
          where: { propertyId: i.propertyId, phone: i.phone, acceptedAt: null, id: { notIn: all.map((x) => x.id) } },
        }),
        // 사장님이 먼저 직원 명단에 같은 번호로 등록해 뒀다면 앱 계정과 연결 (본인 출퇴근)
        this.prisma.employee.updateMany({
          where: { propertyId: i.propertyId, phone: userPhone, userId: null },
          data: { userId },
        }),
      ]),
    );
    return { propertyId: inv.propertyId, role: inv.role, joined: all.length };
  }

  /** 대기 중 초대 취소 (사장님) */
  async cancelInvitation(propertyId: string, invitationId: string) {
    const r = await this.prisma.invitation.deleteMany({ where: { id: invitationId, propertyId, acceptedAt: null } });
    if (r.count === 0) throw Errors.notFound('초대');
  }

  /**
   * 초대 문자 다시 보내기 (사장님) — 새 링크로 바꾸고 7일 다시. 묶음 초대면 함께 보낸 업장도 같이 연장.
   * 예전 링크는 더 이상 쓸 수 없다.
   */
  async resendInvitation(propertyId: string, userId: string, invitationId: string) {
    const inv = await this.prisma.invitation.findFirst({
      where: { id: invitationId, propertyId, acceptedAt: null },
      include: { property: { select: { name: true } } },
    });
    if (!inv) throw Errors.notFound('초대');
    const member = await this.prisma.membership.findFirst({ where: { propertyId, user: { phone: inv.phone } } });
    if (member) throw Errors.alreadyMember();
    return this.quota.use(userId, 'INVITE_RESEND', async () => {
      const token = randomToken(24);
      const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000);
      // 다시 보낸 사람이 이제 초대한 사람 (보낸 사람이 사장님에서 빠져도 이 초대는 살아 있게)
      await this.prisma.invitation.update({
        where: { id: inv.id },
        data: { tokenHash: sha256(token), expiresAt, invitedById: userId },
      });
      const siblings = inv.batchId
        ? await this.prisma.invitation.findMany({
            where: { batchId: inv.batchId, id: { not: inv.id }, acceptedAt: null },
            include: { property: { select: { name: true } } },
          })
        : [];
      if (siblings.length)
        await this.prisma.invitation.updateMany({
          where: { id: { in: siblings.map((s) => s.id) } },
          data: { expiresAt },
        });
      await this.sms.send(
        inv.phone,
        `[우주스테이] ${this.whereText([inv.property.name, ...siblings.map((s) => s.property.name)])}에서 초대했어요. 7일 안에 가입해 주세요: ${this.inviteUrl(token)}`,
      );
      return { ok: true, expiresInDays: INVITE_DAYS, ...this.dev(token) };
    });
  }

  async changeRole(propertyId: string, membershipId: string, role: Role) {
    return this.prisma.withLock(ownersLockKey(propertyId), async () => {
      // 잠금 안에서 다시 읽고 사장님 수를 확인한다
      const m = await this.find(propertyId, membershipId);
      if (m.role === Role.OWNER && role !== Role.OWNER) {
        await this.ensureAnotherOwner(propertyId);
        await this.dropInvitationsBy(propertyId, m.userId);
      }
      return this.prisma.membership.update({ where: { id: m.id }, data: { role } });
    });
  }

  async remove(propertyId: string, membershipId: string) {
    await this.prisma.withLock(ownersLockKey(propertyId), async () => {
      const m = await this.find(propertyId, membershipId);
      if (m.role === Role.OWNER) {
        await this.ensureAnotherOwner(propertyId);
        await this.dropInvitationsBy(propertyId, m.userId);
      }
      await this.prisma.membership.delete({ where: { id: m.id } });
    });
  }

  /** 사장님에서 내려가거나 나간 사람이 이 업장에서 보낸 대기 중 초대는 지운다 */
  private dropInvitationsBy(propertyId: string, userId: string) {
    return this.prisma.invitation.deleteMany({ where: { propertyId, invitedById: userId, acceptedAt: null } });
  }

  private async find(propertyId: string, membershipId: string) {
    const m = await this.prisma.membership.findFirst({ where: { id: membershipId, propertyId } });
    if (!m) throw Errors.notFound('직원');
    return m;
  }

  private async ensureAnotherOwner(propertyId: string) {
    const owners = await this.prisma.membership.count({ where: { propertyId, role: Role.OWNER } });
    if (owners <= 1) throw Errors.lastOwner();
  }
}
