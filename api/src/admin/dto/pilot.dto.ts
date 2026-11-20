import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { IsCalendarDate } from '../../common/validation/date-fields.js';

/** 실증 업장 지정·해제 — group 이 null(또는 빈 값)이면 해제 */
export class SetPilotDto {
  @ApiPropertyOptional({ example: '대전 1차', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(30)
  group?: string | null;

  @ApiPropertyOptional({ example: '2026-11-11', description: '실증 시작일 (기본 오늘)', nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsCalendarDate()
  startedAt?: string | null;
}

export class PilotKpiQuery {
  @ApiPropertyOptional({ example: '대전 1차', description: '없으면 첫 묶음' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  group?: string;
}

export const SUPPORT_NOTE_KINDS = ['CALL', 'VISIT', 'ETC'] as const;

export class SupportNoteDto {
  @ApiProperty({ enum: SUPPORT_NOTE_KINDS, description: '통화 · 방문 · 기타' })
  @IsIn(SUPPORT_NOTE_KINDS)
  kind: (typeof SUPPORT_NOTE_KINDS)[number];

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;
}

const optInt = (max: number) => [
  IsOptional(),
  ValidateIf((_: unknown, v: unknown) => v !== null),
  IsInt(),
  Min(0),
  Max(max),
];
const optScore = [IsOptional(), ValidateIf((_: unknown, v: unknown) => v !== null), IsInt(), Min(1), Max(5)];
const optText = (max: number) => [
  IsOptional(),
  ValidateIf((_: unknown, v: unknown) => v !== null),
  IsString(),
  MaxLength(max),
];
const apply =
  (...decorators: PropertyDecorator[]): PropertyDecorator =>
  (target, key) => {
    for (const d of decorators) d(target, key);
  };

/** 실증 설문 값 — 보낸 칸만 바뀐다. null 이면 비움 */
export class PilotSurveyDto {
  @ApiPropertyOptional({ description: '하루 채널 확인 시간(분)' }) @apply(...optInt(1440)) channelCheckMinutes?:
    number | null;
  @ApiPropertyOptional({ description: '급여 계산 방식' }) @apply(...optText(100)) payrollMethod?: string | null;
  @ApiPropertyOptional({ description: '한 달 급여 계산 시간(분)' }) @apply(...optInt(100_000)) payrollMinutes?:
    number | null;
  @ApiPropertyOptional({ description: '알바 수' }) @apply(...optInt(1000)) staffCount?: number | null;
  @ApiPropertyOptional({ description: '한 달 지출 건수' }) @apply(...optInt(100_000)) monthlyExpenseCount?:
    number | null;
  @ApiPropertyOptional({ description: '지출·장부 기록 방식' }) @apply(...optText(100)) recordMethod?: string | null;
  @ApiPropertyOptional() @apply(...optText(1000)) baselineMemo?: string | null;
  @ApiPropertyOptional({ minimum: 1, maximum: 5 }) @apply(...optScore) satisfaction4w?: number | null;
  @ApiPropertyOptional({ minimum: 1, maximum: 5 }) @apply(...optScore) satisfaction8w?: number | null;
  @ApiPropertyOptional() @apply(...optText(1000)) satisfactionMemo?: string | null;
  @ApiPropertyOptional({ description: '고른 요금제 이름' }) @apply(...optText(50)) wtpPlan?: string | null;
  @ApiPropertyOptional({ description: '쓰겠다는 업장 수' }) @apply(...optInt(1000)) wtpProperties?: number | null;
  @ApiPropertyOptional() @apply(...optText(1000)) wtpMemo?: string | null;
}
