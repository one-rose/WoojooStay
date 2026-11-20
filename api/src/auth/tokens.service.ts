import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../config/env.js';
import { Errors } from '../common/errors/app-error.js';
import { randomToken, sha256 } from '../common/utils/crypto.js';
import { kstDate } from '../common/utils/dates.js';
import { PrismaService } from '../prisma/prisma.service.js';

const ACCESS_TTL = '30m';
const REFRESH_DAYS = 30;
const VERIFICATION_TTL = '10m';
/** 회전으로 쓴 토큰을 이 시간 안에 다시 쓰면 동시 갱신으로 보고 세션을 끊지 않는다 */
export const ROTATE_GRACE_MS = 30_000;

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

  /**
   * 마지막 접속 기록 (PO-01). 로그인은 매번, 토큰 갱신(30분마다)은 오늘(한국 날짜) 처음일 때만 쓴다.
   * 기록이 실패해도 로그인은 그대로.
   */
  async touchLogin(userId: string, always: boolean, now = new Date()): Promise<void> {
    const dayStart = new Date(`${kstDate(now)}T00:00:00+09:00`);
    await this.prisma.user
      .updateMany({
        where: always ? { id: userId } : { id: userId, OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: dayStart } }] },
        data: { lastLoginAt: now },
      })
      .catch(() => undefined);
  }

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

  /**
   * 리프레시 토큰은 한 번 쓰면 폐기하고 새로 발급 (탈취 시 재사용 감지).
   * - 로그아웃·비밀번호 재설정으로 폐기한 토큰을 다시 쓰면 그 요청만 401 (다른 세션은 그대로)
   * - 회전으로 이미 쓴 토큰을 30초 안에 다시 쓰면(탭 여러 개가 동시에 갱신) 401 만 — 새 토큰을 또 주지 않는다
   * - 30초가 지나 다시 쓰면 탈취로 보고 그 사용자의 모든 세션을 끊는다
   */
  async rotate(refreshToken: string, now = new Date()): Promise<TokenPair> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { user: true },
    });
    if (!row || row.expiresAt < now) throw Errors.tokenInvalid();
    if (row.revokedAt) {
      const reused = row.isRotated && now.getTime() - row.revokedAt.getTime() > ROTATE_GRACE_MS;
      if (reused) {
        await this.prisma.refreshToken.updateMany({
          where: { userId: row.userId, revokedAt: null },
          data: { revokedAt: now },
        });
      }
      throw Errors.tokenInvalid();
    }
    // 동시에 같은 토큰으로 두 번 갱신하면 한쪽만 통과 (아직 안 쓴 상태일 때만 폐기 성공)
    const claimed = await this.prisma.refreshToken.updateMany({
      where: { id: row.id, revokedAt: null },
      data: { revokedAt: now, isRotated: true },
    });
    if (claimed.count !== 1) throw Errors.tokenInvalid();
    await this.touchLogin(row.userId, false, now);
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
