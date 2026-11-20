import { Injectable, Logger } from '@nestjs/common';
import { kstDate } from '../common/utils/dates.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** 실증 KPI 용 사용 기록 종류 */
export const EVENT_KINDS = [
  'APP_OPEN',
  'OVERVIEW_VIEW',
  'LEDGER_VIEW',
  'REPORT_VIEW',
  'DRAFT_CREATE',
  'DRAFT_REGENERATE',
  'REPLY_POST',
  'CHANNEL_CONNECT',
  'RECEIPT_REGISTER',
  'PAYROLL_CONFIRM',
  'CLOCK_IN',
  'ROOM_STATUS',
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

/** 사용자 단위 기록 (업장 없음) — 그 사용자가 사장님·매니저인 업장 전부의 사용으로 센다 */
export const USER_SCOPED_EVENTS: readonly EventKind[] = ['APP_OPEN', 'OVERVIEW_VIEW', 'REPORT_VIEW'];

export interface EventInput {
  userId?: string | null;
  propertyId?: string | null;
  meta?: Prisma.InputJsonValue;
}

/**
 * 사용 기록 (PO-04). 서버 쪽 서비스에서 남긴다.
 * 기록이 실패해도 본 요청은 그대로 — 절대 예외를 던지지 않는다.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger('Events');

  constructor(private readonly prisma: PrismaService) {}

  async record(kind: EventKind, input: EventInput = {}): Promise<void> {
    try {
      await this.prisma.usageEvent.create({
        data: { kind, userId: input.userId ?? null, propertyId: input.propertyId ?? null, meta: input.meta },
      });
    } catch (err) {
      this.logger.warn(`사용 기록 실패 ${kind}: ${(err as Error).message}`);
    }
  }

  /** 하루(한국 날짜) 한 번만 — 앱 열기·화면 조회처럼 자주 부르는 곳 */
  async recordDaily(kind: EventKind, input: EventInput & { userId: string }, now = new Date()): Promise<void> {
    try {
      const dayStart = new Date(`${kstDate(now)}T00:00:00+09:00`);
      const seen = await this.prisma.usageEvent.findFirst({
        where: {
          kind,
          userId: input.userId,
          propertyId: input.propertyId ?? null,
          createdAt: { gte: dayStart },
        },
        select: { id: true },
      });
      if (!seen) await this.record(kind, input);
    } catch (err) {
      this.logger.warn(`사용 기록 실패 ${kind}: ${(err as Error).message}`);
    }
  }
}
