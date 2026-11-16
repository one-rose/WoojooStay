import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { CurrentUser, type AuthUser } from '../common/decorators/auth.decorators.js';
import { NotificationsService } from './notifications.service.js';

class NotificationQuery {
  @ApiPropertyOptional({ description: '이 업장 알림만' })
  @IsOptional()
  @IsUUID('all', { message: '업장 id 형식이 아니에요.' })
  propertyId?: string;
}

@ApiTags('알림 (F0-13)')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() q: NotificationQuery) {
    return this.notifications.list(user.id, q.propertyId);
  }

  @Post('read-all')
  @HttpCode(204)
  async readAll(@CurrentUser() user: AuthUser, @Query() q: NotificationQuery) {
    await this.notifications.readAll(user.id, q.propertyId);
  }

  @Post(':id/read')
  @HttpCode(204)
  async read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.notifications.read(user.id, id);
  }
}
