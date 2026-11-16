import { Module } from '@nestjs/common';
import { ReviewsModule } from '../reviews/reviews.module.js';
import { ChannelSyncScheduler } from './channel-sync.scheduler.js';
import { ChannelsController } from './channels.controller.js';
import { ChannelsService } from './channels.service.js';

@Module({
  imports: [ReviewsModule],
  controllers: [ChannelsController],
  providers: [ChannelsService, ChannelSyncScheduler],
  exports: [ChannelsService],
})
export class ChannelsModule {}
