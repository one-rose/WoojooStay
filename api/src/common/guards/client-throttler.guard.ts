import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import { safeEqual } from '../utils/crypto.js';
import type { Env } from '../../config/env.js';

/** 헤더 값 하나만 (여러 개면 첫 번째) */
function header(req: { headers?: Record<string, unknown> }, name: string): string | undefined {
  const v = req.headers?.[name];
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === 'string' && s.trim() ? s.trim() : undefined;
}

/**
 * 요청 제한을 셀 기준(사용자 IP).
 * 운영에서는 화면 서버(Next.js)만 API 를 부르므로 req.ip 는 늘 같은 값이다.
 * 화면 서버가 내부 키(x-internal-key)와 함께 보낸 x-client-ip 만 믿고, 나머지는 req.ip.
 */
export function clientTracker(
  req: { ip?: string; headers?: Record<string, unknown> },
  internalKey: string | undefined,
): string {
  const key = header(req, 'x-internal-key');
  const clientIp = header(req, 'x-client-ip');
  if (internalKey && key && clientIp && safeEqual(key, internalKey)) return clientIp.slice(0, 64);
  return req.ip ?? 'unknown';
}

@Injectable()
export class ClientThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
    private readonly config: ConfigService<Env, true>,
  ) {
    super(options, storage, reflector);
  }

  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    return clientTracker(
      req as { ip?: string; headers?: Record<string, unknown> },
      this.config.get('INTERNAL_API_KEY', { infer: true }),
    );
  }
}
