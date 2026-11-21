/**
 * 지금 DB 에 모바일 앱 예시 데이터만 넣는다 (업장 출근 위치 · 기다리는 출퇴근 요청). 지우는 것 없음.
 * 실행: pnpm build && pnpm db:seed:mobile
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { PrismaService } from './prisma/prisma.service.js';
import { seedMobile } from './seed-mobile.js';

if (process.env.NODE_ENV === 'production') throw new Error('운영(production)에서는 예시 데이터를 넣을 수 없어요.');
const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
const r = await seedMobile(app.get(PrismaService));
console.log(`업장 ${r.located}곳에 출근 위치를 넣고, 기다리는 출퇴근 요청 ${r.requests}건을 만들었어요.`);
await app.close();
