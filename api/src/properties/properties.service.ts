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

  async get(propertyId: string) {
    return this.prisma.property.findUniqueOrThrow({ where: { id: propertyId } });
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
