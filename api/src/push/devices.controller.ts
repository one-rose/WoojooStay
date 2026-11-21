import { Body, Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { CurrentUser, type AuthUser } from '../common/decorators/auth.decorators.js';
import { DevicePlatform } from '../generated/prisma/enums.js';
import { DevicesService } from './devices.service.js';

export class DeviceDto {
  @ApiProperty({ enum: DevicePlatform })
  @IsEnum(DevicePlatform, { message: '기기 종류(ANDROID·IOS)가 올바르지 않아요.' })
  platform: DevicePlatform;

  @ApiProperty({ description: 'FCM 등록 토큰' })
  @IsString()
  @MinLength(20, { message: '푸시 토큰이 올바르지 않아요.' })
  @MaxLength(4096, { message: '푸시 토큰이 올바르지 않아요.' })
  @Matches(/^[\w:.-]+$/, { message: '푸시 토큰이 올바르지 않아요.' })
  token: string;

  @ApiPropertyOptional({ example: '1.0.0 (12)' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  appVersion?: string;
}

@ApiTags('앱 푸시 기기')
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: '푸시 기기 등록 (같은 토큰이면 갱신 · 다른 계정 토큰이면 지금 계정으로)' })
  upsert(@CurrentUser() user: AuthUser, @Body() dto: DeviceDto) {
    return this.devices.upsert(user.id, dto);
  }

  @Delete(':token')
  @HttpCode(204)
  @ApiOperation({ summary: '푸시 기기 해제 (로그아웃) — 내 토큰만, 없어도 204' })
  async remove(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    await this.devices.remove(user.id, token);
  }
}
