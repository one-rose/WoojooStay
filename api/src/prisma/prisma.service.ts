import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { Env } from '../config/env.js';
import { Errors } from '../common/errors/app-error.js';

/** 잠금을 기다리는 최대 시간 — 넘으면 409 (다시 시도) */
const LOCK_WAIT = '15s';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService<Env, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('DATABASE_URL', { infer: true }),
        // DB 서버 시간대와 상관없이 timestamptz 를 UTC 로 주고받는다 (서버가 Asia/Seoul 이면 9시간 어긋남)
        options: '-c TimeZone=UTC',
      }),
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * 같은 key 의 작업을 한 번에 하나씩 (PostgreSQL advisory lock — 서버가 여러 대여도 동작).
   * 잠금은 트랜잭션 하나가 들고 있고, fn 안의 쿼리는 평소처럼 this(자동 커밋)로 쓴다.
   * 그래서 fn 이 끝나기 전 다른 요청은 잠금 앞에서 기다리고, 들어오면 앞 요청이 저장한 값을 본다.
   * 상태는 반드시 fn 안에서(잠금을 잡은 뒤) 다시 읽어야 한다.
   * key 를 여러 개 주면 정렬한 순서로 모두 잡는다 (서로 다른 순서로 잡다 엇갈려 멈추지 않게).
   */
  async withLock<T>(key: string | string[], fn: () => Promise<T>, timeoutMs = 120_000): Promise<T> {
    const keys = [...new Set(Array.isArray(key) ? key : [key])].sort();
    try {
      return await this.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '${LOCK_WAIT}'`);
          for (const k of keys) await tx.$executeRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${k}))`;
          return fn();
        },
        { maxWait: 15_000, timeout: timeoutMs },
      );
    } catch (err) {
      if (/lock timeout|55P03/i.test(String((err as Error)?.message))) throw Errors.conflict();
      throw err;
    }
  }

  /** 잠금을 못 잡으면 기다리지 않고 null (이미 다른 곳에서 같은 작업 중) */
  async tryLock<T>(key: string, fn: () => Promise<T>, timeoutMs = 600_000): Promise<T | null> {
    return this.$transaction(
      async (tx) => {
        const [row] = await tx.$queryRaw<{ ok: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext(${key})) AS ok`;
        if (!row?.ok) return null;
        return fn();
      },
      { maxWait: 15_000, timeout: timeoutMs },
    );
  }
}
