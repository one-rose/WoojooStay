import { Injectable } from '@nestjs/common';
import { BillingService } from '../billing/billing.service.js';
import { Errors } from '../common/errors/app-error.js';
import { Role } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BizVerifier } from './biz-verifier.js';
import type { CreatePropertyDto, UpdatePropertyDto } from './dto/property.dto.js';

@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly biz: BizVerifier,
    private readonly billing: BillingService,
  ) {}

  async checkBizNo(bizNo: string) {
    const status = await this.biz.check(bizNo);
    return { bizNo, status };
  }

  /** F0-02 업장 등록 — 만든 사람이 사장님(OWNER), 답글 설정 기본값 + 30일 무료 체험(F0-08)도 같이 만든다 */
  async create(userId: string, dto: CreatePropertyDto) {
    const status = await this.biz.check(dto.bizNo);
    if (status === 'INVALID') throw Errors.bizNoInvalid();
    if (status === 'CLOSED') throw Errors.bizClosed();
    // 같은 사업자번호가 다른 사장님 계정에 이미 있으면 막는다 (내 업장끼리는 같은 번호 허용)
    const taken = await this.prisma.property.findFirst({
      where: {
        bizNo: dto.bizNo,
        memberships: { some: { role: Role.OWNER } },
        NOT: { memberships: { some: { userId, role: Role.OWNER } } },
      },
      select: { id: true },
    });
    if (taken) throw Errors.bizNoTaken();
    const property = await this.prisma.property.create({
      data: {
        name: dto.name.trim(),
        type: dto.type,
        address: dto.address.trim(),
        rooms: dto.rooms,
        bizNo: dto.bizNo,
        ownerName: dto.ownerName.trim(),
        phone: dto.phone,
        bizVerified: true,
        memberships: { create: { userId, role: Role.OWNER } },
        replySettings: { create: { signature: `${dto.name} 드림` } },
      },
    });
    await this.billing.startTrial(property.id);
    return property;
  }

  listMine(userId: string) {
    return this.prisma.property.findMany({
      where: { memberships: { some: { userId } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** 직원(STAFF)에게는 사업자번호·대표자 이름·담당 운영자를 내려주지 않는다 */
  async get(propertyId: string, viewerRole?: Role) {
    const p = await this.prisma.property.findUniqueOrThrow({ where: { id: propertyId } });
    if (viewerRole !== Role.STAFF) return p;
    const { bizNo: _bizNo, ownerName: _ownerName, managerId: _managerId, ...rest } = p;
    return rest;
  }

  async update(propertyId: string, dto: UpdatePropertyDto) {
    // 사업자번호는 바꿀 수 없다
    return this.prisma.property.update({
      where: { id: propertyId },
      data: {
        name: dto.name,
        type: dto.type,
        address: dto.address,
        rooms: dto.rooms,
        ownerName: dto.ownerName,
        phone: dto.phone,
      },
    });
  }
}
