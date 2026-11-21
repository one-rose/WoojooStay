import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ClockRequestsService } from './clock-requests.service.js';
import { ClockService } from './clock.service.js';
import { ClockQrController, ContractsController, StaffController } from './staff.controller.js';
import { StaffService } from './staff.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [StaffController, ClockQrController, ContractsController],
  providers: [StaffService, ClockService, ClockRequestsService],
  exports: [ClockService],
})
export class StaffModule {}
