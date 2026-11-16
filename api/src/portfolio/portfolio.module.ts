import { Module } from '@nestjs/common';
import { PortfolioController } from './portfolio.controller.js';
import { PortfolioReportService } from './portfolio-report.service.js';
import { PortfolioReviewsService } from './portfolio-reviews.service.js';
import { PortfolioService } from './portfolio.service.js';

@Module({
  controllers: [PortfolioController],
  providers: [PortfolioService, PortfolioReviewsService, PortfolioReportService],
})
export class PortfolioModule {}
