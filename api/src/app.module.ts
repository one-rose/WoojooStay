import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module.js';
import { AiModule } from './ai/ai.module.js';
import { BillingModule } from './billing/billing.module.js';
import { ExpensesModule } from './expenses/expenses.module.js';
import { LedgerModule } from './ledger/ledger.module.js';
import { StaffModule } from './staff/staff.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ChannelsModule } from './channels/channels.module.js';
import { ClientThrottlerGuard } from './common/guards/client-throttler.guard.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { PropertyRoleGuard } from './common/guards/property-role.guard.js';
import { validateEnv } from './config/env.js';
import { ConnectorsModule } from './connectors/connectors.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { EventsModule } from './events/events.module.js';
import { HealthController } from './health.controller.js';
import { OpsModule } from './ops/ops.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PortfolioModule } from './portfolio/portfolio.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PropertiesModule } from './properties/properties.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { SmsModule } from './sms/sms.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRoot({
      // 사용자 IP 하나당 (화면 서버가 x-client-ip 로 알려준 값 — ClientThrottlerGuard)
      throttlers: [{ ttl: 60_000, limit: 600 }],
      // e2e 테스트는 한 IP 에서 가입을 여러 번 하므로 제외
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    EventsModule,
    SmsModule,
    AuthModule,
    AiModule,
    ConnectorsModule,
    NotificationsModule,
    PropertiesModule,
    ReviewsModule,
    ChannelsModule,
    DashboardModule,
    AdminModule,
    BillingModule,
    LedgerModule,
    StaffModule,
    ExpensesModule,
    OpsModule,
    PortfolioModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ClientThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PropertyRoleGuard },
  ],
})
export class AppModule {}
