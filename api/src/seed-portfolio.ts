/**
 * 기본 계정(정현 · 010-0000-0000)에 업장 9곳을 더 붙인다 — 모두 10곳으로 전체 현황(/app/overview) 확인용.
 * 지금 데이터는 지우지 않는다. 이미 업장이 2곳 이상이면 아무것도 하지 않는다.
 * 실행: pnpm build && pnpm db:seed:portfolio
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { seedOrbitChain } from './seed-extra.js';

if (process.env.NODE_ENV === 'production') throw new Error('운영(production)에서는 예시 데이터를 넣을 수 없어요.');
const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
const added = await seedOrbitChain(app);
console.log(
  added
    ? `업장 ${added}곳을 더 만들었어요. 010-0000-0000 / woojoo1234 로 로그인하면 전체 현황(업장 ${added + 1}곳)이 보여요.`
    : '이미 업장이 여러 곳이에요. 건너뛰었어요.',
);
await app.close();
