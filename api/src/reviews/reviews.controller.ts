import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, PropertyRoles, type AuthUser } from '../common/decorators/auth.decorators.js';
import { Role } from '../generated/prisma/enums.js';
import { ListReviewsQuery, PostReplyDto, ReplySettingsDto } from './dto/review.dto.js';
import { ReviewsService } from './reviews.service.js';

@ApiTags('AI 리뷰 (F1-01 ~ F1-08)')
@ApiBearerAuth()
@PropertyRoles([Role.OWNER, Role.MANAGER])
@Controller('properties/:propertyId')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('reviews')
  @ApiOperation({ summary: '리뷰 통합 목록 + 탭별 건수' })
  list(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Query() q: ListReviewsQuery) {
    return this.reviews.list(propertyId, q);
  }

  @Get('reviews/:reviewId')
  get(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Param('reviewId', ParseUUIDPipe) reviewId: string) {
    return this.reviews.get(propertyId, reviewId);
  }

  @Post('reviews/:reviewId/draft')
  @HttpCode(200)
  @ApiOperation({ summary: 'AI 답글 초안 다시 만들기' })
  draft(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Param('reviewId', ParseUUIDPipe) reviewId: string) {
    return this.reviews.generateDraft(propertyId, reviewId);
  }

  @Post('reviews/:reviewId/reply')
  @ApiOperation({
    summary: '답글 게시 — 자동 게시 채널은 채널로 전송, 아니면 복사 게시로 기록 (copyTo: 파트너센터 주소)',
  })
  reply(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: PostReplyDto,
  ) {
    return this.reviews.post(propertyId, reviewId, user.id, dto.text);
  }

  @Get('reply-settings')
  @ApiOperation({ summary: '답글 말투 · 자동 응대 설정' })
  getSettings(@Param('propertyId', ParseUUIDPipe) propertyId: string) {
    return this.reviews.settings(propertyId);
  }

  @Put('reply-settings')
  updateSettings(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Body() dto: ReplySettingsDto) {
    return this.reviews.updateSettings(propertyId, dto);
  }
}
