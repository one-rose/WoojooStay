import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AdminService } from './admin.service.js';

/** 매일 새벽 4시(KST) — 보관 기간이 지난 문의 삭제 */
@Injectable()
export class AdminScheduler {
  private readonly logger = new Logger('Admin');

  constructor(private readonly admin: AdminService) {}

  @Cron('0 4 * * *', { timeZone: 'Asia/Seoul' })
  async purge() {
    const n = await this.admin.purgeOldInquiries();
    if (n) this.logger.log(`보관 기간이 지난 문의 ${n}건 삭제`);
  }
}
