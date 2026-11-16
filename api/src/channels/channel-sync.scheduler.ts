import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import type { Env } from '../config/env.js';
import { ChannelsService } from './channels.service.js';

/** 30분마다 연결된 채널 수집 (SYNC_ENABLED=true 일 때만) */
@Injectable()
export class ChannelSyncScheduler {
  private readonly logger = new Logger('ChannelSync');
  private running = false;

  constructor(
    private readonly channels: ChannelsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Interval(30 * 60 * 1000)
  async run() {
    if (this.config.get('SYNC_ENABLED', { infer: true }) !== 'true' || this.running) return;
    this.running = true;
    try {
      const n = await this.channels.syncAll();
      this.logger.log(`정기 수집 완료: 연결 ${n}개`);
    } finally {
      this.running = false;
    }
  }
}
