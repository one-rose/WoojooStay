import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { Errors } from '../common/errors/app-error.js';
import type { AdminRole } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** 운영자 토큰은 8시간. 리프레시 없이 만료되면 다시 로그인 */
export const ADMIN_TTL_SECONDS = 8 * 60 * 60;

// 없는 이메일이어도 같은 시간이 걸리도록 비교에 쓰는 해시
const DUMMY_HASH = bcrypt.hashSync('woojoo-not-a-password', 10);

export function toAdminView(a: { id: string; email: string; name: string; role: AdminRole; lastLoginAt: Date | null }) {
  return { id: a.id, email: a.email, name: a.name, role: a.role, lastLoginAt: a.lastLoginAt };
}

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const admin = await this.prisma.adminUser.findUnique({ where: { email } });
    const ok = await bcrypt.compare(password, admin?.passwordHash ?? DUMMY_HASH);
    if (!admin || !ok || !admin.isActive) throw Errors.adminBadCredentials();
    const updated = await this.prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    const accessToken = await this.jwt.signAsync(
      { sub: admin.id, email: admin.email, role: admin.role, typ: 'admin' },
      { expiresIn: ADMIN_TTL_SECONDS },
    );
    return { accessToken, expiresIn: ADMIN_TTL_SECONDS, admin: toAdminView(updated) };
  }

  async me(id: string) {
    const admin = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!admin || !admin.isActive) throw Errors.tokenInvalid();
    return toAdminView(admin);
  }
}

/** CLI·시드와 API 가 같은 규칙으로 운영자를 만든다 */
export async function createAdminUser(
  prisma: PrismaService | { adminUser: PrismaService['adminUser'] },
  input: { email: string; name: string; password: string; role?: AdminRole },
) {
  const email = input.email.trim().toLowerCase();
  const exists = await prisma.adminUser.findUnique({ where: { email } });
  if (exists) throw Errors.emailTaken();
  const admin = await prisma.adminUser.create({
    data: {
      email,
      name: input.name,
      passwordHash: await bcrypt.hash(input.password, 10),
      role: input.role ?? 'OPERATOR',
    },
  });
  return toAdminView(admin);
}
