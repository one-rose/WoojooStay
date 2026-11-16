import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import type { Env } from '../config/env.js';
import { BillingService } from './billing.service.js';

/** 매일 오전 9시(KST) 정기결제 — SYNC_ENABLED=true 일 때만 (개발 중에는 꺼 둔다) */
@Injectable()
export class BillingScheduler {
  private readonly logger = new Logger('Billing');

  constructor(
    private readonly billing: BillingService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Cron('0 9 * * *', { timeZone: 'Asia/Seoul' })
  async daily() {
    if (this.config.get('SYNC_ENABLED', { infer: true }) !== 'true') return;
    const r = await this.billing.runDaily();
    this.logger.log(`정기결제: 대상 ${r.properties}곳, 결제 ${r.charged}곳`);
  }
}
