import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { IsCalendarDate, IsMonth } from '../common/validation/date-fields.js';
import { CurrentUser, PropertyRoles, type AuthUser } from '../common/decorators/auth.decorators.js';
import { Channel, Role } from '../generated/prisma/enums.js';
import { LedgerService } from './ledger.service.js';
import { EventsService } from '../events/events.service.js';

class LedgerQuery {
  @ApiPropertyOptional({ example: '2026-11' })
  @IsOptional()
  @IsMonth()
  month?: string;

  @ApiPropertyOptional({ example: '2026-11-10', description: '가격 비교·대실 기준일 (기본 오늘)' })
  @IsOptional()
  @IsCalendarDate()
  date?: string;
}

class AdSpendDto {
  @ApiProperty({ enum: Channel })
  @IsEnum(Channel)
  channel: Channel;

  @ApiProperty({ example: '2026-11' })
  @IsMonth()
  month: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  amount: number;
}

@ApiTags('매출장부 (F2-01 ~ F2-06)')
@ApiBearerAuth()
@Controller('properties/:propertyId/ledger')
export class LedgerController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly events: EventsService,
  ) {}

  @Get()
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  @ApiOperation({ summary: '월 매출·채널별 표·10개월 추이·정산 달력·가격 비교·대실/숙박' })
  async get(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Query() q: LedgerQuery,
    @CurrentUser() user: AuthUser,
  ) {
    const r = await this.ledger.ledger(propertyId, q.month, q.date);
    await this.events.recordDaily('LEDGER_VIEW', { userId: user.id, propertyId });
    return r;
  }

  @Put('ad-spend')
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  @ApiOperation({ summary: '광고비 직접 입력 (F2-04)' })
  adSpend(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Body() dto: AdSpendDto) {
    return this.ledger.setAdSpend(propertyId, dto.channel, dto.month, dto.amount);
  }
}
