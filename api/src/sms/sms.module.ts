import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { AligoSmsSender, ConsoleSmsSender, SmsSender } from './sms-sender.js';

/** 알리고 키가 모두 있으면 실제 문자, 아니면 로그만 (테스트는 ConsoleSmsSender 의 outbox 를 읽는다) */
@Global()
@Module({
  providers: [
    ConsoleSmsSender,
    {
      provide: SmsSender,
      inject: [ConfigService, ConsoleSmsSender],
      useFactory: (config: ConfigService<Env, true>, console: ConsoleSmsSender) => {
        const apiKey = config.get('ALIGO_API_KEY', { infer: true });
        const userId = config.get('ALIGO_USER_ID', { infer: true });
        const sender = config.get('SMS_SENDER', { infer: true });
        if (!apiKey || !userId || !sender) return console;
        return new AligoSmsSender({
          apiKey,
          userId,
          sender,
          testMode: config.get('NODE_ENV', { infer: true }) !== 'production',
        });
      },
    },
  ],
  exports: [SmsSender, ConsoleSmsSender],
})
export class SmsModule {}
