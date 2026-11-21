import { Injectable } from '@nestjs/common';
import type { DevicePlatform } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** 한 계정에 남겨 둘 기기 수 — 넘으면 오래 안 쓴 기기부터 지운다 */
export const MAX_DEVICES_PER_USER = 10;

/** 앱 푸시 기기 (FCM 등록 토큰) */
@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 등록 — 같은 토큰이 있으면 지금 로그인한 사람 것으로 바꾼다 (기기에서 다른 계정으로 로그인한 경우).
   * 앱은 켤 때마다 불러도 된다 (lastSeenAt 갱신).
   */
  async upsert(userId: string, input: { platform: DevicePlatform; token: string; appVersion?: string }) {
    const now = new Date();
    const d = await this.prisma.device.upsert({
      where: { token: input.token },
      create: { userId, platform: input.platform, token: input.token, appVersion: input.appVersion, lastSeenAt: now },
      update: { userId, platform: input.platform, appVersion: input.appVersion, lastSeenAt: now },
    });
    const old = await this.prisma.device.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      skip: MAX_DEVICES_PER_USER,
      select: { id: true },
    });
    if (old.length) await this.prisma.device.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    return { id: d.id, platform: d.platform, appVersion: d.appVersion, lastSeenAt: d.lastSeenAt };
  }

  /** 로그아웃 — 내 기기 토큰만 지운다 (남의 토큰이거나 없으면 아무 일도 안 함) */
  async remove(userId: string, token: string) {
    await this.prisma.device.deleteMany({ where: { userId, token } });
  }

  /** FCM 이 무효라고 한 토큰 */
  async dropInvalid(tokens: string[]) {
    if (tokens.length) await this.prisma.device.deleteMany({ where: { token: { in: tokens } } });
  }
}
