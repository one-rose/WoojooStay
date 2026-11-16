import { Module } from '@nestjs/common';
import { PortfolioController } from './portfolio.controller.js';
import { PortfolioReviewsService } from './portfolio-reviews.service.js';
import { PortfolioService } from './portfolio.service.js';

@Module({ controllers: [PortfolioController], providers: [PortfolioService, PortfolioReviewsService] })
export class PortfolioModule {}
