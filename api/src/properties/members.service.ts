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
    const url = `${webOrigin(this.config.get('WEB_ORIGIN', { infer: true }))}/app/invite?token=${token}`;
    await this.sms.send(phone, `[우주스테이] ${property.name}에서 초대했어요. 7일 안에 가입해 주세요: ${url}`);
    return {
      ok: true,
      expiresInDays: INVITE_DAYS,
      ...(exposeDevSecrets(this.config.get('NODE_ENV', { infer: true })) ? { devToken: token } : {}),
    };
  }

  /** 초대 링크 미리보기 — 로그인 전에 어느 업장의 초대인지 보여 준다 (토큰을 아는 사람만) */
  async preview(token: string) {
    const inv = await this.prisma.invitation.findUnique({
      where: { tokenHash: sha256(token) },
      include: { property: { select: { name: true } } },
    });
    if (!inv) throw Errors.invitationInvalid();
    const status = inv.acceptedAt ? 'USED' : inv.expiresAt < new Date() ? 'EXPIRED' : 'VALID';
    return { propertyName: inv.property.name, role: inv.role, phone: maskPhone(inv.phone), status };
  }

  /** 초대받은 번호로 로그인한 사람만 수락할 수 있다 */
  async accept(userId: string, userPhone: string, token: string) {
    const inv = await this.prisma.invitation.findUnique({ where: { tokenHash: sha256(token) } });
    if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) throw Errors.invitationInvalid();
    if (inv.phone !== userPhone) throw Errors.invitationPhoneMismatch();
    await this.prisma.$transaction([
      this.prisma.membership.upsert({
        where: { userId_propertyId: { userId, propertyId: inv.propertyId } },
        create: { userId, propertyId: inv.propertyId, role: inv.role },
        update: {},
      }),
      this.prisma.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } }),
      // 같은 번호로 남아 있던 다른 대기 초대 정리
      this.prisma.invitation.deleteMany({
        where: { propertyId: inv.propertyId, phone: inv.phone, acceptedAt: null, id: { not: inv.id } },
      }),
      // 사장님이 먼저 직원 명단에 같은 번호로 등록해 뒀다면 앱 계정과 연결 (본인 출퇴근)
      this.prisma.employee.updateMany({
        where: { propertyId: inv.propertyId, phone: userPhone, userId: null },
        data: { userId },
      }),
    ]);
    return { propertyId: inv.propertyId, role: inv.role };
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
