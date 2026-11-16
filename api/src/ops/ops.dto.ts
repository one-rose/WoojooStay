import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { OpsNoteKind, RoomStatus, ShiftType } from '../generated/prisma/enums.js';

export class RoomDto {
  @ApiProperty({ example: '201' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  number: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-5)
  @Max(200)
  floor?: number;

  @ApiPropertyOptional({ example: '스탠다드 더블' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  roomType?: string;
}

export class RoomsDto {
  @ApiProperty({ type: [RoomDto] })
  @ValidateNested({ each: true })
  @Type(() => RoomDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(300)
  rooms: RoomDto[];
}

export class RoomStatusDto {
  @ApiProperty({ enum: RoomStatus })
  @IsEnum(RoomStatus)
  status: RoomStatus;

  @ApiPropertyOptional({ description: '비우면 메모 지움' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  memo?: string;

  @ApiPropertyOptional({
    enum: RoomStatus,
    description: '화면이 보고 있던 지금 상태 — 그사이 다른 사람이 바꿨으면 409 ROOM_STATUS_CONFLICT',
  })
  @IsOptional()
  @IsEnum(RoomStatus)
  expectedStatus?: RoomStatus;
}

export class OpsNoteDto {
  @ApiProperty({ enum: OpsNoteKind })
  @IsEnum(OpsNoteKind)
  kind: OpsNoteKind;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body: string;

  @ApiPropertyOptional({ enum: ShiftType, description: '인수인계를 쓴 근무' })
  @IsOptional()
  @IsEnum(ShiftType)
  shift?: ShiftType;

  @ApiPropertyOptional({ description: '공지 맨 위 고정' })
  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}

export class PinDto {
  @ApiProperty()
  @IsBoolean()
  pinned: boolean;
}
