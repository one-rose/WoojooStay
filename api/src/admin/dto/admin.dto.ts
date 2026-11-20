import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { AdminRole, InquiryStatus, InquiryType, PropertyType } from '../../generated/prisma/enums.js';
import { KOREAN_MOBILE } from '../../common/utils/phone.js';

const toLowerTrim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
// 해외 문의도 받도록 맨 앞 + 는 남긴다
const toContactPhone = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/(?!^\+)\D/g, '') : value;
export const ADMIN_PASSWORD = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{10,64}$/;

export class AdminLoginDto {
  @ApiProperty({ example: 'admin@woojoo.kr' })
  @Transform(toLowerTrim)
  @IsEmail({}, { message: '이메일 형식이 아니에요.' })
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  password: string;
}

export class CreateAdminDto {
  @ApiProperty()
  @Transform(toLowerTrim)
  @IsEmail({}, { message: '이메일 형식이 아니에요.' })
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  name: string;

  @ApiProperty({ description: '10자 이상, 영문·숫자·특수문자 포함' })
  @Matches(ADMIN_PASSWORD, { message: '비밀번호는 10자 이상, 영문·숫자·특수문자를 모두 넣어 주세요.' })
  password: string;

  @ApiPropertyOptional({ enum: AdminRole })
  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole;
}

export class ListPropertiesQuery {
  @ApiPropertyOptional({ description: '업장 이름·사장님 이름·사업자번호 검색' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  q?: string;

  @ApiPropertyOptional({ enum: ['all', 'issue', 'trial', 'pilot'] })
  @IsOptional()
  @IsIn(['all', 'issue', 'trial', 'pilot'])
  filter?: 'all' | 'issue' | 'trial' | 'pilot';

  @ApiPropertyOptional({ description: '이 사장님(사용자 id)의 업장만' })
  @IsOptional()
  @IsUUID('all', { message: '사용자 id 형식이 아니에요.' })
  ownerId?: string;
}

export class AssignManagerDto {
  @ApiPropertyOptional({ description: '담당 운영자 id. null 이면 해제', nullable: true })
  @IsOptional()
  @IsUUID('all', { message: '운영자 id 형식이 아니에요.' })
  managerId?: string | null;
}

export class ListInquiriesQuery {
  @ApiPropertyOptional({ enum: InquiryStatus })
  @IsOptional()
  @IsEnum(InquiryStatus)
  status?: InquiryStatus;
}

export class UpdateInquiryDto {
  @ApiPropertyOptional({ enum: InquiryStatus })
  @IsOptional()
  @IsEnum(InquiryStatus)
  status?: InquiryStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminMemo?: string;
}

/** 랜딩 '도입 문의' · '파트너 문의' (로그인 없음) */
export class CreateInquiryDto {
  @ApiProperty({ enum: InquiryType })
  @IsEnum(InquiryType)
  type: InquiryType;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  contactName: string;

  @ApiProperty({ example: '010-1234-5678', description: '국내 번호 또는 +국가번호' })
  @Transform(toContactPhone)
  @Matches(/^(0\d{8,10}|\+\d{8,15})$/, { message: '연락처 형식이 아니에요.' })
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toLowerTrim)
  @IsEmail({}, { message: '이메일 형식이 아니에요.' })
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  propertyName?: string;

  @ApiPropertyOptional({ enum: PropertyType })
  @IsOptional()
  @IsEnum(PropertyType)
  propertyType?: PropertyType;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  rooms?: number;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;
}

export { KOREAN_MOBILE };
