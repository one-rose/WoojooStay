import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { AutoHours, Channel, Tone } from '../../generated/prisma/enums.js';

export const REVIEW_TABS = ['all', 'unanswered', 'positive', 'improve'] as const;
export type ReviewTab = (typeof REVIEW_TABS)[number];

export class ListReviewsQuery {
  @ApiPropertyOptional({ enum: REVIEW_TABS, default: 'all' })
  @IsOptional()
  @IsIn(REVIEW_TABS)
  tab: ReviewTab = 'all';

  @ApiPropertyOptional({ enum: Channel })
  @IsOptional()
  @IsEnum(Channel)
  channel?: Channel;

  @ApiPropertyOptional({ enum: ['latest', 'low'], default: 'latest' })
  @IsOptional()
  @IsIn(['latest', 'low'])
  sort: 'latest' | 'low' = 'latest';

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

export class PostReplyDto {
  @ApiProperty({ description: '게시할 답글 (AI 초안을 고친 것 그대로)' })
  @IsString()
  @MaxLength(2000)
  text: string;
}

export class ReplySettingsDto {
  @ApiProperty({ enum: Tone })
  @IsEnum(Tone)
  tone: Tone;

  @ApiProperty({ example: '스테이 오르빗 을지로 드림' })
  @IsString()
  @MaxLength(60)
  signature: string;

  @ApiProperty({ example: '다음 방문 때도 편히 쉬어 가실 수 있도록 준비하겠습니다.' })
  @IsString()
  @MaxLength(200)
  mustInclude: string;

  @ApiProperty({ type: [String], example: ['무조건', '환불'] })
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  banned: string[];

  @ApiProperty()
  @IsBoolean()
  autoEnabled: boolean;

  @ApiProperty({ minimum: 4, maximum: 5 })
  @IsInt()
  @Min(4)
  @Max(5)
  autoMinRating: number;

  @ApiProperty({ enum: AutoHours })
  @IsEnum(AutoHours)
  autoHours: AutoHours;
}
