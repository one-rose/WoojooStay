import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { BizVerifier, ChecksumBizVerifier, NtsBizVerifier } from './biz-verifier.js';
import { MembersService } from './members.service.js';
import { PropertiesController } from './properties.controller.js';
import { PropertiesService } from './properties.service.js';

@Module({
  controllers: [PropertiesController],
  providers: [
    PropertiesService,
    MembersService,
    {
      provide: BizVerifier,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const key = config.get('NTS_SERVICE_KEY', { infer: true });
        return key ? new NtsBizVerifier(key) : new ChecksumBizVerifier();
      },
    },
  ],
})
export class PropertiesModule {}
