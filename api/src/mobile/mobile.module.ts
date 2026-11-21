import { Module } from '@nestjs/common';
import { MobileController } from './mobile.controller.js';
import { WebHandoffService } from './web-handoff.service.js';

/** 모바일 앱 전용 — 앱 설정(강제 업데이트) · 앱 → 웹 화면 넘기기 */
@Module({
  controllers: [MobileController],
  providers: [WebHandoffService],
})
export class MobileModule {}
