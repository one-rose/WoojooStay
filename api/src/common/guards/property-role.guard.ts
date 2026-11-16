import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Role } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PropertyRoles, type AuthUser } from '../decorators/auth.decorators.js';
import { Errors } from '../errors/app-error.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * :propertyId 가 있는 API 에서 이 사용자가 그 업장의 구성원인지, 필요한 권한이 있는지 확인
 * 업장 데이터가 다른 업장과 섞이지 않게 하는 핵심 장치 (F0-02 완료 기준)
 */
@Injectable()
export class PropertyRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser; role?: Role }>();
    const propertyId = req.params?.propertyId;
    if (!propertyId || !req.user) return true;
    if (!UUID.test(String(propertyId))) throw Errors.notFound('업장');
    const membership = await this.prisma.membership.findUnique({
      where: { userId_propertyId: { userId: req.user.id, propertyId: String(propertyId) } },
    });
    // 남의 업장은 존재 여부도 알려주지 않는다
    if (!membership) throw Errors.notFound('업장');
    const roles = this.reflector.getAllAndOverride(PropertyRoles, [ctx.getHandler(), ctx.getClass()]);
    if (roles && !roles.includes(membership.role)) throw Errors.forbidden();
    req.role = membership.role;
    return true;
  }
}
