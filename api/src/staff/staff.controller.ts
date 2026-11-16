import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser, PropertyRoles, Public, type AuthUser } from '../common/decorators/auth.decorators.js';
import { Errors } from '../common/errors/app-error.js';
import { isMonth } from '../common/validation/date-fields.js';
import { Role } from '../generated/prisma/enums.js';
import {
  ClockDto,
  EditAttendanceDto,
  EmployeeDto,
  ShiftDto,
  SignContractDto,
  StaffQuery,
  UpdateEmployeeDto,
} from './staff.dto.js';
import { StaffService } from './staff.service.js';

const month = (m: string) => {
  if (!isMonth(m)) throw Errors.badMonth();
  return m;
};

@ApiTags('알바관리 (F5-01 ~ F5-06)')
@ApiBearerAuth()
@Controller('properties/:propertyId/staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  @ApiOperation({ summary: '직원 · 오늘 출퇴근 · 이번 주 근무표 · 이번 달 급여' })
  overview(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Query() q: StaffQuery) {
    return this.staff.overview(propertyId, q.date);
  }

  @Get('me')
  @ApiOperation({ summary: '직원 본인 — 오늘 출퇴근 · 이번 주 근무 · 이번 달 기록' })
  mine(@Param('propertyId', ParseUUIDPipe) propertyId: string, @CurrentUser() user: AuthUser) {
    return this.staff.mine(propertyId, user.id);
  }

  @Post('employees')
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  @ApiOperation({ summary: '직원 등록 (최저시급 미만이면 belowMinimumWage)' })
  create(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Body() dto: EmployeeDto) {
    return this.staff.create(propertyId, dto);
  }

  @Patch('employees/:id')
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  @ApiOperation({ summary: '직원 정보·급여 수정 (매니저는 자기 기록을 고칠 수 없음)' })
  update(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request & { role: Role },
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.staff.update(propertyId, { userId: user.id, role: req.role }, id, dto);
  }

  @Post('employees/:id/contract')
  @HttpCode(200)
  @PropertyRoles([Role.OWNER])
  @ApiOperation({ summary: '근로계약서 보내기 (문자로 서명 링크)' })
  sendContract(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.staff.sendContract(propertyId, id);
  }

  @Post('attendance/clock')
  @HttpCode(200)
  @ApiOperation({ summary: '출근·퇴근 (직원은 본인 것만)' })
  clock(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request & { role: Role },
    @Body() dto: ClockDto,
  ) {
    return this.staff.clock(propertyId, { userId: user.id, role: req.role }, dto.employeeId, dto.action, dto.method);
  }

  @Put('attendance')
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  @ApiOperation({ summary: '출퇴근 기록 수정 (수정 이력 남김, 매니저는 자기 기록을 고칠 수 없음)' })
  editAttendance(
    @Param('propertyId', ParseUUIDPipe) propertyId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request & { role: Role },
    @Body() dto: EditAttendanceDto,
  ) {
    return this.staff.editAttendance(propertyId, { userId: user.id, role: req.role }, dto);
  }

  @Put('shifts')
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  @ApiOperation({ summary: '근무표 한 칸 (주간·야간·휴무)' })
  shift(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Body() dto: ShiftDto) {
    return this.staff.setShift(propertyId, dto.employeeId, dto.workDate, dto.shiftType);
  }

  @Post('payroll/:month/calculate')
  @HttpCode(200)
  @PropertyRoles([Role.OWNER, Role.MANAGER])
  @ApiOperation({ summary: '급여 다시 계산 (확정 전 명세)' })
  calc(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Param('month') m: string) {
    return this.staff.calculatePayroll(propertyId, month(m));
  }

  @Post('payroll/:month/confirm')
  @HttpCode(200)
  @PropertyRoles([Role.OWNER])
  @ApiOperation({ summary: '급여 확정 (지난달 이전만, 최저시급 미만 직원이 있으면 불가)' })
  confirm(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Param('month') m: string) {
    return this.staff.confirmPayroll(propertyId, month(m));
  }

  @Post('payroll/:month/reopen')
  @HttpCode(200)
  @PropertyRoles([Role.OWNER])
  @ApiOperation({ summary: '급여 확정 풀기 (명세를 보내기 전만)' })
  reopen(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Param('month') m: string) {
    return this.staff.reopenPayroll(propertyId, month(m));
  }

  @Post('payroll/:month/send')
  @HttpCode(200)
  @PropertyRoles([Role.OWNER])
  @ApiOperation({ summary: '급여명세 문자 발송' })
  send(@Param('propertyId', ParseUUIDPipe) propertyId: string, @Param('month') m: string) {
    return this.staff.sendPayroll(propertyId, month(m));
  }
}

/** 직원이 문자 링크로 여는 근로계약서 (로그인 없음) */
@ApiTags('근로계약서 서명 (F5-06)')
@Controller('contracts')
export class ContractsController {
  constructor(private readonly staff: StaffService) {}

  @Public()
  @Get(':token')
  view(@Param('token') token: string) {
    return this.staff.viewContract(token);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':token/sign')
  @HttpCode(200)
  sign(@Param('token') token: string, @Body() dto: SignContractDto) {
    return this.staff.signContract(token, dto.signerName);
  }
}
