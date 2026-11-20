import { Module } from '@nestjs/common';
import { DailySummaryService } from './daily-summary.service.js';
import { PortfolioController } from './portfolio.controller.js';
import { PortfolioReportService } from './portfolio-report.service.js';
import { PortfolioReviewsService } from './portfolio-reviews.service.js';
import { PortfolioService } from './portfolio.service.js';

@Module({
  controllers: [PortfolioController],
  providers: [PortfolioService, PortfolioReviewsService, PortfolioReportService, DailySummaryService],
})
export class PortfolioModule {}
