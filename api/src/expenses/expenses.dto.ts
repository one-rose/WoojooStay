import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { IsCalendarDate, IsMonth } from '../common/validation/date-fields.js';
import { ExpenseCategory } from '../generated/prisma/enums.js';

export class ExpenseQuery {
  @ApiPropertyOptional({ example: '2026-11' })
  @IsOptional()
  @IsMonth()
  month?: string;
}

export class ExpenseDto {
  @ApiProperty({ example: '2026-11-10' })
  @IsCalendarDate()
  date: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  vendor: string;

  @ApiProperty({ enum: ExpenseCategory })
  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  memo?: string;
}

export class OrderDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  item: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  qty: number;

  @ApiProperty({ example: '박스' })
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  unit: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  vendor: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  amount: number;

  @ApiPropertyOptional({ enum: ExpenseCategory })
  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;
}

export class OrderStatusDto {
  @ApiProperty({ enum: ['ORDERED', 'RECEIVED', 'CANCELLED'] })
  @IsIn(['ORDERED', 'RECEIVED', 'CANCELLED'])
  status: 'ORDERED' | 'RECEIVED' | 'CANCELLED';
}
