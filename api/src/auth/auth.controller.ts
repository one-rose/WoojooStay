import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Public, type AuthUser } from '../common/decorators/auth.decorators.js';
import { AuthService } from './auth.service.js';
import { LoginDto, RefreshDto, ResetPasswordDto, SendCodeDto, SignupDto, VerifyCodeDto } from './dto/auth.dto.js';
import { TokensService } from './tokens.service.js';

@ApiTags('인증 (F0-01)')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokensService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('phone/send-code')
  @HttpCode(200)
  @ApiOperation({ summary: '휴대폰 인증번호 발송 (3분 유효)' })
  sendCode(@Body() dto: SendCodeDto) {
    return this.auth.sendCode(dto.phone, dto.purpose);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('phone/verify')
  @HttpCode(200)
  @ApiOperation({ summary: '인증번호 확인 → verificationToken' })
  verify(@Body() dto: VerifyCodeDto) {
    return this.auth.verifyCode(dto.phone, dto.purpose, dto.code);
  }

  @Public()
  @Post('signup')
  @ApiOperation({ summary: '가입 (약관 동의 포함)' })
  signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: '휴대폰 번호 + 비밀번호 로그인' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: '토큰 갱신 (리프레시 토큰은 1회용)' })
  refresh(@Body() dto: RefreshDto) {
    return this.tokens.rotate(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Body() dto: RefreshDto) {
    await this.tokens.revoke(dto.refreshToken);
  }

  @Public()
  @Post('password/reset')
  @HttpCode(200)
  @ApiOperation({ summary: '비밀번호 재설정 (휴대폰 인증 후)' })
  reset(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: '내 정보 + 내가 속한 업장' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
