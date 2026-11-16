import { Body, Controller, Get, HttpCode, Param, ParseEnumPipe, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsBoolean, IsEnum, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { CurrentUser, PropertyRoles, type AuthUser } from '../common/decorators/auth.decorators.js';
import { NotificationKind, PlanCode, Role } from '../generated/prisma/enums.js';
import { BillingService } from './billing.service.js';

class TogglePlanDto {
  @ApiProperty()
  @IsBoolean()
  enabled: boolean;
}

class CardDto {
  @ApiProperty({ description: 'PG 결제창이 돌려준 authKey (카드 번호는 받지 않음)' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  authKey: string;
}

class NoticeItemDto {
  @ApiProperty({ enum: NotificationKind }) @IsEnum(NotificationKind) kind: NotificationKind;
  @ApiProperty() @IsBoolean() alimtalk: boolean;
  @ApiProperty() @IsBoolean() push: boolean;
  @ApiProperty() @IsBoolean() email: boolean;
}

class NoticeSettingsDto {
  @ApiProperty({ type: [NoticeItemDto] })
  @ValidateNested({ each: true })
  @ArrayMaxSize(10)
  @Type(() => NoticeItemDto)
  items: NoticeItemDto[];
}

@ApiTags('구독 · 결제 · 알림 설정 (F0-08, F0-09, F0-13)')
@ApiBearerAuth()
@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('plans')
  @ApiOperation({ summary: '구독 상품' })
  plans() {
    return this.billing.plans();
  }

  @Get('properties/:propertyId/billing')
  @PropertyRoles([Role.OWNER])
  @ApiOperation({ summary: '구독 · 다음 결제일 · 카드 · 결제 내역' })
  get(@Param('propertyId', ParseUUIDPipe) propertyId: string) {
    return this.billing.billing(propertyId);
  }

  @Put('properties/:propertyId/subscriptions/:plan')
  @PropertyRoles([Role.OWNER])
  @ApiOperation({ summary: '서비스 켜기·끄기 (체험 중이면 체험, 끝났으면 바로 결제)' })
  toggle(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('plan', new ParseEnumPipe(PlanCode)) plan: PlanCode,
    @Body() dto: TogglePlanDto,
  ) {
    return this.billing.setPlan(propertyId, plan, dto.enabled);
  }

  @Post('properties/:propertyId/payment-method')
  @HttpCode(200)
  @PropertyRoles([Role.OWNER])
  @ApiOperation({ summary: '결제 카드 등록·변경 (PG authKey → 빌링키)' })
  card(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Body() dto: CardDto) {
    return this.billing.setCard(propertyId, dto.authKey);
  }

  @Get('properties/:propertyId/notification-settings')
  @ApiOperation({ summary: '내 알림 받기 설정' })
  notices(@Param('propertyId', ParseUUIDPipe) propertyId: string, @CurrentUser() user: AuthUser) {
    return this.billing.noticeSettings(user.id, propertyId);
  }

  @Put('properties/:propertyId/notification-settings')
  setNotices(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: NoticeSettingsDto,
  ) {
    return this.billing.setNoticeSettings(user.id, propertyId, dto.items);
  }
}
