import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../config/env.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { TokensService } from './tokens.service.js';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({ secret: config.get('JWT_ACCESS_SECRET', { infer: true }) }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokensService],
  exports: [JwtModule, TokensService],
})
export class AuthModule {}
