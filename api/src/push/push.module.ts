import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { DevicesController } from './devices.controller.js';
import { DevicesService } from './devices.service.js';
import { FcmPushSender, LogPushSender, loadServiceAccount, PushSender } from './push-sender.js';

/** FCM 서비스 계정이 있으면 실제 푸시, 없으면 로그만 (테스트는 LogPushSender 의 outbox 를 읽거나 PushSender 를 바꿔 끼운다) */
@Global()
@Module({
  controllers: [DevicesController],
  providers: [
    LogPushSender,
    DevicesService,
    {
      provide: PushSender,
      inject: [ConfigService, LogPushSender],
      useFactory: (config: ConfigService<Env, true>, log: LogPushSender) => {
        const sa = config.get('FCM_SERVICE_ACCOUNT_JSON', { infer: true });
        return sa ? new FcmPushSender(loadServiceAccount(sa)) : log;
      },
    },
  ],
  exports: [PushSender, LogPushSender, DevicesService],
})
export class PushModule {}
