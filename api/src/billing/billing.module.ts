import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { BillingController } from './billing.controller.js';
import { BillingScheduler } from './billing.scheduler.js';
import { BillingService } from './billing.service.js';
import { FakePaymentGateway, PaymentGateway, TossPaymentGateway } from './payment-gateway.js';

@Global()
@Module({
  imports: [NotificationsModule],
  controllers: [BillingController],
  providers: [
    BillingService,
    BillingScheduler,
    FakePaymentGateway,
    {
      // 토스 시크릿 키가 있으면 실제 결제, 없으면 개발용 (테스트는 FakePaymentGateway 의 charges 를 읽는다)
      provide: PaymentGateway,
      inject: [ConfigService, FakePaymentGateway],
      useFactory: (config: ConfigService<Env, true>, fake: FakePaymentGateway) => {
        const key = config.get('TOSS_SECRET_KEY', { infer: true });
        return key ? new TossPaymentGateway(key) : fake;
      },
    },
  ],
  exports: [BillingService, FakePaymentGateway],
})
export class BillingModule {}
