import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser, PropertyRoles, type AuthUser } from '../common/decorators/auth.decorators.js';
import { Role } from '../generated/prisma/enums.js';
import { OpsNoteDto, PinDto, RoomDto, RoomStatusDto, RoomsDto } from './ops.dto.js';
import { OpsService } from './ops.service.js';
import { EventsService } from '../events/events.service.js';

const PID = 'propertyId';
const ALL = [Role.OWNER, Role.MANAGER, Role.STAFF];
const LEAD = [Role.OWNER, Role.MANAGER];
type RoleReq = Request & { role: Role };

@ApiTags('현장 업무 (F7-01 ~ F7-03)')
@ApiBearerAuth()
@Controller('properties/:propertyId')
export class OpsController {
  constructor(
    private readonly ops: OpsService,
    private readonly events: EventsService,
  ) {}

  @Get('ops')
  @PropertyRoles(ALL)
  @ApiOperation({ summary: '객실 상태판 · 공지 · 최근 7일 인수인계 (읽음 표시 포함)' })
  board(@Param(PID, ParseUUIDPipe) propertyId: string, @CurrentUser() user: AuthUser, @Req() req: RoleReq) {
    return this.ops.board(propertyId, user.id, req.role);
  }

  @Post('rooms')
  @PropertyRoles(LEAD)
  @ApiOperation({ summary: '객실 등록 (여러 개 한 번에)' })
  addRooms(@Param(PID, ParseUUIDPipe) propertyId: string, @Body() dto: RoomsDto) {
    return this.ops.addRooms(propertyId, dto.rooms);
  }

  @Put('rooms/:roomId')
  @PropertyRoles(LEAD)
  updateRoom(
    @Param(PID, ParseUUIDPipe) propertyId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() dto: RoomDto,
  ) {
    return this.ops.updateRoom(propertyId, roomId, dto);
  }

  @Delete('rooms/:roomId')
  @HttpCode(204)
  @PropertyRoles(LEAD)
  async removeRoom(@Param(PID, ParseUUIDPipe) propertyId: string, @Param('roomId', ParseUUIDPipe) roomId: string) {
    await this.ops.removeRoom(propertyId, roomId);
  }

  @Patch('rooms/:roomId/status')
  @PropertyRoles(ALL)
  @ApiOperation({ summary: '객실 상태 바꾸기 — 청소 시작·완료·점검 (판매 중지는 사장님·매니저만)' })
  async setStatus(
    @Param(PID, ParseUUIDPipe) propertyId: string,
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: RoleReq,
    @Body() dto: RoomStatusDto,
  ) {
    const r = await this.ops.setStatus(propertyId, roomId, { id: user.id, role: req.role }, dto);
    await this.events.record('ROOM_STATUS', { userId: user.id, propertyId, meta: { roomId, status: dto.status } });
    return r;
  }

  @Get('rooms/:roomId/logs')
  @PropertyRoles(ALL)
  @ApiOperation({ summary: '객실 상태 변경 이력 (최근 30건)' })
  logs(@Param(PID, ParseUUIDPipe) propertyId: string, @Param('roomId', ParseUUIDPipe) roomId: string) {
    return this.ops.roomLogs(propertyId, roomId);
  }

  @Post('ops-notes')
  @PropertyRoles(ALL)
  @ApiOperation({ summary: '인수인계 쓰기(누구나) · 공지 쓰기(사장님·매니저)' })
  createNote(
    @Param(PID, ParseUUIDPipe) propertyId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: RoleReq,
    @Body() dto: OpsNoteDto,
  ) {
    return this.ops.createNote(propertyId, { id: user.id, role: req.role }, dto);
  }

  @Post('ops-notes/:noteId/read')
  @HttpCode(204)
  @PropertyRoles(ALL)
  @ApiOperation({ summary: '확인했어요 표시' })
  async read(
    @Param(PID, ParseUUIDPipe) propertyId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.ops.markRead(propertyId, noteId, user.id);
  }

  @Patch('ops-notes/:noteId/pin')
  @HttpCode(204)
  @PropertyRoles(LEAD)
  async pin(
    @Param(PID, ParseUUIDPipe) propertyId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: PinDto,
  ) {
    await this.ops.pin(propertyId, noteId, dto.pinned);
  }

  @Delete('ops-notes/:noteId')
  @HttpCode(204)
  @PropertyRoles(ALL)
  async removeNote(
    @Param(PID, ParseUUIDPipe) propertyId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: RoleReq,
  ) {
    await this.ops.removeNote(propertyId, noteId, { id: user.id, role: req.role });
  }
}
