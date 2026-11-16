import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsIn, IsUUID, Matches, ValidateNested } from 'class-validator';
import { CurrentUser, type AuthUser } from '../common/decorators/auth.decorators.js';
import { KOREAN_MOBILE, normalizePhone } from '../common/utils/phone.js';
import { Role } from '../generated/prisma/enums.js';
import { MembersService } from './members.service.js';
import { PeopleService, type AssignRole } from './people.service.js';

class AssignmentDto {
  @ApiProperty()
  @IsUUID('all')
  propertyId: string;

  @ApiProperty({ enum: ['MANAGER', 'STAFF'], nullable: true, description: 'null 이면 이 업장에서 뺀다' })
  @IsIn(['MANAGER', 'STAFF', null])
  role: AssignRole;
}

class AssignDto {
  @ApiProperty({ type: [AssignmentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AssignmentDto)
  assignments: AssignmentDto[];
}

class InviteManyDto {
  @ApiProperty({ example: '010-2222-3333' })
  @Transform(({ value }) => (typeof value === 'string' ? normalizePhone(value) : value))
  @Matches(KOREAN_MOBILE, { message: '휴대폰 번호 형식이 아니에요.' })
  phone: string;

  @ApiProperty({ enum: [Role.MANAGER, Role.STAFF] })
  @IsEnum(Role)
  role: Role;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1, { message: '업장을 하나 이상 골라 주세요.' })
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  propertyIds: string[];
}

@ApiTags('여러 업장 통합 현황 (F8)')
@ApiBearerAuth()
@Controller('portfolio')
export class PeopleController {
  constructor(
    private readonly people: PeopleService,
    private readonly members: MembersService,
  ) {}

  @Get('people')
  @ApiOperation({ summary: '내가 사장님인 업장 전부의 사람 · 업장별 권한 · 대기 중 초대' })
  list(@CurrentUser() user: AuthUser) {
    return this.people.list(user.id);
  }

  @Put('people/:userId')
  @ApiOperation({ summary: '한 사람의 업장별 권한을 한 번에 (role null 이면 그 업장에서 빼기)' })
  assign(@CurrentUser() user: AuthUser, @Param('userId', ParseUUIDPipe) userId: string, @Body() dto: AssignDto) {
    return this.people.assign(user.id, userId, dto.assignments);
  }

  @Post('invitations')
  @ApiOperation({ summary: '한 사람을 내 업장 여러 곳에 함께 초대 (문자 한 통, 링크 하나로 모두 수락)' })
  invite(@CurrentUser() user: AuthUser, @Body() dto: InviteManyDto) {
    return this.members.inviteMany(user.id, dto.phone, dto.role, [...new Set(dto.propertyIds)]);
  }
}
