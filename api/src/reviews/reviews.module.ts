import { Module } from '@nestjs/common';
import { ReviewIngestService } from './review-ingest.service.js';
import { ReviewsController } from './reviews.controller.js';
import { ReviewsScheduler } from './reviews.scheduler.js';
import { ReviewsService } from './reviews.service.js';

@Module({
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewIngestService, ReviewsScheduler],
  exports: [ReviewIngestService],
})
export class ReviewsModule {}
