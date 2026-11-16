import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AdminAuthService } from './admin-auth.service.js';
import { AdminAuthController, AdminController, InquiriesController } from './admin.controller.js';
import { AdminScheduler } from './admin.scheduler.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [ChannelsModule, NotificationsModule],
  controllers: [AdminAuthController, AdminController, InquiriesController],
  providers: [AdminAuthService, AdminService, AdminScheduler],
})
export class AdminModule {}
