import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminOnly, CurrentAdmin, Public, type AuthAdmin } from '../common/decorators/auth.decorators.js';
import { AdminRole } from '../generated/prisma/enums.js';
import { AdminAuthService } from './admin-auth.service.js';
import { AdminService } from './admin.service.js';
import {
  AdminLoginDto,
  AssignManagerDto,
  CreateAdminDto,
  CreateInquiryDto,
  ListInquiriesQuery,
  ListPropertiesQuery,
  UpdateInquiryDto,
} from './dto/admin.dto.js';

@ApiTags('운영자 인증')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: '운영자 이메일 + 비밀번호 로그인 (토큰 8시간)' })
  login(@Body() dto: AdminLoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @AdminOnly([])
  @ApiBearerAuth()
  @Get('me')
  me(@CurrentAdmin() admin: AuthAdmin) {
    return this.auth.me(admin.id);
  }
}

@ApiTags('운영자 (F0-14)')
@ApiBearerAuth()
@AdminOnly([])
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  @ApiOperation({ summary: '요약 — 업장 수, 체험·유료, 월 구독 매출, 수집 오류, 새 문의' })
  overview() {
    return this.admin.overview();
  }

  @Get('properties')
  @ApiOperation({ summary: '업장 목록 (검색, 오류·체험 필터)' })
  properties(@Query() query: ListPropertiesQuery) {
    return this.admin.listProperties(query);
  }

  @Get('properties/:id')
  property(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.propertyDetail(id);
  }

  @Patch('properties/:id/manager')
  @ApiOperation({ summary: '담당 운영자 지정' })
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignManagerDto) {
    return this.admin.assignManager(id, dto.managerId);
  }

  @Get('sync-issues')
  @ApiOperation({ summary: '수집 오류 채널 목록' })
  syncIssues() {
    return this.admin.syncIssues();
  }

  @Post('sync-issues/:id/retry')
  @HttpCode(200)
  @ApiOperation({ summary: '다시 수집' })
  retry(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.retrySync(id);
  }

  @Post('sync-issues/:id/notify')
  @HttpCode(200)
  @ApiOperation({ summary: '사장님께 계정 재확인 알림' })
  notify(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.notifySyncIssue(id);
  }

  @Get('inquiries')
  inquiries(@Query() query: ListInquiriesQuery) {
    return this.admin.listInquiries(query.status);
  }

  @Patch('inquiries/:id')
  @ApiOperation({ summary: '문의 상태·메모' })
  updateInquiry(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: AuthAdmin,
    @Body() dto: UpdateInquiryDto,
  ) {
    return this.admin.updateInquiry(id, admin.id, dto);
  }

  @Get('admins')
  admins() {
    return this.admin.listAdmins();
  }

  @Post('admins')
  @AdminOnly([AdminRole.SUPER])
  @ApiOperation({ summary: '운영자 추가 (최고 관리자만)' })
  createAdmin(@Body() dto: CreateAdminDto) {
    return this.admin.createAdmin(dto);
  }

  @Post('admins/:id/deactivate')
  @HttpCode(200)
  @AdminOnly([AdminRole.SUPER])
  deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentAdmin() admin: AuthAdmin) {
    return this.admin.setAdminActive(id, admin.id, false);
  }

  @Post('admins/:id/activate')
  @HttpCode(200)
  @AdminOnly([AdminRole.SUPER])
  activate(@Param('id', ParseUUIDPipe) id: string, @CurrentAdmin() admin: AuthAdmin) {
    return this.admin.setAdminActive(id, admin.id, true);
  }
}

@ApiTags('도입 문의 (랜딩)')
@Controller('inquiries')
export class InquiriesController {
  constructor(private readonly admin: AdminService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  @ApiOperation({ summary: '도입·파트너 문의 접수 (로그인 없음)' })
  create(@Body() dto: CreateInquiryDto) {
    return this.admin.createInquiry(dto);
  }
}
