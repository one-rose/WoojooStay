import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Errors } from '../common/errors/app-error.js';
import { kstDate } from '../common/utils/dates.js';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type SmsKind = 'INVITE' | 'INVITE_RESEND' | 'CONTRACT';

/** 문자에 넣는 업장 이름 최대 글자 수 */
const NAME_MAX = 20;
const URL_LIKE =
  /(https?:\/\/|www\.)\S*|\b[\w-]+(\.[\w-]+)*\.(com|net|org|kr|co|io|me|ly|gl|xyz|site|link|app|info|biz|shop|top|click)\b\S*/gi;
const PHONE_LIKE = /(\+?\d[\d\s.-]{6,}\d)/g;

/**
 * 문자에 넣을 업장 이름 — 링크·전화번호 모양은 지우고 20자 이내로.
 * 업장 이름을 마음대로 지어 남의 번호로 피싱 문자를 보내지 못하게 (초대·계약서 문자).
 */
export function smsSafeName(name: string): string {
  const cleaned = name.replace(URL_LIKE, '').replace(PHONE_LIKE, '').replace(/\s+/g, ' ').trim();
  const safe = cleaned || '우주스테이 업장';
  return safe.length > NAME_MAX ? `${safe.slice(0, NAME_MAX).trim()}…` : safe;
}

/** 사장님이 보내는 문자(초대·다시 보내기·근로계약서) 계정별 하루 한도 (INVITE_SMS_DAILY_LIMIT, 기본 30) */
@Injectable()
export class SmsQuota {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** 한도 안이면 한 건 기록하고 fn 실행 — 넘으면 429. 동시에 눌러도 한도를 넘지 않게 계정별로 잠근다 */
  async use<T>(userId: string, kind: SmsKind, fn: () => Promise<T>, count = 1): Promise<T> {
    return this.prisma.withLock(`sms-quota:${userId}`, async () => {
      const limit = this.config.get('INVITE_SMS_DAILY_LIMIT', { infer: true }) ?? 30;
      const dayStart = new Date(`${kstDate()}T00:00:00+09:00`);
      const used = await this.prisma.smsSendLog.count({ where: { userId, createdAt: { gte: dayStart } } });
      if (used + count > limit) throw Errors.inviteSmsDailyLimit();
      const result = await fn();
      await this.prisma.smsSendLog.createMany({ data: Array.from({ length: count }, () => ({ userId, kind })) });
      return result;
    });
  }
}
