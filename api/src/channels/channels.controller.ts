import { Body, Controller, Delete, Get, HttpCode, Param, ParseEnumPipe, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, PropertyRoles, type AuthUser } from '../common/decorators/auth.decorators.js';
import { Channel, Role } from '../generated/prisma/enums.js';
import { ChannelsService } from './channels.service.js';
import { ConnectChannelDto } from './dto/connect.dto.js';

@ApiTags('채널 연동 (F0-04 ~ F0-07)')
@ApiBearerAuth()
@Controller('properties/:propertyId/channels')
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @Get()
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  @ApiOperation({ summary: '9개 채널과 연결 상태' })
  list(@Param('propertyId', ParseUUIDPipe) propertyId: string) {
    return this.channels.list(propertyId);
  }

  @Post(':channel/connect')
  @HttpCode(200)
  @PropertyRoles([Role.OWNER])
  @ApiOperation({ summary: '채널 연결 (위탁 동의 필수) → 최근 90일 첫 수집' })
  connect(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('channel', new ParseEnumPipe(Channel)) channel: Channel,
    @Body() dto: ConnectChannelDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.channels.connect(propertyId, channel, dto, user.id);
  }

  @Post(':channel/sync')
  @HttpCode(200)
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  @ApiOperation({ summary: '지금 바로 수집' })
  sync(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('channel', new ParseEnumPipe(Channel)) channel: Channel,
  ) {
    return this.channels.sync(propertyId, channel);
  }

  @Delete(':channel')
  @HttpCode(204)
  @PropertyRoles([Role.OWNER])
  @ApiOperation({ summary: '연결 끊기 (저장된 계정 정보 삭제)' })
  async disconnect(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('channel', new ParseEnumPipe(Channel)) channel: Channel,
  ) {
    await this.channels.disconnect(propertyId, channel);
  }
}
