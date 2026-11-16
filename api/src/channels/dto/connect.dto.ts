import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsBoolean, IsString, Length } from 'class-validator';

export class ConnectChannelDto {
  @ApiProperty({ description: '채널 파트너센터 아이디' })
  @IsString()
  @Length(1, 100)
  loginId: string;

  @ApiProperty({ description: '채널 파트너센터 비밀번호 (암호화해서 저장)' })
  @IsString()
  @Length(1, 200)
  password: string;

  @ApiProperty({ description: '(필수) 채널 계정 정보 위탁·수집 동의' })
  @IsBoolean()
  @Equals(true, { message: '채널 계정 정보 위탁·수집에 동의해 주세요.' })
  consent: boolean;
}
