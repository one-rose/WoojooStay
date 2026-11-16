import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { PropertyRoles } from '../common/decorators/auth.decorators.js';
import { IsCalendarDate } from '../common/validation/date-fields.js';
import { Role } from '../generated/prisma/enums.js';
import { DashboardService } from './dashboard.service.js';

class DashboardQuery {
  @ApiPropertyOptional({ example: '2026-11-10', description: 'YYYY-MM-DD (기본: 오늘, 한국 시간)' })
  @IsOptional()
  @IsCalendarDate()
  date?: string;
}

@ApiTags('홈 대시보드 (F0-12)')
@ApiBearerAuth()
@Controller('properties/:propertyId/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  @ApiOperation({ summary: '오늘 예약매출 · 미답변 리뷰 · 7일 정산 예정 · 채널별 매출 · 연동 상태' })
  get(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Query() q: DashboardQuery) {
    return this.dashboard.get(propertyId, q.date);
  }
}
