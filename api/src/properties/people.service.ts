import { Injectable } from '@nestjs/common';
import { Errors } from '../common/errors/app-error.js';
import { maskPhone } from '../common/utils/phone.js';
import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type AssignRole = 'MANAGER' | 'STAFF' | null;

/**
 * 업장별 매니저 권한 (F8) — 사장님이 내 업장 전부의 사람과 권한을 한곳에서.
 * 사장님(OWNER)인 업장만 다루고, 다른 사장님(OWNER) 권한은 바꾸지 않는다.
 */
@Injectable()
export class PeopleService {
  constructor(private readonly prisma: PrismaService) {}

  private async ownedProperties(ownerId: string) {
    const rows = await this.prisma.membership.findMany({
      where: { userId: ownerId, role: Role.OWNER },
      include: { property: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => r.property);
  }

  async list(ownerId: string) {
    const properties = await this.ownedProperties(ownerId);
    const ids = properties.map((p) => p.id);
    if (ids.length === 0) return { properties, people: [], invitations: [] };
    const [members, invitations] = await Promise.all([
      this.prisma.membership.findMany({
        where: { propertyId: { in: ids }, userId: { not: ownerId } },
        include: { user: { select: { id: true, name: true, phone: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.invitation.findMany({
        where: { propertyId: { in: ids }, acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const people = new Map<string, { userId: string; name: string; phone: string; roles: Record<string, Role> }>();
    for (const m of members) {
      const row = people.get(m.userId) ?? {
        userId: m.userId,
        name: m.user.name,
        phone: maskPhone(m.user.phone),
        roles: {},
      };
      row.roles[m.propertyId] = m.role;
      people.set(m.userId, row);
    }
    // 초대는 번호 · 권한별로 묶는다 (여러 업장에 함께 보낸 초대가 한 줄로)
    const invites = new Map<string, { phone: string; role: Role; propertyIds: string[]; expiresAt: Date }>();
    for (const i of invitations) {
      const key = `${i.phone}:${i.role}`;
      const row = invites.get(key) ?? {
        phone: maskPhone(i.phone),
        role: i.role,
        propertyIds: [],
        expiresAt: i.expiresAt,
      };
      row.propertyIds.push(i.propertyId);
      if (i.expiresAt > row.expiresAt) row.expiresAt = i.expiresAt;
      invites.set(key, row);
    }
    return { properties, people: [...people.values()], invitations: [...invites.values()] };
  }

  /**
   * 한 사람의 업장별 권한을 한 번에 — role 이 null 이면 그 업장에서 뺀다.
   * 이미 내 업장 어딘가의 구성원인 사람만 (처음 보는 번호는 초대로).
   */
  async assign(ownerId: string, userId: string, assignments: { propertyId: string; role: AssignRole }[]) {
    if (userId === ownerId) throw Errors.forbidden();
    const owned = new Set((await this.ownedProperties(ownerId)).map((p) => p.id));
    if (assignments.some((a) => !owned.has(a.propertyId))) throw Errors.forbidden();
    const current = await this.prisma.membership.findMany({
      where: { userId, propertyId: { in: [...owned] } },
    });
    if (current.length === 0) throw Errors.notFound('직원');
    const byProperty = new Map(current.map((m) => [m.propertyId, m]));
    // 다른 사장님(OWNER) 권한은 여기서 바꾸지 않는다
    if (assignments.some((a) => byProperty.get(a.propertyId)?.role === Role.OWNER)) throw Errors.forbidden();
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true } });

    await this.prisma.$transaction(
      assignments.flatMap((a) => {
        const had = byProperty.get(a.propertyId);
        if (a.role === null) return had ? [this.prisma.membership.delete({ where: { id: had.id } })] : [];
        if (had)
          return had.role === a.role
            ? []
            : [this.prisma.membership.update({ where: { id: had.id }, data: { role: a.role } })];
        return [
          this.prisma.membership.create({ data: { userId, propertyId: a.propertyId, role: a.role } }),
          // 그 업장 직원 명단에 같은 번호가 있으면 앱 계정과 연결 (본인 출퇴근)
          this.prisma.employee.updateMany({
            where: { propertyId: a.propertyId, phone: user.phone, userId: null },
            data: { userId },
          }),
        ];
      }),
    );
    return this.list(ownerId);
  }
}
