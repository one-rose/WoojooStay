import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Length, Matches, Max, Min, ValidateBy } from 'class-validator';
import { PropertyType, Role } from '../../generated/prisma/enums.js';
import { KOREAN_MOBILE, normalizePhone } from '../../common/utils/phone.js';

/** 업장 이름에 링크(주소) 모양이 들어가면 거절 — 초대·계약서 문자에 업장 이름이 들어가서 피싱에 쓰일 수 있다 */
const LINK_LIKE =
  /(https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|kr|co|io|me|ly|gl|xyz|site|link|app|info|biz|shop|top|click)\b)/i;
function NoLink() {
  return ValidateBy({
    name: 'noLink',
    validator: {
      validate: (v: unknown) => typeof v !== 'string' || !LINK_LIKE.test(v),
      defaultMessage: () => '업장 이름에는 인터넷 주소를 넣을 수 없어요.',
    },
  });
}

const digits = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value);

export class CreatePropertyDto {
  @ApiProperty({ example: '스테이 오르빗 을지로' })
  @IsString()
  @Length(1, 60)
  @NoLink()
  name: string;

  @ApiProperty({ enum: PropertyType })
  @IsEnum(PropertyType)
  type: PropertyType;

  @ApiProperty({ example: '서울 중구 을지로 OO길 12' })
  @IsString()
  @Length(2, 200)
  address: string;

  @ApiProperty({ example: 42 })
  @IsInt()
  @Min(1)
  @Max(5000)
  rooms: number;

  @ApiProperty({ example: '220-81-62517' })
  @Transform(digits)
  @Matches(/^\d{10}$/, { message: '사업자등록번호는 숫자 10자리예요.' })
  bizNo: string;

  @ApiProperty({ example: '정현' })
  @IsString()
  @Length(1, 30)
  ownerName: string;

  @ApiPropertyOptional({ example: '02-1234-5678' })
  @IsOptional()
  @IsString()
  @Length(0, 20)
  phone?: string;
}

/**
 * 사업자번호는 등록 후 바꿀 수 없다 (변경은 고객센터).
 * 출근 확인 위치: latitude·longitude 를 함께 보낸다 (둘 다 null 이면 위치 지우기 — 위치 확인 없이 출근 허용).
 */
export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {
  @ApiPropertyOptional({ example: 37.5663, nullable: true, description: '출근 확인 위치 위도 (null: 지우기)' })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: '위도가 올바르지 않아요.' })
  @Min(-90, { message: '위도는 -90~90 사이예요.' })
  @Max(90, { message: '위도는 -90~90 사이예요.' })
  latitude?: number | null;

  @ApiPropertyOptional({ example: 126.9918, nullable: true, description: '출근 확인 위치 경도 (null: 지우기)' })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: '경도가 올바르지 않아요.' })
  @Min(-180, { message: '경도는 -180~180 사이예요.' })
  @Max(180, { message: '경도는 -180~180 사이예요.' })
  longitude?: number | null;

  @ApiPropertyOptional({ example: 150, description: '출근 확인 반경 (m, 50~1000)' })
  @IsOptional()
  @IsInt({ message: '출근 반경은 숫자(m)로 넣어 주세요.' })
  @Min(50, { message: '출근 반경은 50m~1,000m 사이로 정해 주세요.' })
  @Max(1000, { message: '출근 반경은 50m~1,000m 사이로 정해 주세요.' })
  clockRadiusM?: number;
}

export class InviteDto {
  @ApiProperty({ example: '010-2222-3333' })
  @Transform(({ value }) => (typeof value === 'string' ? normalizePhone(value) : value))
  @Matches(KOREAN_MOBILE, { message: '휴대폰 번호 형식이 아니에요.' })
  phone: string;

  @ApiProperty({ enum: [Role.MANAGER, Role.STAFF] })
  @IsEnum(Role)
  role: Role;
}

export class ChangeRoleDto {
  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role: Role;
}

export class AcceptInvitationDto {
  @ApiProperty()
  @IsString()
  token: string;
}
