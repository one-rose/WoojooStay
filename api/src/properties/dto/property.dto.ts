import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';
import { PropertyType, Role } from '../../generated/prisma/enums.js';
import { KOREAN_MOBILE, normalizePhone } from '../../common/utils/phone.js';

const digits = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value);

export class CreatePropertyDto {
  @ApiProperty({ example: '스테이 오르빗 을지로' })
  @IsString()
  @Length(1, 60)
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

/** 사업자번호는 등록 후 바꿀 수 없다 (변경은 고객센터) */
export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {}

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
