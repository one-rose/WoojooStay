import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AdminRole, Role } from '../../generated/prisma/enums.js';

export interface AuthUser {
  id: string;
  phone: string;
}

/** 로그인 없이 부를 수 있는 API */
export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

/**
 * 운영자 전용 API — 사장님 앱 토큰으로는 부를 수 없다.
 * 값은 필요한 운영자 권한. 빈 배열이면 운영자 누구나: @AdminOnly([])
 */
export const AdminOnly = Reflector.createDecorator<AdminRole[]>();

export interface AuthAdmin {
  id: string;
  email: string;
  role: AdminRole;
}

export const CurrentAdmin = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthAdmin => {
  return ctx.switchToHttp().getRequest<{ admin: AuthAdmin }>().admin;
});

/** 업장(:propertyId) 안에서 필요한 권한 — 기능정의서 F0-03 권한표 */
export const PropertyRoles = Reflector.createDecorator<Role[]>();

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<{ user: AuthUser }>().user;
});
