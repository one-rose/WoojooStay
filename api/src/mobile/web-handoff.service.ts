import { Injectable, Logger } from '@nestjs/common';
import { TokensService, type TokenPair } from '../auth/tokens.service.js';
import { Errors } from '../common/errors/app-error.js';
import { randomToken, sha256 } from '../common/utils/crypto.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** 코드가 살아 있는 시간 */
export const HANDOFF_TTL_SEC = 60;

/**
 * 웹 화면 경로 — 화면 쪽 safeAppPath 와 같은 규칙 (/app… 만, 로그인·세션 경로·다른 사이트 금지).
 * 맞지 않으면 fallback.
 */
export function safeAppPath(next: string | null | undefined, fallback = '/app'): string {
  if (!next || !next.startsWith('/app') || next.startsWith('//') || next.includes('\\')) return fallback;
  if (next.startsWith('/app/session') || next.startsWith('/app/login') || next.startsWith('/app/handoff'))
    return fallback;
  // 공백·제어 문자 (헤더 끼워 넣기 방지)
  if (next.length > 500) return fallback;
  for (let i = 0; i < next.length; i++) if (next.charCodeAt(i) <= 0x20 || next.charCodeAt(i) === 0x7f) return fallback;
  return next;
}

/**
 * 앱 → 웹 화면 넘기기. 앱이 로그인한 채로 무거운 화면(매출장부·지출·설정…)을 웹뷰로 열 때
 * 1) 앱이 POST /auth/web-handoff 로 1회용 코드(60초)를 받고
 * 2) 웹뷰가 {웹}/app/handoff?code=… 를 열면 화면 서버가 POST /auth/web-handoff/exchange 로 바꿔
 *    평소 로그인 쿠키를 굽고 path 로 보낸다.
 * 웹 쪽은 새 세션(새 리프레시 토큰)을 받는다 — 앱의 리프레시 토큰과 따로 돌아 서로 회전을 깨지 않는다.
 */
@Injectable()
export class WebHandoffService {
  private readonly logger = new Logger('WebHandoff');

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
  ) {}

  async create(userId: string, input: { path?: string; propertyId?: string }, ip?: string, now = new Date()) {
    const path = safeAppPath(input.path);
    let propertyId: string | null = null;
    if (input.propertyId) {
      const m = await this.prisma.membership.findUnique({
        where: { userId_propertyId: { userId, propertyId: input.propertyId } },
        select: { id: true },
      });
      if (!m) throw Errors.notFound('업장');
      propertyId = input.propertyId;
    }
    const code = randomToken(32);
    const expiresAt = new Date(now.getTime() + HANDOFF_TTL_SEC * 1000);
    await this.prisma.webHandoff.create({
      data: { userId, codeHash: sha256(code), path, propertyId, expiresAt, createdIp: ip?.slice(0, 64) ?? null },
    });
    return { code, path, propertyId, expiresIn: HANDOFF_TTL_SEC, expiresAt: expiresAt.toISOString() };
  }

  /** 화면 서버가 부른다 — 한 번만, 60초 안에. 맞으면 새 토큰 + 열 화면 */
  async exchange(
    code: string,
    ip?: string,
    now = new Date(),
  ): Promise<TokenPair & { path: string; propertyId: string | null; user: { id: string; name: string } }> {
    const row = await this.prisma.webHandoff.findUnique({
      where: { codeHash: sha256(code) },
      include: { user: true },
    });
    if (!row || row.usedAt || row.expiresAt <= now) {
      if (row) this.logger.warn(`화면 넘기기 거절 ${row.id} (${row.usedAt ? '이미 씀' : '시간 지남'})`);
      throw Errors.handoffInvalid();
    }
    // 동시에 두 번 바꾸면 한쪽만
    const claimed = await this.prisma.webHandoff.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: now, usedIp: ip?.slice(0, 64) ?? null },
    });
    if (claimed.count !== 1) throw Errors.handoffInvalid();
    // 그새 업장에서 빠졌으면 업장은 고르지 않는다 (화면 서버가 다시 고른다)
    const stillMember = row.propertyId
      ? await this.prisma.membership.findUnique({
          where: { userId_propertyId: { userId: row.userId, propertyId: row.propertyId } },
          select: { id: true },
        })
      : null;
    this.logger.log(`화면 넘기기 ${row.id} 사용자 ${row.userId} → ${row.path}`);
    await this.tokens.touchLogin(row.userId, false, now);
    return {
      ...(await this.tokens.issue(row.user)),
      path: row.path,
      propertyId: stillMember ? row.propertyId : null,
      user: { id: row.user.id, name: row.user.name },
    };
  }
}
