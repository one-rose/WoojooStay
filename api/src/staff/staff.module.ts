import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ContractsController, StaffController } from './staff.controller.js';
import { StaffService } from './staff.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [StaffController, ContractsController],
  providers: [StaffService],
})
export class StaffModule {}
