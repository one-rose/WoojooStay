import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser, PropertyRoles, Public, type AuthUser } from '../common/decorators/auth.decorators.js';
import { Role } from '../generated/prisma/enums.js';
import {
  AcceptInvitationDto,
  ChangeRoleDto,
  CreatePropertyDto,
  InviteDto,
  UpdatePropertyDto,
} from './dto/property.dto.js';
import { MembersService } from './members.service.js';
import { PropertiesService } from './properties.service.js';

@ApiTags('업장 · 직원 권한 (F0-02, F0-03)')
@ApiBearerAuth()
@Controller()
export class PropertiesController {
  constructor(
    private readonly properties: PropertiesService,
    private readonly members: MembersService,
  ) {}

  @Get('biz-no/check')
  @ApiOperation({ summary: '사업자등록번호 확인' })
  checkBizNo(@Query('bizNo') bizNo: string) {
    return this.properties.checkBizNo(String(bizNo ?? '').replace(/\D/g, ''));
  }

  @Post('properties')
  @ApiOperation({ summary: '업장 등록 (등록한 사람이 사장님)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePropertyDto) {
    return this.properties.create(user.id, dto);
  }

  @Get('properties')
  @ApiOperation({ summary: '내가 속한 업장 목록' })
  list(@CurrentUser() user: AuthUser) {
    return this.properties.listMine(user.id);
  }

  @Get('properties/:propertyId')
  @ApiOperation({ summary: '업장 정보 (직원에게는 사업자번호·대표자·담당 운영자를 빼고)' })
  get(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Req() req: Request & { role: Role }) {
    return this.properties.get(propertyId, req.role);
  }

  @Patch('properties/:propertyId')
  @PropertyRoles([Role.OWNER])
  update(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Body() dto: UpdatePropertyDto) {
    return this.properties.update(propertyId, dto);
  }

  @Get('properties/:propertyId/members')
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  @ApiOperation({ summary: '구성원 · 대기 중 초대 (사장님에게는 번호 전체, 매니저에게는 가린 번호)' })
  listMembers(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Req() req: Request & { role: Role }) {
    return this.members.list(propertyId, req.role);
  }

  @Post('properties/:propertyId/invitations')
  @PropertyRoles([Role.OWNER])
  @ApiOperation({ summary: '직원 초대 문자 보내기 (7일 유효)' })
  invite(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: InviteDto,
  ) {
    return this.members.invite(propertyId, user.id, dto.phone, dto.role);
  }

  @Delete('properties/:propertyId/invitations/:invitationId')
  @PropertyRoles([Role.OWNER])
  @HttpCode(204)
  @ApiOperation({ summary: '대기 중 초대 취소' })
  async cancelInvitation(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    await this.members.cancelInvitation(propertyId, invitationId);
  }

  @Post('properties/:propertyId/invitations/:invitationId/resend')
  @PropertyRoles([Role.OWNER])
  @HttpCode(200)
  @ApiOperation({ summary: '초대 문자 다시 보내기 (새 링크 · 7일 다시, 예전 링크는 무효)' })
  resendInvitation(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.members.resendInvitation(propertyId, user.id, invitationId);
  }

  @Get('invitations/:token')
  @Public()
  @ApiOperation({ summary: '초대 링크 미리보기 — 업장 이름 · 권한 · 상태 (로그인 없이)' })
  previewInvitation(@Param('token') token: string) {
    return this.members.preview(token);
  }

  @Post('invitations/accept')
  @HttpCode(200)
  @ApiOperation({ summary: '초대 수락 (초대받은 번호로 로그인한 상태)' })
  accept(@CurrentUser() user: AuthUser, @Body() dto: AcceptInvitationDto) {
    return this.members.accept(user.id, user.phone, dto.token);
  }

  @Patch('properties/:propertyId/members/:memberId')
  @PropertyRoles([Role.OWNER])
  changeRole(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: ChangeRoleDto,
  ) {
    return this.members.changeRole(propertyId, memberId, dto.role);
  }

  @Delete('properties/:propertyId/members/:memberId')
  @PropertyRoles([Role.OWNER])
  @HttpCode(204)
  async remove(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    await this.members.remove(propertyId, memberId);
  }
}
