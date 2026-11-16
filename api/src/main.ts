import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { fakeIntegrations, type Env } from './config/env.js';
import { setupApp } from './setup-app.js';

async function bootstrap() {
  const app = setupApp(await NestFactory.create(AppModule));
  const config = app.get(ConfigService<Env, true>);
  const fakes = fakeIntegrations({
    ALIGO_API_KEY: config.get('ALIGO_API_KEY', { infer: true }),
    ALIGO_USER_ID: config.get('ALIGO_USER_ID', { infer: true }),
    SMS_SENDER: config.get('SMS_SENDER', { infer: true }),
    TOSS_SECRET_KEY: config.get('TOSS_SECRET_KEY', { infer: true }),
    NTS_SERVICE_KEY: config.get('NTS_SERVICE_KEY', { infer: true }),
    ANTHROPIC_API_KEY: config.get('ANTHROPIC_API_KEY', { infer: true }),
  } as Env);
  if (fakes.length) new Logger('Startup').warn(`가짜(개발용)로 동작하는 외부 연동: ${fakes.join(' · ')}`);
  const doc = new DocumentBuilder()
    .setTitle('우주스테이 API')
    .setDescription('MVP 1차 — 회원·업장·직원 권한·채널 연동·AI 리뷰·홈 대시보드·알림')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, doc));
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
