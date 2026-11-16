import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Errors } from '../common/errors/app-error.js';
import { exposeDevSecrets, webOrigin, type Env } from '../config/env.js';
import { randomToken, sha256 } from '../common/utils/crypto.js';
import { maskPhone } from '../common/utils/phone.js';
import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SmsSender } from '../sms/sms-sender.js';

const INVITE_DAYS = 7;

/** F0-03 직원 계정·권한 */
@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsSender,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async list(propertyId: string) {
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
        phone: maskPhone(m.user.phone),
        role: m.role,
        joinedAt: m.createdAt,
      })),
      invitations: invitations.map((i) => ({
        id: i.id,
        phone: maskPhone(i.phone),
        role: i.role,
        expiresAt: i.expiresAt,
      })),
    };
  }

  async invite(propertyId: string, invitedById: string, phone: string, role: Role) {
    if (role === Role.OWNER) throw Errors.forbidden();
    const property = await this.prisma.property.findUniqueOrThrow({ where: { id: propertyId } });
    // 이미 이 업장 구성원인 번호는 다시 초대하지 않는다
    const member = await this.prisma.membership.findFirst({ where: { propertyId, user: { phone } } });
    if (member) throw Errors.alreadyMember();
    const token = await this.createInvitation(propertyId, invitedById, phone, role);
    const url = `${webOrigin(this.config.get('WEB_ORIGIN', { infer: true }))}/app/invite?token=${token}`;
    await this.sms.send(phone, `[우주스테이] ${property.name}에서 초대했어요. 7일 안에 가입해 주세요: ${url}`);
    return {
      ok: true,
      expiresInDays: INVITE_DAYS,
      ...(exposeDevSecrets(this.config.get('NODE_ENV', { infer: true })) ? { devToken: token } : {}),
    };
  }

  /**
   * 한 사람을 내 업장 여러 곳에 한 번에 초대 (F8) — 문자는 한 통. 링크 하나로 수락하면 함께 보낸 초대가 모두 수락된다.
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
    const tokens: string[] = [];
    for (const p of targets) tokens.push(await this.createInvitation(p.id, invitedById, phone, role));
    const url = `${webOrigin(this.config.get('WEB_ORIGIN', { infer: true }))}/app/invite?token=${tokens[0]}`;
    const where = targets.length > 1 ? `${targets[0].name} 외 ${targets.length - 1}곳` : targets[0].name;
    await this.sms.send(phone, `[우주스테이] ${where}에서 초대했어요. 7일 안에 가입해 주세요: ${url}`);
    return {
      ok: true,
      invited: targets.map((p) => p.name),
      skipped: owned.filter((o) => skip.has(o.propertyId)).map((o) => o.property.name),
      expiresInDays: INVITE_DAYS,
      ...(exposeDevSecrets(this.config.get('NODE_ENV', { infer: true })) ? { devToken: tokens[0] } : {}),
    };
  }

  private async createInvitation(propertyId: string, invitedById: string, phone: string, role: Role) {
    const token = randomToken(24);
    // 같은 번호로 보낸 대기 중 초대는 새 초대로 바꾼다 (목록에 "초대 중" 이 쌓이지 않게)
    await this.prisma.invitation.deleteMany({ where: { propertyId, phone, acceptedAt: null } });
    await this.prisma.invitation.create({
      data: {
        propertyId,
        phone,
        role,
        invitedById,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
      },
    });
    return token;
  }

  /** 같은 사람이 같은 번호로 함께 보낸, 아직 유효한 다른 초대 */
  private siblings(inv: { id: string; phone: string; invitedById: string }) {
    return this.prisma.invitation.findMany({
      where: {
        id: { not: inv.id },
        phone: inv.phone,
        invitedById: inv.invitedById,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { property: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** 초대 링크 미리보기 — 로그인 전에 어느 업장의 초대인지 보여 준다 (토큰을 아는 사람만) */
  async preview(token: string) {
    const inv = await this.prisma.invitation.findUnique({
      where: { tokenHash: sha256(token) },
      include: { property: { select: { name: true } } },
    });
    if (!inv) throw Errors.invitationInvalid();
    const status = inv.acceptedAt ? 'USED' : inv.expiresAt < new Date() ? 'EXPIRED' : 'VALID';
    // 여러 업장에 함께 초대했으면 그 업장들도 (수락하면 함께 합류)
    const also = status === 'VALID' ? (await this.siblings(inv)).map((s) => s.property.name) : [];
    return {
      propertyName: inv.property.name,
      role: inv.role,
      phone: maskPhone(inv.phone),
      status,
      alsoProperties: also,
    };
  }

  /** 초대받은 번호로 로그인한 사람만 수락할 수 있다 */
  async accept(userId: string, userPhone: string, token: string) {
    const inv = await this.prisma.invitation.findUnique({ where: { tokenHash: sha256(token) } });
    if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) throw Errors.invitationInvalid();
    if (inv.phone !== userPhone) throw Errors.invitationPhoneMismatch();
    // 여러 업장에 함께 보낸 초대는 링크 하나로 모두 수락
    const all = [inv, ...(await this.siblings(inv))];
    await this.prisma.$transaction(
      all.flatMap((i) => [
        this.prisma.membership.upsert({
          where: { userId_propertyId: { userId, propertyId: i.propertyId } },
          create: { userId, propertyId: i.propertyId, role: i.role },
          update: {},
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

  async changeRole(propertyId: string, membershipId: string, role: Role) {
    const m = await this.find(propertyId, membershipId);
    if (m.role === Role.OWNER && role !== Role.OWNER) await this.ensureAnotherOwner(propertyId);
    return this.prisma.membership.update({ where: { id: m.id }, data: { role } });
  }

  async remove(propertyId: string, membershipId: string) {
    const m = await this.find(propertyId, membershipId);
    if (m.role === Role.OWNER) await this.ensureAnotherOwner(propertyId);
    await this.prisma.membership.delete({ where: { id: m.id } });
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
