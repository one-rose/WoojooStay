import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { KOREAN_MOBILE, normalizePhone } from '../../common/utils/phone.js';

const toPhone = ({ value }: { value: unknown }) => (typeof value === 'string' ? normalizePhone(value) : value);
const PASSWORD = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;

export class SendCodeDto {
  @ApiProperty({ example: '010-1234-5678' })
  @Transform(toPhone)
  @Matches(KOREAN_MOBILE, { message: '휴대폰 번호 형식이 아니에요.' })
  phone: string;

  @ApiProperty({ enum: ['signup', 'reset'] })
  @IsIn(['signup', 'reset'])
  purpose: 'signup' | 'reset';
}

export class VerifyCodeDto extends SendCodeDto {
  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: '인증번호는 숫자 6자리예요.' })
  code: string;
}

export class AgreementsDto {
  @ApiProperty({ description: '(필수) 서비스 이용약관' })
  @IsBoolean()
  terms: boolean;

  @ApiProperty({ description: '(필수) 개인정보 수집·이용' })
  @IsBoolean()
  privacy: boolean;

  @ApiProperty({ description: '(선택) 혜택·이벤트 알림' })
  @IsBoolean()
  marketing: boolean;
}

export class SignupDto {
  @ApiProperty({ description: '휴대폰 인증 후 받은 토큰' })
  @IsString()
  verificationToken: string;

  @ApiProperty({ example: '정현' })
  @IsString()
  @Length(1, 30)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail({}, { message: '이메일 형식이 아니에요.' })
  email?: string;

  @ApiProperty({ description: '영문·숫자 포함 8자 이상' })
  @Matches(PASSWORD, { message: '비밀번호는 영문·숫자를 포함해 8자 이상이어야 해요.' })
  password: string;

  @ApiProperty({ type: AgreementsDto })
  @ValidateNested()
  @Type(() => AgreementsDto)
  agreements: AgreementsDto;
}

export class LoginDto {
  @ApiProperty({ example: '010-1234-5678' })
  @Transform(toPhone)
  @Matches(KOREAN_MOBILE, { message: '휴대폰 번호 형식이 아니에요.' })
  phone: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  password: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  verificationToken: string;

  @ApiProperty()
  @Matches(PASSWORD, { message: '비밀번호는 영문·숫자를 포함해 8자 이상이어야 해요.' })
  password: string;
}
