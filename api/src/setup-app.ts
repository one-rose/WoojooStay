import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppExceptionFilter } from './common/errors/prisma-exception.filter.js';
import type { Env } from './config/env.js';

/** main.ts 와 e2e 테스트가 같은 설정을 쓰도록 */
export function setupApp(app: INestApplication) {
  const config = app.get(ConfigService<Env, true>);
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.enableCors({ origin: config.get('WEB_ORIGIN', { infer: true }).split(','), credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, stopAtFirstError: true }),
  );
  app.useGlobalFilters(new AppExceptionFilter(app.getHttpAdapter()));
  app.enableShutdownHooks();
  return app;
}
