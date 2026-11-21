import { Body, Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { CurrentUser, Public, type AuthUser } from '../common/decorators/auth.decorators.js';
import { clientTracker } from '../common/guards/client-throttler.guard.js';
import { webOrigin, type Env } from '../config/env.js';
import { WebHandoffService } from './web-handoff.service.js';

export class WebHandoffDto {
  @ApiPropertyOptional({ example: '/app/ledger?month=2026-11', description: '열 웹 화면 (/app… 만, 아니면 /app)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  path?: string;

  @ApiPropertyOptional({ description: '웹에서 고를 업장 (내 업장만)' })
  @IsOptional()
  @IsUUID('all', { message: '업장 id 가 올바르지 않아요.' })
  propertyId?: string;
}

export class WebHandoffExchangeDto {
  @ApiProperty()
  @IsString()
  @Matches(/^[\w-]{20,100}$/, { message: '화면을 여는 시간이 지났거나 이미 쓴 링크예요. 앱에서 다시 눌러 주세요.' })
  code: string;
}

export class AppConfigQuery {
  @ApiPropertyOptional({ enum: ['ANDROID', 'IOS'] })
  @IsOptional()
  @IsIn(['ANDROID', 'IOS', 'android', 'ios'])
  platform?: string;

  @ApiPropertyOptional({ example: '1.0.0', description: '지금 앱 버전 — 주면 updateRequired 를 계산해 준다' })
  @IsOptional()
  @Matches(/^\d+\.\d+\.\d+/, { message: '앱 버전 형식이 올바르지 않아요.' })
  version?: string;
}

/** "1.2.3 (45)" → [1,2,3] 으로 비교. a < b 면 음수 */
export function compareVersion(a: string, b: string): number {
  const pa = a
    .split(/[^\d]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(Number);
  const pb = b
    .split(/[^\d]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

@ApiTags('모바일 앱')
@Controller()
export class MobileController {
  constructor(
    private readonly handoff: WebHandoffService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private webBase(): string {
    return (
      this.config.get('APP_WEB_BASE_URL', { infer: true }) ?? webOrigin(this.config.get('WEB_ORIGIN', { infer: true }))
    ).replace(/\/+$/, '');
  }

  private ip(req: Request) {
    return clientTracker(req as never, this.config.get('INTERNAL_API_KEY', { infer: true }));
  }

  @Public()
  @Get('app/config')
  @ApiOperation({ summary: '앱 설정 (로그인 없음) — 최소 지원 버전(강제 업데이트) · 웹 주소 · 고객센터' })
  appConfig(@Query() q: AppConfigQuery) {
    const min = {
      ANDROID: this.config.get('APP_MIN_VERSION_ANDROID', { infer: true }) ?? '1.0.0',
      IOS: this.config.get('APP_MIN_VERSION_IOS', { infer: true }) ?? '1.0.0',
    };
    const latest = {
      ANDROID: this.config.get('APP_LATEST_VERSION_ANDROID', { infer: true }) ?? min.ANDROID,
      IOS: this.config.get('APP_LATEST_VERSION_IOS', { infer: true }) ?? min.IOS,
    };
    const platform = q.platform?.toUpperCase() as 'ANDROID' | 'IOS' | undefined;
    return {
      platforms: {
        ANDROID: {
          minVersion: min.ANDROID,
          latestVersion: latest.ANDROID,
          storeUrl: this.config.get('APP_STORE_URL_ANDROID', { infer: true }) ?? null,
        },
        IOS: {
          minVersion: min.IOS,
          latestVersion: latest.IOS,
          storeUrl: this.config.get('APP_STORE_URL_IOS', { infer: true }) ?? null,
        },
      },
      /** platform·version 을 같이 보냈을 때만 — true 면 업데이트 전에는 앱을 못 쓴다 */
      updateRequired: platform && q.version ? compareVersion(q.version, min[platform]) < 0 : null,
      updateAvailable: platform && q.version ? compareVersion(q.version, latest[platform]) < 0 : null,
      webBaseUrl: this.webBase(),
      supportPhone: this.config.get('SUPPORT_PHONE', { infer: true }) ?? null,
      /** 서버 시각 — 휴대폰 시계가 크게 틀렸는지 확인용 */
      serverTime: new Date().toISOString(),
    };
  }

  @ApiBearerAuth()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('auth/web-handoff')
  @ApiOperation({ summary: '앱 → 웹 화면 넘기기 코드 (1회용, 60초) — 웹뷰로 url 을 연다' })
  async createHandoff(@CurrentUser() user: AuthUser, @Body() dto: WebHandoffDto, @Req() req: Request) {
    const h = await this.handoff.create(user.id, dto, this.ip(req));
    return { ...h, url: `${this.webBase()}/app/handoff?code=${encodeURIComponent(h.code)}` };
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('auth/web-handoff/exchange')
  @HttpCode(200)
  @ApiOperation({ summary: '화면 넘기기 코드 → 토큰 (화면 서버가 부른다, 한 번만)' })
  exchange(@Body() dto: WebHandoffExchangeDto, @Req() req: Request) {
    return this.handoff.exchange(dto.code, this.ip(req));
  }
}
