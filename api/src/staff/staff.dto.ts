import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { JobRole, PayType, ShiftType } from '../generated/prisma/enums.js';
import { KOREAN_MOBILE, normalizePhone } from '../common/utils/phone.js';
import { IsCalendarDate, IsMonth } from '../common/validation/date-fields.js';

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

  /** 사장님은 꼭 넣는다. 매니저는 넣을 수 없다 (그해 최저시급 시급제로 등록, 사장님이 나중에 정함) */
  @ApiPropertyOptional({ enum: PayType })
  @IsOptional()
  @IsEnum(PayType)
  payType?: PayType;

  @ApiPropertyOptional({ description: '시급 또는 월급 (원)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000_000)
  payAmount?: number;

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

/** 위치 (WGS84) — 출퇴근·출퇴근 요청에 같이 보낸다 */
export class LocationFields {
  @ApiPropertyOptional({ example: 37.5665, description: '위도 (longitude 와 함께)' })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: '위치(위도)가 올바르지 않아요.' })
  @Min(-90, { message: '위치(위도)가 올바르지 않아요.' })
  @Max(90, { message: '위치(위도)가 올바르지 않아요.' })
  latitude?: number;

  @ApiPropertyOptional({ example: 126.978, description: '경도 (latitude 와 함께)' })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: '위치(경도)가 올바르지 않아요.' })
  @Min(-180, { message: '위치(경도)가 올바르지 않아요.' })
  @Max(180, { message: '위치(경도)가 올바르지 않아요.' })
  longitude?: number;

  @ApiPropertyOptional({ example: 25, description: '위치 정확도 (m) — 100m 까지만 반경에 더해 준다' })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: '위치 정확도가 올바르지 않아요.' })
  @Min(0, { message: '위치 정확도가 올바르지 않아요.' })
  @Max(100_000, { message: '위치 정확도가 올바르지 않아요.' })
  accuracy?: number;
}

/**
 * 출근·퇴근. 직원 본인: 위치(latitude·longitude·accuracy) 또는 qr 를 보낸다 (업장 위치가 없으면 둘 다 없어도 됨).
 * method 는 예전 화면 호환용 — 실제 기록 방법은 서버가 보낸 값으로 정한다 (QR 이면 qr 필수).
 */
export class ClockDto extends LocationFields {
  @ApiProperty() @IsUUID() employeeId: string;
  @ApiProperty({ enum: ['in', 'out'] }) @IsIn(['in', 'out']) action: 'in' | 'out';
  @ApiPropertyOptional({ enum: ['GPS', 'QR', 'MANUAL'] })
  @IsOptional()
  @IsIn(['GPS', 'QR', 'MANUAL'], { message: '출퇴근 요청은 요청 보내기로 해 주세요.' })
  method?: 'GPS' | 'QR' | 'MANUAL';

  @ApiPropertyOptional({ description: '찍은 출근 QR 문자열 그대로 (uzustay://clock?p=…&k=…&s=…)' })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '우주스테이 출근 QR이 아니에요. 프런트에 붙은 출근 QR을 찍어 주세요.' })
  qr?: string;
}

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** 출퇴근 요청 — 위치·QR 로 안 될 때 사유와 함께 (직원 본인) */
export class ClockRequestDto extends LocationFields {
  @ApiProperty({ enum: ['IN', 'OUT'] })
  @IsIn(['IN', 'OUT'], { message: '출근·퇴근 중 하나를 골라 주세요.' })
  type: 'IN' | 'OUT';

  @ApiProperty({ example: '휴대폰 위치가 잡히지 않아요' })
  @Transform(trim)
  @IsString()
  @MinLength(2, { message: '사유를 2자 이상 적어 주세요.' })
  @MaxLength(200, { message: '사유는 200자까지 쓸 수 있어요.' })
  reason: string;

  @ApiPropertyOptional({ description: '출근(퇴근)한 시각 ISO — 없으면 지금. 지금부터 12시간 전까지' })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: '요청 시각 형식이 올바르지 않아요.' })
  requestedAt?: string;
}

export class RejectClockRequestDto {
  @ApiProperty({ example: '그날 근무표에 없어요' })
  @Transform(trim)
  @IsString({ message: '거절 사유를 적어 주세요.' })
  @MinLength(2, { message: '거절 사유를 2자 이상 적어 주세요.' })
  @MaxLength(200, { message: '거절 사유는 200자까지 쓸 수 있어요.' })
  reason: string;
}

export class ClockRequestQuery {
  @ApiPropertyOptional({ enum: ['PENDING', 'APPROVED', 'REJECTED', 'ALL'], description: '기본 PENDING' })
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'ALL'])
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';
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
  @ApiPropertyOptional({
    example: '2026-11-16',
    description: '근무표를 볼 주 (그 주 월요일, 다른 날이면 그 주 월요일로)',
  })
  @IsOptional()
  @IsCalendarDate()
  week?: string;
}

export class SignContractDto {
  @ApiProperty({ description: '서명한 사람 이름 (직원 이름과 같아야 함)' })
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  signerName: string;

  @ApiPropertyOptional() @IsOptional() @IsISO8601() agreedAt?: string;
}

export class AttendanceMonthQuery {
  @ApiPropertyOptional({ example: '2026-11' })
  @IsOptional()
  @IsMonth()
  month?: string;
}
