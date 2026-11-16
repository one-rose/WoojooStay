import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/auth.decorators.js';
import { PortfolioReviewsService } from './portfolio-reviews.service.js';
import { PortfolioService } from './portfolio.service.js';

@ApiTags('여러 업장 통합 현황 (F8)')
@ApiBearerAuth()
@Controller('portfolio')
export class PortfolioController {
  constructor(
    private readonly portfolio: PortfolioService,
    private readonly reviews: PortfolioReviewsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: '내가 사장님·매니저인 업장 전부의 오늘 매출 · 이번 달 · 미답변 · 정산 · 객실 · 근무 · 연동 + 확인할 일',
    description: '직원(STAFF)으로만 속한 업장은 빠진다. 결제 상태는 사장님(OWNER)인 업장만 (매니저면 null).',
  })
  get(@CurrentUser() user: AuthUser) {
    return this.portfolio.get(user.id);
  }

  @Get('reviews')
  @ApiOperation({
    summary: '통합 리뷰함 — 내 업장 전부의 미답변 리뷰(전부)와 최근 7일 답글 단 리뷰',
    description: '답글 게시·다시 쓰기는 /properties/:propertyId/reviews/... 를 그대로 쓴다.',
  })
  inbox(@CurrentUser() user: AuthUser) {
    return this.reviews.list(user.id);
  }
}
