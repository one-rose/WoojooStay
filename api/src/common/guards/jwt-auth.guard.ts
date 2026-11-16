import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AdminRole } from '../../generated/prisma/enums.js';
import { AdminOnly, IS_PUBLIC, type AuthAdmin, type AuthUser } from '../decorators/auth.decorators.js';
import { Errors } from '../errors/app-error.js';
import { PrismaService } from '../../prisma/prisma.service.js';

interface AccessPayload {
  sub: string;
  phone: string;
  typ: 'access';
}

interface AdminPayload {
  sub: string;
  email: string;
  role: AdminRole;
  typ: 'admin';
}

/**
 * 전역 가드 — @Public() 이 없으면 Bearer 토큰 필요
 * 사장님 앱 토큰(typ access)과 운영자 토큰(typ admin)은 서로의 API 에 쓸 수 없다.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser; admin?: AuthAdmin }>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw Errors.tokenInvalid();
    const adminMeta = this.reflector.getAllAndOverride(AdminOnly, [ctx.getHandler(), ctx.getClass()]);
    if (adminMeta) {
      let payload: AdminPayload;
      try {
        payload = await this.jwt.verifyAsync<AdminPayload>(token);
      } catch {
        throw Errors.tokenInvalid();
      }
      if (payload.typ !== 'admin') throw Errors.tokenInvalid();
      // 토큰은 8시간 — 그사이 사용 중지되거나 권한이 바뀌면 바로 반영되도록 매번 DB 를 본다
      const admin = await this.prisma.adminUser.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true, isActive: true },
      });
      if (!admin?.isActive) throw Errors.tokenInvalid();
      if (adminMeta.length > 0 && !adminMeta.includes(admin.role)) {
        throw Errors.adminForbidden();
      }
      req.admin = { id: admin.id, email: admin.email, role: admin.role };
      return true;
    }
    try {
      const payload = await this.jwt.verifyAsync<AccessPayload>(token);
      if (payload.typ !== 'access') throw new Error('wrong type');
      req.user = { id: payload.sub, phone: payload.phone };
      return true;
    } catch {
      throw Errors.tokenInvalid();
    }
  }
}
