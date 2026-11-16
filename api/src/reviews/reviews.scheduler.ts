import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReviewsService } from './reviews.service.js';

/** 5분마다 '게시 중' 에 오래 남은 리뷰를 되돌린다 (서버 재시작·장애 대비) */
@Injectable()
export class ReviewsScheduler {
  private readonly logger = new Logger('ReviewsScheduler');

  constructor(private readonly reviews: ReviewsService) {}

  @Cron('*/5 * * * *')
  async releaseStale() {
    const n = await this.reviews.releaseStalePosting();
    if (n) this.logger.warn(`게시 중에 멈춘 리뷰 ${n}건을 미답변으로 되돌렸어요.`);
  }
}
