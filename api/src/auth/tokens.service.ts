import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../config/env.js';
import { Errors } from '../common/errors/app-error.js';
import { randomToken, sha256 } from '../common/utils/crypto.js';
import { PrismaService } from '../prisma/prisma.service.js';

const ACCESS_TTL = '30m';
const REFRESH_DAYS = 30;
const VERIFICATION_TTL = '10m';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async issue(user: { id: string; phone: string }): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, phone: user.phone, typ: 'access' },
      { expiresIn: ACCESS_TTL },
    );
    const refreshToken = randomToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_DAYS * 86_400_000),
      },
    });
    return { accessToken, refreshToken, expiresIn: 30 * 60 };
  }

  /** 리프레시 토큰은 한 번 쓰면 폐기하고 새로 발급 (탈취 시 재사용 감지) */
  async rotate(refreshToken: string): Promise<TokenPair> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { user: true },
    });
    if (!row || row.expiresAt < new Date()) throw Errors.tokenInvalid();
    if (row.revokedAt) {
      // 이미 쓴 토큰을 다시 씀 → 그 사용자의 모든 세션 끊기
      await this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw Errors.tokenInvalid();
    }
    // 동시에 같은 토큰으로 두 번 갱신하면 한쪽만 통과 (아직 안 쓴 상태일 때만 폐기 성공)
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: row.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (claimed.count !== 1) throw Errors.tokenInvalid();
    return this.issue(row.user);
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** 휴대폰 인증을 마쳤다는 증명 — 가입·비밀번호 재설정에 사용 */
  signVerification(phone: string, purpose: 'signup' | 'reset'): Promise<string> {
    return this.jwt.signAsync(
      { phone, purpose, typ: 'verified-phone' },
      { expiresIn: VERIFICATION_TTL, secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }) },
    );
  }

  async readVerification(token: string, purpose: 'signup' | 'reset'): Promise<string> {
    try {
      const p = await this.jwt.verifyAsync<{ phone: string; purpose: string; typ: string }>(token, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      });
      if (p.typ !== 'verified-phone' || p.purpose !== purpose) throw new Error('mismatch');
      return p.phone;
    } catch {
      throw Errors.verificationRequired();
    }
  }
}
