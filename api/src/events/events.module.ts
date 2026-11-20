import { Global, Module } from '@nestjs/common';
import { EventsService } from './events.service.js';

/** 사용 기록 — 어느 모듈에서나 주입해 쓴다 */
@Global()
@Module({ providers: [EventsService], exports: [EventsService] })
export class EventsModule {}
