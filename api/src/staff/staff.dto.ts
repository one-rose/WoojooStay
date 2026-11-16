import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ClockMethod, JobRole, PayType, ShiftType } from '../generated/prisma/enums.js';
import { KOREAN_MOBILE, normalizePhone } from '../common/utils/phone.js';
import { IsCalendarDate } from '../common/validation/date-fields.js';

const toPhone = ({ value }: { value: unknown }) => (typeof value === 'string' ? normalizePhone(value) : value);
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class EmployeeDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  name: string;

  @ApiProperty({ example: '010-1234-5678' })
  @Transform(toPhone)
  @Matches(KOREAN_MOBILE, { message: '휴대폰 번호 형식이 아니에요.' })
  phone: string;

  @ApiProperty({ enum: JobRole })
  @IsEnum(JobRole)
  jobRole: JobRole;

  @ApiProperty({ enum: PayType })
  @IsEnum(PayType)
  payType: PayType;

  @ApiProperty({ description: '시급 또는 월급 (원)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  payAmount: number;

  @ApiProperty({ example: '2026-11-01' })
  @IsCalendarDate()
  hiredDate: string;
}

export class UpdateEmployeeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(30) name?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(toPhone) @Matches(KOREAN_MOBILE) phone?: string;
  @ApiPropertyOptional({ enum: JobRole }) @IsOptional() @IsEnum(JobRole) jobRole?: JobRole;
  @ApiPropertyOptional({ enum: PayType }) @IsOptional() @IsEnum(PayType) payType?: PayType;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100_000_000) payAmount?: number;
  @ApiPropertyOptional({ description: '퇴사일 — 넣으면 퇴사 처리' })
  @IsOptional()
  @IsCalendarDate()
  resignedDate?: string;
}

export class ClockDto {
  @ApiProperty() @IsUUID() employeeId: string;
  @ApiProperty({ enum: ['in', 'out'] }) @IsIn(['in', 'out']) action: 'in' | 'out';
  @ApiPropertyOptional({ enum: ClockMethod }) @IsOptional() @IsEnum(ClockMethod) method?: ClockMethod;
}

export class EditAttendanceDto {
  @ApiProperty() @IsUUID() employeeId: string;
  @ApiProperty({ example: '2026-11-10' }) @IsCalendarDate() workDate: string;
  @ApiProperty({ example: '09:00' }) @Matches(TIME, { message: '시간은 HH:mm 형식이에요.' }) clockIn: string;
  @ApiPropertyOptional({ example: '18:00', description: '자정을 넘기면 다음 날로 본다' })
  @IsOptional()
  @Matches(TIME, { message: '시간은 HH:mm 형식이에요.' })
  clockOut?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) memo?: string;
}

export class ShiftDto {
  @ApiProperty() @IsUUID() employeeId: string;
  @ApiProperty() @IsCalendarDate() workDate: string;
  @ApiProperty({ enum: ShiftType }) @IsEnum(ShiftType) shiftType: ShiftType;
}

export class StaffQuery {
  @ApiPropertyOptional({ example: '2026-11-10' }) @IsOptional() @IsCalendarDate() date?: string;
}

export class SignContractDto {
  @ApiProperty({ description: '서명한 사람 이름 (직원 이름과 같아야 함)' })
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  signerName: string;

  @ApiPropertyOptional() @IsOptional() @IsISO8601() agreedAt?: string;
}
